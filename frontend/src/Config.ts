import parseDuration from 'parse-duration';

export class Config {
  env: 'production' | 'development' | 'staging';
  wordToPdfApiBaseUrl: string;

  pollConvertRequestsInProgressIntervalMs: number;
  pollBatchRequestsInProgressIntervalMs: number;

  conversionLimit: number;
  conversionLimitReadable: string;
  batchLimit: number;
  batchLimitReadable: string;

  filesTtlMs: number;
  maxFileSizeBytes: number;

  constructor() {
    this.env = import.meta.env.WORD_TO_PDF_ENV as 'production' | 'development' | 'staging';
    this.wordToPdfApiBaseUrl = import.meta.env.WORD_TO_PDF_API_URL;

    this.pollConvertRequestsInProgressIntervalMs = parseDurationString(
      import.meta.env.WORD_TO_PDF_POLL_CONTENT_REQUESTS_IN_PROGRESS_INTERVAL,
    );
    this.pollBatchRequestsInProgressIntervalMs = parseDurationString(
      import.meta.env.WORD_TO_PDF_POLL_BATCH_REQUESTS_IN_PROGRESS_INTERVAL,
    );

    this.conversionLimit = parseInt(import.meta.env.WORD_TO_PDF_CONVERSION_LIMIT);
    this.conversionLimitReadable = import.meta.env.WORD_TO_PDF_CONVERSION_LIMIT_INTERVAL_READABLE;

    this.batchLimit = parseInt(import.meta.env.WORD_TO_PDF_BATCH_LIMIT);
    this.batchLimitReadable = import.meta.env.WORD_TO_PDF_CONVERSION_LIMIT_INTERVAL_READABLE;

    this.maxFileSizeBytes = parseInt(import.meta.env.WORD_TO_PDF_MAX_FILE_SIZE_BYTES);
    this.filesTtlMs = parseDurationString(import.meta.env.WORD_TO_PDF_FILES_TTL);

    console.log('Config initialized', this);
  }
}

export const config = new Config();

function parseDurationString(durationString: string): number {
  const durationMs = parseDuration(durationString);

  if (!durationMs) {
    throw new Error(`Failed to parse duration string: ${durationString}`);
  }

  return durationMs;
}
