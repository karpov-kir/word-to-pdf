import { ConvertRequestDto } from './wordToPdfApiClient/ConvertRequestDto';

export enum EventTypes {
  WordDocumentSelected = 'word-document-selected',
  WordDocumentConverted = 'word-document-converted',
  BatchRequested = 'batch-requested',
  KeepServiceWorkerAlive = 'keep-service-worker-alive',
  UploadWordDocument = 'upload-word-document',
  WordDocumentUploadStatus = 'word-document-upload-status',
  CancelUploadWordDocument = 'cancel-upload-word-document',
}

export type WordDocumentSelectedEvent = {
  type: EventTypes.WordDocumentSelected;
  fileId: string;
  fileType: string;
  fileName: string;
  fileSize: number;
};

export type UploadWordDocumentEvent = {
  type: EventTypes.UploadWordDocument;
  fileId: string;
  fileType: string;
  fileName: string;
  fileSize: number;
  accessToken: string;
  convertRequestBeingCreatedId: string;
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

export type KeepServiceWorkerAliveEvent = {
  type: EventTypes.KeepServiceWorkerAlive;
};

export type CancelUploadWordDocumentEvent = {
  type: EventTypes.CancelUploadWordDocument;
  fileId: string;
};

export type Events =
  | WordDocumentSelectedEvent
  | BatchRequestedEvent
  | KeepServiceWorkerAliveEvent
  | UploadWordDocumentEvent
  | WordDocumentUploadStatusEvent
  | CancelUploadWordDocumentEvent;
