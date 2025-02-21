package database

import (
	"fmt"
	"time"

	m "github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jmoiron/sqlx"
	"github.com/karpov-kir/word-to-pdf/backend/config"
	_ "github.com/lib/pq"
	"github.com/sirupsen/logrus"
)

var (
	Connection *sqlx.DB
)

func InitDb() error {
	var err error
	connString := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		config.Config.DatabaseHost,
		config.Config.DatabasePort,
		config.Config.DatabaseUser,
		config.Config.DatabasePassword,
		config.Config.DatabaseName,
		config.Config.DatabaseSslMode,
	)
	logrus.Infof("Connecting to DB: %s", connString)
	Connection, err = sqlx.Connect("postgres", connString)
	if err != nil {
		return fmt.Errorf("failed to connect to DB: %w", err)
	}

	Connection.SetMaxOpenConns(5)
	Connection.SetMaxIdleConns(5)
	Connection.SetConnMaxLifetime(5 * time.Minute)

	driver, err := postgres.WithInstance(Connection.DB, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("failed to initialize DB driver: %w", err)
	}

	migrate, err := m.NewWithDatabaseInstance(
		"file://"+config.Config.MigrationsFolderAbsolutePath,
		"postgres",
		driver,
	)
	if err != nil {
		return fmt.Errorf("failed to initialize migration: %w", err)
	}

	logrus.Info("Running migrations")
	if err := migrate.Up(); err != nil && err != m.ErrNoChange {
		return fmt.Errorf("failed to run migration: %w", err)
	}

	return nil
}

func CloseDb() {
	if Connection != nil {
		Connection.Close()
	}
}
