package utils

import (
	"context"
	"fmt"
	"sync"

	"github.com/sirupsen/logrus"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

func startDocxToPdfContainer(ctx context.Context) (testcontainers.Container, string, error) {
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		Reuse: true,
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "moalhaddar/docx-to-pdf:2.1.0-12",
			ExposedPorts: []string{"8080/tcp"},
			WaitingFor:   wait.ForListeningPort("8080/tcp"),
			Name:         "word-to-pdf-dev-docx-to-pdf",
			Env: map[string]string{
				"pool.size": "2",
			},
		},
		Started: true,
	})

	if err != nil {
		return nil, "", fmt.Errorf("failed to start container: %w", err)
	}

	docxToPdListenedAt, err := container.Endpoint(ctx, "")
	if err != nil {
		return container, "", fmt.Errorf("failed to get container endpoint: %w", err)
	}

	return container, docxToPdListenedAt, nil
}

func startPostgresContainer(ctx context.Context) (testcontainers.Container, string, error) {
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		Reuse: true,
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "postgres:17",
			ExposedPorts: []string{"5432/tcp"},
			Env: map[string]string{
				"POSTGRES_USER":     "postgres",
				"POSTGRES_PASSWORD": "postgres",
				"POSTGRES_DB":       "postgres",
			},
			WaitingFor: wait.ForListeningPort("5432/tcp"),
			Name:       "word-to-pdf-dev-postgres",
		},
		Started: true,
	})

	if err != nil {
		return nil, "", fmt.Errorf("failed to start container: %w", err)
	}

	postgresListenedAt, err := container.Endpoint(ctx, "")
	if err != nil {
		return container, "", fmt.Errorf("failed to get container endpoint: %w", err)
	}

	return container, postgresListenedAt, nil
}

func StartDevContainers(ctx context.Context) (func(), string, string) {
	var wg sync.WaitGroup
	var docxToPdfContainer testcontainers.Container
	var docxToPdListenedAt string
	var postgresContainer testcontainers.Container
	var postgresDevHostAndPort string
	var err error

	wg.Add(2)

	go func() {
		defer wg.Done()
		fmt.Println("Starting docx-to-pdf dev container")
		docxToPdfContainer, docxToPdListenedAt, err = startDocxToPdfContainer(ctx)
		if err != nil {
			logrus.Panic(fmt.Errorf("failed to start docx-to-pdf container: %w", err))
		}
	}()

	go func() {
		defer wg.Done()
		fmt.Println("Starting Postgres dev container")
		postgresContainer, postgresDevHostAndPort, err = startPostgresContainer(ctx)
		if err != nil {
			logrus.Panic(fmt.Errorf("failed to start postgres container: %w", err))
		}
	}()

	wg.Wait()

	docxToPdfDevUrl := "http://" + docxToPdListenedAt

	var closeContainers = func() {
		defer postgresContainer.Terminate(ctx)
		defer docxToPdfContainer.Terminate(ctx)
	}

	return closeContainers, docxToPdfDevUrl, postgresDevHostAndPort
}
