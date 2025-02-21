package background

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/gofrs/uuid/v5"
	"github.com/jmoiron/sqlx"
	"github.com/karpov-kir/word-to-pdf/backend/config"
	"github.com/karpov-kir/word-to-pdf/backend/database"
	"github.com/karpov-kir/word-to-pdf/backend/models"
	"github.com/karpov-kir/word-to-pdf/backend/utils"
	"github.com/sirupsen/logrus"
)

func ProcessBatchRequests(taskPool *utils.TaskPool) {
	logrus.Infof("Polling batch requests to process from DB every %s", config.Config.PollBatchRequestsInterval)

	for {
		time.Sleep(config.Config.PollBatchRequestsInterval)

		if taskPool.LeftSlots() == 0 {
			continue
		}

		occupiedTokens := taskPool.OccupiedTokens()
		batchRequestsInProgress := make([]string, 0, len(occupiedTokens))
		for batchRequestId := range occupiedTokens {
			batchRequestsInProgress = append(batchRequestsInProgress, batchRequestId)
		}
		queuedBatchRequests, totalQueuedBatchRequestCount, err := fetchQueuedBatchRequests(batchRequestsInProgress, taskPool.LeftSlots())

		if err != nil {
			logrus.Errorf("Failed to fetch queued batch requests: %v", err)
			continue
		}

		// Just to not spam logs
		if len(queuedBatchRequests) == 0 {
			continue
		}

		logrus.Infof("Fetched %d queued batch requests out of %d total queued batch requests", len(queuedBatchRequests), totalQueuedBatchRequestCount)

		for _, queuedBatchRequestId := range queuedBatchRequests {
			if !taskPool.AddTask(func(ctx context.Context) {
				err := createZipFromBatchRequest(queuedBatchRequestId)
				updateBatchRequestStatus(queuedBatchRequestId, err)
			}, queuedBatchRequestId) {
				logrus.Warnf("Could not add task to process batch request with id: %s, no available slots or token already occupied", queuedBatchRequestId)
			}
		}
	}
}

func fetchQueuedBatchRequests(batchRequestsInProgress []string, limit int) ([]string, int, error) {
	if len(batchRequestsInProgress) == 0 {
		batchRequestsInProgress = []string{uuid.Nil.String()}
	}

	namedArgs := map[string]interface{}{
		"status":                  models.BatchRequestStatusQueued,
		"batchRequestsInProgress": batchRequestsInProgress,
		"limit":                   limit,
	}
	whereClause := `
    WHERE status = :status
      AND created_at >= NOW() - INTERVAL '12 HOURS'
      AND id NOT IN (:batchRequestsInProgress)
  `
	query, args, err := sqlx.Named(
		`SELECT id FROM batch_request `+whereClause+` ORDER BY created_at DESC LIMIT :limit`,
		namedArgs,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build query: %w", err)
	}

	query, args, err = sqlx.In(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build in clause in query: %w", err)
	}

	query = database.Connection.Rebind(query)

	queuedBatchRequests := []struct {
		Id uuid.UUID `db:"id"`
	}{}
	err = database.Connection.Select(&queuedBatchRequests, query, args...)

	if err != nil {
		return nil, 0, fmt.Errorf("failed to select queued batch requests: %w", err)
	}

	queuedBatchRequestIds := make([]string, 0, len(queuedBatchRequests))
	for _, batchRequest := range queuedBatchRequests {
		queuedBatchRequestIds = append(queuedBatchRequestIds, batchRequest.Id.String())
	}

	countQuery, args, err := sqlx.Named(`SELECT COUNT(*) FROM batch_request `+whereClause, namedArgs)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build count query: %w", err)
	}

	countQuery, args, err = sqlx.In(countQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build in clause in count query: %w", err)
	}

	countQuery = database.Connection.Rebind(countQuery)

	var totalQueuedBatchRequestCount int
	err = database.Connection.Get(&totalQueuedBatchRequestCount, countQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count queued batch requests: %w", err)
	}

	return queuedBatchRequestIds, totalQueuedBatchRequestCount, nil
}

func createZipFromBatchRequest(batchRequestId string) error {
	logrus.Infof("Processing batch request with id: %s", batchRequestId)

	query := `SELECT convert_requests FROM batch_request WHERE id = $1`
	var convertRequestsJSON []byte
	if err := database.Connection.QueryRow(query, batchRequestId).Scan(
		&convertRequestsJSON,
	); err != nil {
		return fmt.Errorf("failed to fetch batch convert requests: %w", err)
	}

	var batchRequest struct {
		ConvertRequests []struct {
			Id       string `json:"id"`
			FileName string `json:"file_name"`
		}
	}
	if err := json.Unmarshal(convertRequestsJSON, &batchRequest.ConvertRequests); err != nil {
		return fmt.Errorf("failed to unmarshal batch convert requests: %w", err)
	}

	zipFilePath := filepath.Join(config.Config.UploadsFolderAbsolutePath, fmt.Sprintf("%s.zip", batchRequestId))
	zipFile, err := os.Create(zipFilePath)
	if err != nil {
		return fmt.Errorf("failed to create zip file: %w", err)
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)

	for _, convertRequest := range batchRequest.ConvertRequests {
		filePath := filepath.Join(config.Config.UploadsFolderAbsolutePath, fmt.Sprintf("%s_converted", convertRequest.Id))
		file, err := os.Open(filePath)
		if os.IsNotExist(err) {
			fmt.Printf("File to batch %s does not exist, skipping\n", filePath)
			continue
		}
		if err != nil {
			return fmt.Errorf("failed to open file: %w", err)
		}
		defer file.Close()

		zipFileWriter, err := zipWriter.Create(fmt.Sprintf("%s.pdf", convertRequest.FileName))
		if err != nil {
			return fmt.Errorf("failed to create zip entry: %w", err)
		}

		if _, err := io.Copy(zipFileWriter, file); err != nil {
			return fmt.Errorf("failed to write file to zip: %w", err)
		}
	}

	if err := zipWriter.Close(); err != nil {
		return fmt.Errorf("failed to close zip writer: %w", err)
	}

	logrus.Infof("Batch request %s processed successfully", batchRequestId)
	return nil
}

func updateBatchRequestStatus(batchRequestId string, err error) {
	if err == nil {
		_, err := database.Connection.Exec(
			"UPDATE batch_request SET status = $1, batched_at = $2 WHERE id = $3",
			models.BatchRequestStatusDone,
			"NOW()",
			batchRequestId,
		)
		if err != nil {
			logrus.Errorf("Failed to update status of batch request with id: %s, error: %s\n", batchRequestId, err)
		}
		return
	}

	logrus.Errorf("Failed to process batch request with id: %s, error: %s\n", batchRequestId, err)

	errorMessage := err.Error()
	if len(errorMessage) > 1000 {
		errorMessage = errorMessage[:1000]
	}

	_, err = database.Connection.Exec(
		"UPDATE batch_request SET status = $1, error = $2 WHERE id = $3",
		models.BatchRequestStatusError,
		errorMessage,
		batchRequestId,
	)

	if err != nil {
		logrus.Errorf("Failed to update status of batch request with id: %s, error: %s\n", batchRequestId, err)
	}
}
