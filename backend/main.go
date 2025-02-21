package main

import (
	"context"
	"math"
	"net"
	"os"
	"os/signal"
	"syscall"
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

	app.Use(LogrusMiddleware())

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

	serverStartErrorChannel := make(chan error)
	go func() {
		netListener, err := net.Listen("tcp", ":3030")
		if err != nil {
			logrus.Errorf("Failed to start server: %v", err)
			serverStartErrorChannel <- err
			return
		}
		logrus.Info("Server started at :3030")
		if err := app.Listener(netListener); err != nil {
			logrus.Errorf("Failed to start server: %v", err)
			serverStartErrorChannel <- err
		}
	}()

	signalChannel := make(chan os.Signal, 1)
	signal.Notify(signalChannel, syscall.SIGINT, syscall.SIGTERM)

	select {
	case <-signalChannel:
		logrus.Info("Received signal, shutting down...")
	case err := <-serverStartErrorChannel:
		logrus.Errorf("Could not start server: %v", err)
	}

	logrus.Info("Shutting down server...")
	if err := app.Shutdown(); err != nil {
		logrus.Errorf("Failed to shut down server: %v", err)
	}
}

func LogrusMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next() // Proceed to the next handler
		logrus.Infof("[%d] %s %s - %s", c.Response().StatusCode(), c.Method(), c.Path(), time.Since(start))
		return err
	}
}
