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

func StartDeletingOldBatchRequestFiles() {
	thresholdMinutes := int(config.Config.DeleteOldFilesThreshold.Minutes())

	logrus.Infof(
		"Deleting files of batch requests that are older than %d minutes every %s",
		thresholdMinutes,
		config.Config.DeleteOldFilesInterval,
	)

	for {
		time.Sleep(config.Config.DeleteOldFilesInterval)

		namedArgs := map[string]interface{}{
			"doneStatus":   models.BatchRequestStatusDone,
			"errorStatus":  models.BatchRequestStatusError,
			"queuedStatus": models.BatchRequestStatusQueued,
		}

		whereClause := fmt.Sprintf(`
      WHERE 
        (
          (
            batched_at < NOW() - INTERVAL '%d MINUTES'
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
        AND is_batch_deleted = FALSE
    `, thresholdMinutes)

		query, args, err := sqlx.Named(
			"SELECT id FROM batch_request "+whereClause+" LIMIT 1000",
			namedArgs,
		)
		if err != nil {
			logrus.Errorf("Failed to create query to fetch batch requests to delete old files: %v", err)
			continue
		}

		query = database.Connection.Rebind(query)

		batchRequestsToDeleteFiles := []struct {
			Id string `db:"id"`
		}{}
		err = database.Connection.Select(&batchRequestsToDeleteFiles, query, args...)
		if err != nil {
			logrus.Errorf("Failed to fetch batch requests to delete old files: %v", err)
			continue
		}

		countQuery, args, err := sqlx.Named(`SELECT COUNT(*) FROM batch_request `+whereClause, namedArgs)
		if err != nil {
			logrus.Errorf("Failed to build count query: %v", err)
			continue
		}

		countQuery = database.Connection.Rebind(countQuery)

		var totalBatchRequestsToDeleteFiles int
		err = database.Connection.Get(&totalBatchRequestsToDeleteFiles, countQuery, args...)
		if err != nil {
			logrus.Errorf("Failed to count batch requests to delete old files: %v", err)
			continue
		}

		if len(batchRequestsToDeleteFiles) == 0 {
			continue
		}

		logrus.Infof("Fetched %d batch requests to delete old files out of %d", len(batchRequestsToDeleteFiles), totalBatchRequestsToDeleteFiles)

		for _, batchRequestToDeleteFile := range batchRequestsToDeleteFiles {
			zipFilePath := filepath.Join(config.Config.UploadsFolderAbsolutePath, fmt.Sprintf("%s.zip", batchRequestToDeleteFile.Id))

			logrus.Infof("Deleting file %s", zipFilePath)

			if err := os.Remove(zipFilePath); err != nil {
				if os.IsNotExist(err) {
					logrus.Infof("File to delete %s does not exist, ignoring: %v", zipFilePath, err)
				} else {
					logrus.Errorf("Failed to delete file %s (will be retried): %v", zipFilePath, err)
					continue
				}
			}

			_, err := database.Connection.Exec(
				"UPDATE batch_request SET is_batch_deleted = TRUE WHERE id = $1",
				batchRequestToDeleteFile.Id,
			)
			if err != nil {
				logrus.Errorf("Failed to update is_batch_deleted for file %s: %v", batchRequestToDeleteFile.Id, err)
			}
		}

		// Just to not spam logs
		if len(batchRequestsToDeleteFiles) == 0 {
			continue
		}

		logrus.Infof("Tried to clean up files from %d batch requests", len(batchRequestsToDeleteFiles))
	}
}
