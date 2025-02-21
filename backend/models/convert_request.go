package models

import (
	"encoding/json"
	"time"

	"github.com/gofrs/uuid/v5"
)

type ConvertRequestStatus string

const (
	ConvertRequestStatusQueued     ConvertRequestStatus = "queued"
	ConvertRequestStatusDone       ConvertRequestStatus = "done"
	ConvertRequestStatusError      ConvertRequestStatus = "error"
	ConvertRequestStatusConverting ConvertRequestStatus = "converting"
)

type ConvertRequest struct {
	Id          uuid.UUID            `db:"id" json:"id"`
	FileName    string               `db:"file_name" json:"fileName"`
	Status      ConvertRequestStatus `db:"status" json:"status"`
	ConvertedAt *time.Time           `db:"converted_at" json:"convertedAt"`
	CreatedAt   time.Time            `db:"created_at" json:"createdAt"`
	FileSize    int64                `db:"file_size" json:"fileSize"`
	Error       *string              `db:"error" json:"error"`
}

func (c ConvertRequest) MarshalJSON() ([]byte, error) {
	type Alias ConvertRequest
	return json.Marshal(&struct {
		ConvertedAt *int64 `json:"convertedAt"`
		CreatedAt   int64  `json:"createdAt"`
		*Alias
	}{
		ConvertedAt: func() *int64 {
			if c.ConvertedAt != nil {
				t := c.ConvertedAt.Unix() * 1000
				return &t
			}
			return nil
		}(),
		CreatedAt: c.CreatedAt.Unix() * 1000,
		Alias:     (*Alias)(&c),
	})
}
