package endpoint_handlers

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/gofiber/fiber/v2"
	"github.com/gofrs/uuid/v5"
	"github.com/jmoiron/sqlx"
	"github.com/karpov-kir/word-to-pdf/backend/config"
	"github.com/karpov-kir/word-to-pdf/backend/database"
	"github.com/karpov-kir/word-to-pdf/backend/models"
	"github.com/karpov-kir/word-to-pdf/backend/utils"
	"github.com/sirupsen/logrus"
)

type BatchRequestsHandler struct {
	TaskPool *utils.TaskPool
}

func (h *BatchRequestsHandler) CreateBatchRequest(c *fiber.Ctx) error {
	userId := c.Locals("userId").(string)

	var request struct {
		ConvertRequestIds []uuid.UUID `json:"convertRequestIds"`
	}

	if err := c.BodyParser(&request); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Failed to parse request body",
		})
	}

	if len(request.ConvertRequestIds) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "No convert request IDs provided",
		})
	}

	if len(request.ConvertRequestIds) > 200 {
		logrus.Warnf("Too many convert request IDs provided: %d, truncating to 200", len(request.ConvertRequestIds))
		request.ConvertRequestIds = request.ConvertRequestIds[len(request.ConvertRequestIds)-200:]
	}

	query, args, err := sqlx.Named(
		`
      SELECT id, file_name
      FROM convert_requests WHERE id IN (:ids)
    `,
		map[string]interface{}{
			"ids": request.ConvertRequestIds,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to create convert requests query: %w", err)
	}
	query, args, err = sqlx.In(query, args...)
	if err != nil {
		return fmt.Errorf("failed to build in clause in convert requests query: %w", err)
	}
	query = database.Connection.Rebind(query)

	var convertRequests []struct {
		Id       uuid.UUID `db:"id" json:"id"`
		FileName string    `db:"file_name" json:"file_name"`
	}
	if err := database.Connection.Select(&convertRequests, query, args...); err != nil {
		return fmt.Errorf("failed to fetch convert requests: %w", err)
	}

	id, err := uuid.NewV7()
	if err != nil {
		return fmt.Errorf("failed to generate UUID: %w", err)
	}

	convertRequestsJSON, err := json.Marshal(convertRequests)
	if err != nil {
		return fmt.Errorf("failed to marshal convert requests: %w", err)
	}

	batchRequestPayload := map[string]interface{}{
		"id":               id,
		"convert_requests": convertRequestsJSON,
		"status":           models.BatchRequestStatusQueued,
		"user_id":          userId,
		"created_at":       "NOW()",
	}
	rows, err := database.Connection.NamedQuery(
		`
      INSERT INTO batch_request (id, convert_requests, status, created_at, user_id)
      VALUES (:id, :convert_requests, :status, :created_at, :user_id)
      RETURNING id, status, created_at
    `,
		batchRequestPayload,
	)
	if err != nil {
		return fmt.Errorf("failed to insert batch request into DB: %w", err)
	}
	defer rows.Close()

	var batchRequest models.BatchRequest

	if rows.Next() {
		rows.Scan(
			&batchRequest.Id,
			&batchRequest.Status,
			&batchRequest.CreatedAt,
		)
	}

	return c.JSON(batchRequest)
}

func (h *BatchRequestsHandler) DownloadBatchFile(c *fiber.Ctx) error {
	batchRequestId := c.Params("id")

	logrus.Info("Downloading batch file from batch request: ", batchRequestId)

	var batchRequest struct {
		Id string `db:"id"`
	}

	query, args, err := sqlx.Named(
		`
    SELECT id
    FROM batch_request WHERE id = :id
  `,
		map[string]interface{}{
			"id": batchRequestId,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to create query: %w", err)
	}
	query = database.Connection.Rebind(query)

	if err := database.Connection.Get(&batchRequest, query, args...); err != nil {
		return fmt.Errorf("failed to fetch batch request: %w", err)
	}

	filePath := filepath.Join(config.Config.UploadsFolderAbsolutePath, fmt.Sprintf("%s.zip", batchRequest.Id))

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return c.Status(fiber.StatusNotFound).SendString("Batch file not found")
	}

	logrus.Info("Streaming batch file of batch request: ", batchRequestId)
	return c.Download(filePath, fmt.Sprintf("converted-documents-%s.zip", batchRequestId[len(batchRequestId)-5:]))
}

func (h *BatchRequestsHandler) GetBatchRequestsByIds(c *fiber.Ctx) error {
	var request struct {
		Ids []string `json:"ids"`
	}

	if err := c.BodyParser(&request); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Failed to parse request body",
		})
	}

	if len(request.Ids) == 0 {
		return c.JSON([]struct{}{})
	}

	if len(request.Ids) > 200 {
		request.Ids = request.Ids[len(request.Ids)-200:]
	}

	query, args, err := sqlx.Named(
		`
    SELECT id, status, created_at, batched_at, batched_file_count, error
    FROM batch_request WHERE id IN (:ids)
  `,
		map[string]interface{}{
			"ids": request.Ids,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to create query: %w", err)
	}
	query, args, err = sqlx.In(query, args...)
	if err != nil {
		return fmt.Errorf("failed to build in clause in query: %w", err)
	}
	query = database.Connection.Rebind(query)

	var batchRequests []models.BatchRequest
	if err := database.Connection.Select(&batchRequests, query, args...); err != nil {
		return fmt.Errorf("failed to fetch batch requests: %w", err)
	}

	for i := range batchRequests {
		if h.TaskPool.IsOccupied(batchRequests[i].Id.String()) {
			batchRequests[i].Status = models.BatchRequestStatusBatching
		}
	}

	return c.JSON(batchRequests)
}
