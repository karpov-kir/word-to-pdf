package background

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/karpov-kir/word-to-pdf/backend/config"
	"github.com/karpov-kir/word-to-pdf/backend/database"
	"github.com/karpov-kir/word-to-pdf/backend/models"
	"github.com/sirupsen/logrus"
)

func StartDeletingOldConvertRequestFiles() {
	thresholdMinutes := int(config.Config.DeleteOldFilesThreshold.Minutes())

	logrus.Infof(
		"Deleting files of convert requests that are older than %d minutes every %s",
		thresholdMinutes,
		config.Config.DeleteOldFilesInterval,
	)

	for {
		time.Sleep(config.Config.DeleteOldFilesInterval)

		namedArgs := map[string]interface{}{
			"doneStatus":   models.ConvertRequestStatusDone,
			"errorStatus":  models.ConvertRequestStatusError,
			"queuedStatus": models.ConvertRequestStatusQueued,
		}

		whereClause := fmt.Sprintf(`
      WHERE 
        (
          (
            converted_at < NOW() - INTERVAL '%d MINUTES'
            AND status = :doneStatus
          ) 
          OR (
            status = :errorStatus
          )
          OR (
            created_at < NOW() - INTERVAL '24 HOURS'
            AND status = :queuedStatus
          )
        )
        AND is_file_deleted = FALSE
    `, thresholdMinutes)

		query, args, err := sqlx.Named(
			"SELECT id FROM convert_requests "+whereClause+" LIMIT 1000",
			namedArgs,
		)
		if err != nil {
			logrus.Errorf("Failed to create query to fetch convert requests to delete old files: %v", err)
			continue
		}

		query = database.Connection.Rebind(query)

		convertRequestsToDeleteFiles := []struct {
			Id string `db:"id"`
		}{}
		err = database.Connection.Select(&convertRequestsToDeleteFiles, query, args...)
		if err != nil {
			logrus.Errorf("Failed to fetch convert requests to delete old files: %v", err)
			continue
		}

		countQuery, args, err := sqlx.Named(`SELECT COUNT(*) FROM convert_requests `+whereClause, namedArgs)
		if err != nil {
			logrus.Errorf("Failed to build count query: %v", err)
			continue
		}

		countQuery = database.Connection.Rebind(countQuery)

		var totalConvertRequestsToDeleteFiles int
		err = database.Connection.Get(&totalConvertRequestsToDeleteFiles, countQuery, args...)
		if err != nil {
			logrus.Errorf("Failed to count convert requests to delete old files: %v", err)
			continue
		}

		if len(convertRequestsToDeleteFiles) == 0 {
			continue
		}

		logrus.Infof("Fetched %d convert requests to delete old files out of %d", len(convertRequestsToDeleteFiles), totalConvertRequestsToDeleteFiles)

		for _, convertRequestToDeleteFile := range convertRequestsToDeleteFiles {
			uploadedFilePath := filepath.Join(config.Config.UploadsFolderAbsolutePath, convertRequestToDeleteFile.Id)
			convertedFilePath := filepath.Join(config.Config.UploadsFolderAbsolutePath, convertRequestToDeleteFile.Id+"_converted")

			logrus.Infof("Deleting files %s and %s", uploadedFilePath, convertedFilePath)

			if err := os.Remove(uploadedFilePath); err != nil {
				if os.IsNotExist(err) {
					logrus.Infof("File to delete %s does not exist, ignoring: %v", uploadedFilePath, err)
				} else {
					logrus.Errorf("Failed to delete file %s (will be retried): %v", uploadedFilePath, err)
					continue
				}
			}

			if err := os.Remove(convertedFilePath); err != nil {
				if os.IsNotExist(err) {
					logrus.Infof("File to delete %s does not exist, ignoring: %v", convertedFilePath, err)
				} else {
					logrus.Errorf("Failed to delete file %s (will be retried): %v", convertedFilePath, err)
					continue
				}
			}

			_, err := database.Connection.Exec(
				"UPDATE convert_requests SET is_file_deleted = TRUE WHERE id = $1",
				convertRequestToDeleteFile.Id,
			)
			if err != nil {
				logrus.Errorf("Failed to update is_file_deleted for file %s: %v", convertRequestToDeleteFile.Id, err)
			}
		}

		// Just to not spam logs
		if len(convertRequestsToDeleteFiles) == 0 {
			continue
		}

		logrus.Infof("Tried to clean up files from %d convert requests", len(convertRequestsToDeleteFiles))
	}
}
