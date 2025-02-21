package config

import (
	"os"
	"reflect"
	"strconv"
	"time"

	"github.com/sirupsen/logrus"
)

var Config = &struct {
	DocxToPdfApiUrl string

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
}{}

func Init() {
	/* #region PRODUCTION */
	Config.DocxToPdfApiUrl = os.Getenv("DOC_TO_PDF_API_URL")

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

	Config.DatabaseHost = os.Getenv("DATABASE_HOST")
	Config.DatabasePort = os.Getenv("DATABASE_PORT")
	Config.DatabaseUser = os.Getenv("DATABASE_USER")
	Config.DatabasePassword = os.Getenv("DATABASE_PASSWORD")
	Config.DatabaseName = os.Getenv("DATABASE_NAME")
	Config.DatabaseSslMode = os.Getenv("DATABASE_SSL_MODE")
	/* #endregion */

	/* #region DEVELOPMENT */
	if os.Getenv("ENV") == "development" {
		Config.DocxToPdfApiUrl = "http://localhost:8085"

		Config.PollQueuedConvertRequestsInterval = 10 * time.Second
		Config.ParallelConvertLimit = 15

		Config.PollBatchRequestsInterval = 10 * time.Second
		Config.ParallelBatchLimit = 15

		Config.DeleteOldFilesInterval = 30 * time.Second
		Config.DeleteOldFilesThreshold = 1 * time.Minute

		Config.DatabaseHost = "localhost"
		Config.DatabasePort = "5432"
		Config.DatabaseUser = "postgres"
		Config.DatabasePassword = "postgres"
		Config.DatabaseName = "postgres"
		Config.DatabaseSslMode = "disable"
	}
	/* #endregion */

	if Config.DeleteOldFilesThreshold < time.Duration(1*time.Minute) {
		logrus.Panic("DeleteOldFilesThreshold should be at least 1 minute")
	}

	logConfig(Config)
}

func logConfig(config interface{}) {
	logFields := logrus.Fields{}
	val := reflect.ValueOf(config).Elem()

	logrus.Info("Config initialized")

	for i := 0; i < val.NumField(); i++ {
		fieldName := val.Type().Field(i).Name
		fieldValue := val.Field(i).Interface()

		// Exclude sensitive fields
		if fieldName == "DatabasePassword" {
			fieldValue = "*****"
		}

		logFields[fieldName] = fieldValue
		logrus.Info(fieldName, ": ", fieldValue)
	}
}
