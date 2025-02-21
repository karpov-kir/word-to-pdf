package background

import (
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
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

func ProcessQueuedConvertRequests(taskPool *utils.TaskPool) {
	logrus.Infof("Polling queued convert requests to process from DB every %s", config.Config.PollQueuedConvertRequestsInterval)

	for {
		time.Sleep(config.Config.PollQueuedConvertRequestsInterval)

		if taskPool.LeftSlots() == 0 {
			logrus.Info("No available slots for new tasks, skipping fetching queued convert requests")
			continue
		}

		convertRequestsInProgress := make([]string, len(taskPool.OccupiedTokens()))
		for convertRequestId := range taskPool.OccupiedTokens() {
			convertRequestsInProgress = append(convertRequestsInProgress, convertRequestId)
		}
		queuedConvertRequests, totalQueuedConvertRequestCount, err := fetchQueuedConvertRequests(convertRequestsInProgress, taskPool.LeftSlots())

		if err != nil {
			logrus.Errorf("Failed to fetch queued convert requests: %v", err)
			continue
		}

		// Just to not spam logs
		if len(queuedConvertRequests) == 0 {
			continue
		}

		logrus.Infof("Fetched %d queued convert requests out of %d total queued convert requests", len(queuedConvertRequests), totalQueuedConvertRequestCount)

		for _, queuedConvertRequestId := range queuedConvertRequests {
			if !taskPool.AddTask(func(ctx context.Context) {
				err := convertWordToPdf(queuedConvertRequestId)
				updateConvertRequestStatus(queuedConvertRequestId, err)
			}, queuedConvertRequestId) {
				logrus.Warnf("Could not add task to process convert request with id: %s, no available slots or token already occupied", queuedConvertRequestId)
			}
		}
	}
}

func fetchQueuedConvertRequests(convertRequestsInProgress []string, limit int) ([]string, int, error) {
	if len(convertRequestsInProgress) == 0 {
		convertRequestsInProgress = []string{uuid.Nil.String()}
	}

	namedArgs := map[string]interface{}{
		"status":                    models.ConvertRequestStatusQueued,
		"convertRequestsInProgress": convertRequestsInProgress,
		"limit":                     limit,
	}
	whereClause := `
    WHERE status = :status
      AND created_at >= NOW() - INTERVAL '12 HOURS'
      AND id NOT IN (:convertRequestsInProgress)
  `
	query, args, err := sqlx.Named(
		`SELECT id FROM convert_requests `+whereClause+` ORDER BY created_at DESC LIMIT :limit`,
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

	queuedConvertRequests := []struct {
		Id uuid.UUID `db:"id"`
	}{}
	err = database.Connection.Select(&queuedConvertRequests, query, args...)

	if err != nil {
		return nil, 0, err
	}

	queuedConvertRequestIds := make([]string, 0, len(queuedConvertRequests))
	for _, convertRequest := range queuedConvertRequests {
		queuedConvertRequestIds = append(queuedConvertRequestIds, convertRequest.Id.String())
	}

	countQuery, args, err := sqlx.Named(`SELECT COUNT(*) FROM convert_requests `+whereClause, namedArgs)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build count query: %w", err)
	}

	countQuery, args, err = sqlx.In(countQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build in clause in count query: %w", err)
	}

	countQuery = database.Connection.Rebind(countQuery)

	var totalQueuedConvertRequestCount int
	err = database.Connection.Get(&totalQueuedConvertRequestCount, countQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count queued convert requests: %w", err)
	}

	return queuedConvertRequestIds, totalQueuedConvertRequestCount, nil
}

func convertWordToPdf(convertRequestId string) error {
	logrus.Infof("Processing convertRequest with id: %s", convertRequestId)

	originalFilePath := filepath.Join(utils.GetFilesDirAbsolutePath(), convertRequestId)
	originalFile, err := os.Open(originalFilePath)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer originalFile.Close()

	pipeRead, pipeWrite := io.Pipe()
	multipartWriter := multipart.NewWriter(pipeWrite)

	go func() {
		defer pipeWrite.Close()
		defer multipartWriter.Close()

		multipartFileWriter, err := multipartWriter.CreateFormFile("document", "dummy-file-name")
		if err != nil {
			pipeWrite.CloseWithError(fmt.Errorf("failed to start transferring data form file: %w", err))
			return
		}

		_, err = io.Copy(multipartFileWriter, originalFile)
		if err != nil {
			pipeWrite.CloseWithError(fmt.Errorf("failed to transfer file content: %w", err))
			return
		}
	}()

	docxToPdfRequest, err := http.NewRequest("POST", config.Config.DocxToPdfApiUrl+"/pdf", pipeRead)
	if err != nil {
		return fmt.Errorf("failed to create DOCX to PDF request: %w", err)
	}
	docxToPdfRequest.Header.Set("Content-Type", multipartWriter.FormDataContentType())

	httpClient := &http.Client{}
	resp, err := httpClient.Do(docxToPdfRequest)
	if err != nil {
		return fmt.Errorf("failed to send DOCX to PDF request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to convert file, status code: %d", resp.StatusCode)
	}

	convertedFilePath := filepath.Join(utils.GetFilesDirAbsolutePath(), fmt.Sprintf("%s_converted", convertRequestId))
	convertedFile, err := os.Create(convertedFilePath)
	if err != nil {
		return fmt.Errorf("failed to create output file: %w", err)
	}
	defer convertedFile.Close()

	_, err = io.Copy(convertedFile, resp.Body)
	if err != nil {
		return fmt.Errorf("failed to save converted file: %w", err)
	}

	logrus.Infof("File from convert request %s converted successfully", convertRequestId)

	return nil
}

func updateConvertRequestStatus(convertRequestId string, err error) {
	if err == nil {
		_, err := database.Connection.Exec(
			"UPDATE convert_requests SET status = $1, converted_at = $2 WHERE id = $3",
			models.ConvertRequestStatusDone,
			"NOW()",
			convertRequestId,
		)
		if err != nil {
			logrus.Errorf("Failed to update status of convert request with id: %s, error: %s\n", convertRequestId, err)
		}
		return
	}

	logrus.Errorf("Failed to process convertRequest with id: %s, error: %s\n", convertRequestId, err)

	errorMessage := err.Error()
	if len(errorMessage) > 1000 {
		errorMessage = errorMessage[:1000]
	}

	_, err = database.Connection.Exec(
		"UPDATE convert_requests SET status = $1, error = $2 WHERE id = $3",
		models.ConvertRequestStatusError,
		errorMessage,
		convertRequestId,
	)

	if err != nil {
		logrus.Errorf("Failed to update status of convert request with id: %s, error: %s\n", convertRequestId, err)
	}
}
