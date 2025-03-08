import { ConvertRequestDto } from '../wordToPdfApiClient/ConvertRequestDto';

export enum EventTypes {
  WordDocumentSelected = 'word-document-selected',
  WordDocumentConverted = 'word-document-converted',
  BatchRequested = 'batch-requested',
  WakeServiceWorkerUp = 'wake-service-worker-up',
  UploadWordDocument = 'upload-word-document',
  WordDocumentUploadStatus = 'word-document-upload-status',
  CancelUploadWordDocument = 'cancel-upload-word-document',
}

export type WordDocumentSelectedEvent = {
  type: EventTypes.WordDocumentSelected;
  convertRequestBeingCreatedId: string;
  fileId: string;
  fileName: string;
  fileSize: number;
};

export type UploadWordDocumentEvent = {
  type: EventTypes.UploadWordDocument;
  accessToken: string;
  convertRequestBeingCreatedId: string;
  fileId: string;
  fileName: string;
};

export type WordDocumentUploadStatusEvent = {
  type: EventTypes.WordDocumentUploadStatus;
  uploadProgress: number;
  isCompleted: boolean;
  status?: number;
  convertRequestDto?: ConvertRequestDto;
  error?: string;
  convertRequestBeingCreatedId: string;
};

export type BatchRequestedEvent = {
  type: EventTypes.BatchRequested;
};

export type EnsureServiceWorkerAliveEvent = {
  type: EventTypes.WakeServiceWorkerUp;
};

export type CancelUploadWordDocumentEvent = {
  type: EventTypes.CancelUploadWordDocument;
  fileId: string;
};

export type Events =
  | WordDocumentSelectedEvent
  | BatchRequestedEvent
  | EnsureServiceWorkerAliveEvent
  | UploadWordDocumentEvent
  | WordDocumentUploadStatusEvent
  | CancelUploadWordDocumentEvent;
