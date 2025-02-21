package endpoint_handlers

import (
	"fmt"
	"io"
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

type ConvertRequestsHandler struct {
	TaskPool *utils.TaskPool
}

func (h *ConvertRequestsHandler) GetConvertRequestsByIds(c *fiber.Ctx) error {
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
      SELECT id, file_name, file_size, status, error, converted_at, created_at
      FROM convert_requests WHERE id IN (:ids)
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

	var convertRequests []models.ConvertRequest
	if err := database.Connection.Select(&convertRequests, query, args...); err != nil {
		return fmt.Errorf("failed to fetch convert requests: %w", err)
	}

	for i := range convertRequests {
		if h.TaskPool.IsOccupied(convertRequests[i].Id.String()) {
			convertRequests[i].Status = models.ConvertRequestStatusConverting
		}
	}

	return c.JSON(convertRequests)
}

func (h *ConvertRequestsHandler) DownloadConvertedFile(c *fiber.Ctx) error {
	convertRequestId := c.Params("id")

	logrus.Info("Downloading file from convert request: ", convertRequestId)

	var convertRequest struct {
		Id       string `db:"id"`
		FileName string `db:"file_name"`
	}

	query, args, err := sqlx.Named(
		`
    SELECT id, file_name
    FROM convert_requests WHERE id = :id
  `,
		map[string]interface{}{
			"id": convertRequestId,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to create query: %w", err)
	}
	query = database.Connection.Rebind(query)

	if err := database.Connection.Get(&convertRequest, query, args...); err != nil {
		return fmt.Errorf("failed to fetch convert request: %w", err)
	}

	filePath := filepath.Join(config.Config.UploadsFolderAbsolutePath, fmt.Sprintf("%s_converted", convertRequest.Id))

	logrus.Info("Streaming file of convert request: ", convertRequestId)
	return c.Download(filePath, convertRequest.FileName+".pdf")
}

func CreateConvertRequest(c *fiber.Ctx) error {
	userId := c.Locals("userId").(string)

	logrus.Infof("New request to convert a file from user %s", userId)

	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString(fmt.Sprintf("Failed to parse form: %v", err))
	}

	files := form.File["file"]
	if len(files) == 0 {
		return c.Status(fiber.StatusBadRequest).SendString("No file uploaded")
	}

	file := files[0]
	if len(file.Filename) > 250 {
		return c.Status(fiber.StatusBadRequest).SendString("File name too long")
	} else if len(file.Filename) == 0 {
		return c.Status(fiber.StatusBadRequest).SendString("Missing file name")
	}

	incomingFileReader, err := file.Open()
	if err != nil {
		return fmt.Errorf("failed to open file stream: %w", err)
	}
	defer incomingFileReader.Close()

	id, err := uuid.NewV7()
	if err != nil {
		return fmt.Errorf("failed to generate UUID: %w", err)
	}

	localFileWriter, err := os.Create(filepath.Join(config.Config.UploadsFolderAbsolutePath, id.String()))
	if err != nil {
		return fmt.Errorf("failed to create file on server: %w", err)
	}
	defer localFileWriter.Close()

	logrus.Infof("Saving file %s to %s", file.Filename, id.String())
	if _, err := io.Copy(localFileWriter, incomingFileReader); err != nil {
		return fmt.Errorf("failed to save file: %w", err)
	}
	logrus.Infof("File %s saved to %s", file.Filename, id.String())

	convertRequestPayload := map[string]interface{}{
		"id":         id,
		"file_name":  file.Filename,
		"file_size":  file.Size,
		"status":     models.ConvertRequestStatusQueued,
		"user_id":    userId,
		"created_at": "NOW()",
	}
	rows, err := database.Connection.NamedQuery(
		`
      INSERT INTO convert_requests (id, file_name, file_size, created_at, status, user_id)
      VALUES (:id, :file_name, :file_size, :created_at, :status, :user_id)
      RETURNING id, file_name, file_size, status, created_at
    `,
		convertRequestPayload,
	)
	if err != nil {
		return fmt.Errorf("failed to insert convert request into DB: %w", err)
	}
	defer rows.Close()

	var convertRequest models.ConvertRequest

	if rows.Next() {
		rows.Scan(
			&convertRequest.Id,
			&convertRequest.FileName,
			&convertRequest.FileSize,
			&convertRequest.Status,
			&convertRequest.CreatedAt,
		)
	}

	logrus.Infof("Convert request %s created successfully", convertRequest.Id)

	return c.JSON(convertRequest)
}
