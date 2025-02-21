package models

import (
	"encoding/json"
	"time"

	"github.com/gofrs/uuid/v5"
)

type BatchRequestStatus string

const (
	BatchRequestStatusQueued   BatchRequestStatus = "queued"
	BatchRequestStatusDone     BatchRequestStatus = "done"
	BatchRequestStatusError    BatchRequestStatus = "error"
	BatchRequestStatusBatching BatchRequestStatus = "batching"
)

type BatchRequest struct {
	Id               uuid.UUID          `db:"id" json:"id"`
	Status           BatchRequestStatus `db:"status" json:"status"`
	BatchedAt        *time.Time         `db:"batched_at" json:"batchedAt,omitempty"`
	CreatedAt        time.Time          `db:"created_at" json:"createdAt"`
	Error            *string            `db:"error" json:"error,omitempty"`
	BatchedFileCount *int               `db:"batched_file_count" json:"batchedFileCount"`
}

func (bd BatchRequest) MarshalJSON() ([]byte, error) {
	type Alias BatchRequest
	return json.Marshal(&struct {
		BatchedAt *int64 `json:"batchedAt,omitempty"`
		CreatedAt int64  `json:"createdAt"`
		*Alias
	}{
		BatchedAt: func() *int64 {
			if bd.BatchedAt != nil {
				t := bd.BatchedAt.Unix() * 1000
				return &t
			}
			return nil
		}(),
		CreatedAt: bd.CreatedAt.Unix() * 1000,
		Alias:     (*Alias)(&bd),
	})
}
