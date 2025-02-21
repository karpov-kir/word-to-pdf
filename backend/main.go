package main

import (
	"context"
	"math"
	_ "net/http/pprof"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/karpov-kir/word-to-pdf/backend/auth"
	"github.com/karpov-kir/word-to-pdf/backend/background"
	"github.com/karpov-kir/word-to-pdf/backend/config"
	"github.com/karpov-kir/word-to-pdf/backend/database"
	eh "github.com/karpov-kir/word-to-pdf/backend/endpoint_handlers"
	"github.com/karpov-kir/word-to-pdf/backend/utils"
	"github.com/sirupsen/logrus"
)

func main() {
	config.Init()
	ctx := context.Background()

	if err := database.InitDb(); err != nil {
		logrus.Errorf("Failed to initialize database: %v", err)
		return
	}
	defer database.CloseDb()

	convertRequestsTaskPool := utils.NewTaskPool(ctx, config.Config.ParallelConvertLimit)
	convertRequestsTaskPool.Start()
	defer convertRequestsTaskPool.Stop()

	go background.ProcessQueuedConvertRequests(convertRequestsTaskPool)
	go background.StartDeletingOldConvertRequestFiles()

	batchRequestsTaskPool := utils.NewTaskPool(ctx, config.Config.ParallelBatchLimit)
	batchRequestsTaskPool.Start()
	defer batchRequestsTaskPool.Stop()
	go background.StartDeletingOldBatchRequestFiles()
	go background.ProcessBatchRequests(batchRequestsTaskPool)

	app := fiber.New(
		fiber.Config{
			// Controlled by the frontend server
			BodyLimit: math.MaxInt,
		},
	)

	app.Use(logrusMiddleware())

	convertRequestsHandler := &eh.ConvertRequestsHandler{TaskPool: convertRequestsTaskPool}
	batchRequestsHandler := &eh.BatchRequestsHandler{TaskPool: batchRequestsTaskPool}

	app.Get("/", eh.LifeCheck)
	app.Post("/auth/token", eh.CreateToken)

	app.Get("/download/pdf/:id", convertRequestsHandler.DownloadConvertedFile)
	app.Get("/download/pdf-batch/:id", batchRequestsHandler.DownloadBatchFile)

	app.Use(auth.JWTMiddleware())
	app.Post("/convert-requests/create", eh.CreateConvertRequest)
	app.Post("/convert-requests/by-ids", convertRequestsHandler.GetConvertRequestsByIds)

	app.Post("/batch-requests/create", batchRequestsHandler.CreateBatchRequest)
	app.Post("/batch-requests/by-ids", batchRequestsHandler.GetBatchRequestsByIds)

	logrus.Fatal(app.Listen(":3030"))
}

func logrusMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		duration := time.Since(start)
		status := c.Response().StatusCode()
		logWithFields := logrus.WithFields(logrus.Fields{
			"status":   status,
			"method":   c.Method(),
			"path":     c.Path(),
			"duration": duration,
		})

		if err != nil {
			logWithFields.WithField("error", err).Error("")
		} else if status >= 400 {
			logWithFields.Error("", status)
		} else {
			logWithFields.Info("")
		}

		return err
	}
}
