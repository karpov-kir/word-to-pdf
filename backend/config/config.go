package config

import (
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strconv"
	"time"

	"github.com/sirupsen/logrus"
)

var Config = &struct {
	UseStructuredLogging bool
	LogLevel             logrus.Level

	DocxToPdfApiUrl string
	GotenbergApiUrl string

	PollQueuedConvertRequestsInterval time.Duration
	ParallelConvertLimit              int

	PollBatchRequestsInterval time.Duration
	ParallelBatchLimit        int

	DeleteOldFilesInterval  time.Duration
	DeleteOldFilesThreshold time.Duration

	DatabaseHost     string
	DatabasePort     string
	DatabaseUser     string
	DatabasePassword string
	DatabaseName     string
	DatabaseSslMode  string

	MigrationsFolderAbsolutePath string
	UploadsFolderAbsolutePath    string
}{
	UseStructuredLogging: false,
	LogLevel:             logrus.InfoLevel,

	DocxToPdfApiUrl: "http://localhost:8085",
	GotenbergApiUrl: "http://localhost:8090",

	PollQueuedConvertRequestsInterval: 5 * time.Second,
	ParallelConvertLimit:              15,

	PollBatchRequestsInterval: 5 * time.Second,
	ParallelBatchLimit:        15,

	DeleteOldFilesInterval:  30 * time.Second,
	DeleteOldFilesThreshold: 1 * time.Minute,

	DatabaseHost:     "localhost",
	DatabasePort:     "5432",
	DatabaseUser:     "word-to-pdf",
	DatabasePassword: "word-to-pdf",
	DatabaseName:     "word-to-pdf",
	DatabaseSslMode:  "disable",

	MigrationsFolderAbsolutePath: "",
	UploadsFolderAbsolutePath:    "",
}

func Init() {
	Config.UseStructuredLogging = os.Getenv("USE_STRUCTURED_LOGGING") == "true"

	if Config.UseStructuredLogging {
		logrus.SetFormatter(&logrus.JSONFormatter{})
	}

	if os.Getenv("LOG_LEVEL") != "" {
		logLevel, err := logrus.ParseLevel(os.Getenv("LOG_LEVEL"))
		if err != nil {
			logrus.WithError(err).Fatal("Failed to parse log level")
		}
		Config.LogLevel = logLevel
	}

	logrus.SetLevel(Config.LogLevel)

	if os.Getenv("DOC_TO_PDF_API_URL") != "" {
		Config.DocxToPdfApiUrl = os.Getenv("DOC_TO_PDF_API_URL")
	}

	if os.Getenv("GOTENBERG_API_URL") != "" {
		Config.GotenbergApiUrl = os.Getenv("GOTENBERG_API_URL")
	}

	if os.Getenv("POLL_QUEUED_CONVERT_REQUESTS_INTERVAL") != "" {
		pollQueuedFilesInterval, err := time.ParseDuration(os.Getenv("POLL_QUEUED_CONVERT_REQUESTS_INTERVAL"))
		if err != nil {
			logrus.Panic("Invalid POLL_QUEUED_CONVERT_REQUESTS_INTERVAL format")
		}

		Config.PollQueuedConvertRequestsInterval = pollQueuedFilesInterval
	}

	if os.Getenv("PARALLEL_CONVERT_LIMIT") != "" {
		parallelConvertLimit, err := strconv.Atoi(os.Getenv("PARALLEL_CONVERT_LIMIT"))
		if err != nil {
			logrus.Panic("Invalid PARALLEL_CONVERT_LIMIT format")
		}

		Config.ParallelConvertLimit = parallelConvertLimit
	}

	if os.Getenv("POLL_BATCH_REQUESTS_INTERVAL") != "" {
		pollBatchRequestsInterval, err := time.ParseDuration(os.Getenv("POLL_BATCH_REQUESTS_INTERVAL"))
		if err != nil {
			logrus.Panic("Invalid POLL_BATCH_REQUESTS_INTERVAL format")
		}

		Config.PollBatchRequestsInterval = pollBatchRequestsInterval
	}

	if os.Getenv("PARALLEL_BATCH_LIMIT") != "" {
		parallelBatchLimit, err := strconv.Atoi(os.Getenv("PARALLEL_BATCH_LIMIT"))
		if err != nil {
			logrus.Panic("Invalid PARALLEL_BATCH_LIMIT format")
		}

		Config.ParallelBatchLimit = parallelBatchLimit
	}

	if os.Getenv("DELETE_OLD_FILES_INTERVAL") != "" {
		deleteOldFilesInterval, err := time.ParseDuration(os.Getenv("DELETE_OLD_FILES_INTERVAL"))
		if err != nil {
			logrus.Panic("Invalid DELETE_OLD_FILES_INTERVAL format")
		}

		Config.DeleteOldFilesInterval = deleteOldFilesInterval
	}

	if os.Getenv("DELETE_OLD_FILES_THRESHOLD") != "" {
		deleteOldFilesThreshold, err := time.ParseDuration(os.Getenv("DELETE_OLD_FILES_THRESHOLD"))
		if err != nil {
			logrus.Panic("Invalid DELETE_OLD_FILES_THRESHOLD format")
		}

		Config.DeleteOldFilesThreshold = deleteOldFilesThreshold
	}

	if os.Getenv("DATABASE_HOST") != "" {
		Config.DatabaseHost = os.Getenv("DATABASE_HOST")
	}

	if os.Getenv("DATABASE_PORT") != "" {
		Config.DatabasePort = os.Getenv("DATABASE_PORT")
	}

	if os.Getenv("DATABASE_USER") != "" {
		Config.DatabaseUser = os.Getenv("DATABASE_USER")
	}

	if os.Getenv("DATABASE_PASSWORD") != "" {
		Config.DatabasePassword = os.Getenv("DATABASE_PASSWORD")
	}

	if os.Getenv("DATABASE_NAME") != "" {
		Config.DatabaseName = os.Getenv("DATABASE_NAME")
	}

	if os.Getenv("DATABASE_SSL_MODE") != "" {
		Config.DatabaseSslMode = os.Getenv("DATABASE_SSL_MODE")
	}

	_, currentFileAbsolutePath, _, _ := runtime.Caller(0)
	currentDirAbsolutePath := filepath.Dir(currentFileAbsolutePath)

	if os.Getenv("MIGRATIONS_FOLDER_ABSOLUTE_PATH") != "" {
		Config.MigrationsFolderAbsolutePath = os.Getenv("MIGRATIONS_FOLDER_ABSOLUTE_PATH")
	} else {
		Config.MigrationsFolderAbsolutePath = filepath.Join(currentDirAbsolutePath, "../database/migrations")
	}

	if os.Getenv("UPLOADS_FOLDER_ABSOLUTE_PATH") != "" {
		Config.UploadsFolderAbsolutePath = os.Getenv("UPLOADS_FOLDER_ABSOLUTE_PATH")
	} else {
		Config.UploadsFolderAbsolutePath = filepath.Join(currentDirAbsolutePath, "../uploads")
	}

	logrus.Info("Initializing uploads folder at: ", Config.UploadsFolderAbsolutePath)

	if err := os.MkdirAll(Config.UploadsFolderAbsolutePath, os.ModePerm); err != nil {
		fmt.Println("Failed to create uploads folder:", err)
	}

	if Config.DeleteOldFilesThreshold < time.Duration(1*time.Minute) {
		logrus.Panic("DeleteOldFilesThreshold should be at least 1 minute")
	}

	logConfig(Config)
}

func logConfig(config interface{}) {
	logFields := logrus.Fields{}
	val := reflect.ValueOf(config).Elem()

	logrus.Info("Config initialized")

	for i := range val.NumField() {
		fieldName := val.Type().Field(i).Name
		fieldValue := val.Field(i).Interface()

		// Exclude sensitive fields
		if fieldName == "DatabasePassword" {
			// fieldValue = "*****"
		}

		logFields[fieldName] = fieldValue
		logrus.Info(fieldName, ": ", fieldValue)
	}
}
