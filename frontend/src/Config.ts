export class Config {
  wordToPdfApiBaseUrl: string;
  pollConvertRequestsInProgressIntervalMs: number;
  pollBatchRequestsInProgressIntervalMs: number;
  filesTtlMs: number;
  conversionLimitPerHour: number;
  maxFileSizeBytes: number;
  batchLimitPerHour: number;

  constructor() {
    this.wordToPdfApiBaseUrl = import.meta.env.WORD_TO_PDF_API_URL;
    this.pollConvertRequestsInProgressIntervalMs = parseInt(
      import.meta.env.WORD_TO_PDF_POLL_CONTENT_REQUESTS_IN_PROGRESS_INTERVAL_MS,
    );
    this.pollBatchRequestsInProgressIntervalMs = parseInt(
      import.meta.env.WORD_TO_PDF_POLL_BATCH_REQUESTS_IN_PROGRESS_INTERVAL_MS,
    );
    this.filesTtlMs = parseInt(import.meta.env.WORD_TO_PDF_FILES_TTL_MS);
    this.conversionLimitPerHour = parseInt(import.meta.env.WORD_TO_PDF_CONVERSION_LIMIT_PER_HOUR);
    this.maxFileSizeBytes = parseInt(import.meta.env.WORD_TO_PDF_MAX_FILE_SIZE_BYTES);
    this.batchLimitPerHour = parseInt(import.meta.env.WORD_TO_PDF_BATCH_LIMIT_PER_HOUR);

    console.log('Config initialized', this);
  }
}

export const config = new Config();
