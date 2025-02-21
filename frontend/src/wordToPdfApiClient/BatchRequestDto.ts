export interface BatchRequestDto {
  id: string;
  status: 'queued' | 'batching' | 'done' | 'error';
  error?: string;
  batchedFileCount?: number;
  createdAt: number;
  batchedAt?: number;
}
