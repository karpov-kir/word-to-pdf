export interface ConvertRequestDto {
  id: string;
  status: 'queued' | 'converting' | 'done' | 'error';
  error?: string;
  fileName: string;
  fileSize: number;
  createdAt: number;
  convertedAt?: number;
}
