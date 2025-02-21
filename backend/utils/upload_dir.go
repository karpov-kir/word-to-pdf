package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/sirupsen/logrus"
)

// Points to `../uploads`
var uploadDirAbsolutePath string

func InitFilesFolder() {
	_, currentFileAbsolutePath, _, _ := runtime.Caller(0)
	currentDirAbsolutePath := filepath.Dir(currentFileAbsolutePath)

	var err error
	uploadDirAbsolutePath, err = filepath.Abs(filepath.Join(currentDirAbsolutePath, "../uploads"))
	if err != nil {
		fmt.Println("Failed to get absolute path to uploads folder:", err)
	}

	logrus.Info("Initializing uploads folder at: ", uploadDirAbsolutePath)

	if err := os.MkdirAll(uploadDirAbsolutePath, os.ModePerm); err != nil {
		fmt.Println("Failed to create uploads folder:", err)
	}
}

func GetFilesDirAbsolutePath() string {
	if uploadDirAbsolutePath == "" {
		logrus.Panic("Uploads folder is not initialized")
	}

	return uploadDirAbsolutePath
}
