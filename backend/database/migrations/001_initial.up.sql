CREATE TYPE convert_request_status_enum AS ENUM ('queued', 'done', 'error');

CREATE TABLE IF NOT EXISTS convert_requests (
	id UUID PRIMARY KEY,
	file_name VARCHAR(250) NOT NULL,
  file_size BIGINT NOT NULL,
	created_at TIMESTAMP NOT NULL,
	status convert_request_status_enum NOT NULL,
	user_id UUID NOT NULL,
	is_file_deleted BOOLEAN NOT NULL DEFAULT FALSE,
	converted_at TIMESTAMP,
	error VARCHAR(1000)
);

CREATE INDEX idx_convert_requests_status_queued ON convert_requests (status) WHERE status = 'queued';
CREATE INDEX idx_convert_requests_is_file_deleted_false ON convert_requests (is_file_deleted) WHERE is_file_deleted = FALSE;
CREATE INDEX idx_convert_requests_user_id ON convert_requests (user_id);

CREATE TYPE batch_request_status_enum AS ENUM ('queued', 'error', 'done');

CREATE TABLE IF NOT EXISTS batch_request (
	id UUID PRIMARY KEY,
	convert_requests JSONB NOT NULL,
	status batch_request_status_enum NOT NULL,
	is_batch_deleted BOOLEAN NOT NULL DEFAULT FALSE,
	created_at TIMESTAMP NOT NULL,
	error VARCHAR(1000),
	batched_at TIMESTAMP,
	user_id UUID NOT NULL,
  batched_file_count INT
);

CREATE INDEX idx_batch_request_status_queued ON batch_request (status) WHERE status = 'queued';
CREATE INDEX idx_batch_request_is_batch_deleted_false ON batch_request (is_batch_deleted) WHERE is_batch_deleted = FALSE;
CREATE INDEX idx_batch_request_user_id ON batch_request (user_id);
