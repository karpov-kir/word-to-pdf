import throttle from 'lodash.throttle';

import { config } from '../../Config';
import { ConvertRequestDto } from '../../wordToPdfApiClient/ConvertRequestDto';
import { Events, EventTypes, UploadWordDocumentEvent } from '../events';
import { chromeMessaging } from '../Messaging';
import { UploadError } from '../serviceWorker/handleWordDocumentSelected';
import { chromeStorage } from '../Storage';

const maxParallelUploads = 5;
const uploadQueue: UploadWordDocumentEvent[] = [];
let activeUploads = 0;
const activeXhrRequests: Map<string, XMLHttpRequest> = new Map();

chrome.runtime.onMessage.addListener((event: Events) => {
  if (event.type === EventTypes.UploadWordDocument) {
    enqueueUpload(event);
  } else if (event.type === EventTypes.CancelUploadWordDocument) {
    cancelUpload(event.fileId);
  }
});

function enqueueUpload(event: UploadWordDocumentEvent) {
  uploadQueue.push(event);
  processQueue();
}

function cancelUpload(fileId: string) {
  const xhr = activeXhrRequests.get(fileId);
  if (xhr) {
    xhr.abort();
    activeXhrRequests.delete(fileId);
  }

  const index = uploadQueue.findIndex((event) => event.fileId === fileId);
  if (index !== -1) {
    uploadQueue.splice(index, 1);
  }
}

async function processQueue() {
  if (activeUploads >= maxParallelUploads || uploadQueue.length === 0) {
    return;
  }

  const event = uploadQueue.shift();
  if (event) {
    activeUploads++;
    try {
      await handleUploadWordDocument(event);
    } finally {
      activeUploads--;
      processQueue();
    }
  }
}

async function handleUploadWordDocument(event: UploadWordDocumentEvent) {
  try {
    console.log('Creating convert request');

    const handleLoadProgress = throttle(async (progress: number) => {
      await chromeMessaging.sendMessage({
        type: EventTypes.WordDocumentUploadStatus,
        uploadProgress: progress,
        isCompleted: false,
        convertRequestBeingCreatedId: event.convertRequestBeingCreatedId,
      });
    }, 200);

    const file = await chromeStorage.getFileForUploading(event.fileId);

    if (!file) {
      throw new Error(`File with id ${event.fileId} not found`);
    }

    const { status, convertRequestDto } = await uploadFile(
      file,
      event.accessToken,
      event.fileName,
      handleLoadProgress,
      event.fileId,
    );

    await chromeMessaging.sendMessage({
      type: EventTypes.WordDocumentUploadStatus,
      uploadProgress: 100,
      isCompleted: true,
      convertRequestDto,
      status,
      error: undefined,
      convertRequestBeingCreatedId: event.convertRequestBeingCreatedId,
    });
  } catch (error) {
    console.error('Failed to create convert request', error);
    await chromeMessaging.sendMessage({
      type: EventTypes.WordDocumentUploadStatus,
      uploadProgress: 100,
      isCompleted: true,
      convertRequestDto: undefined,
      status: error instanceof UploadError ? error.status : undefined,
      error: `${error}`,
      convertRequestBeingCreatedId: event.convertRequestBeingCreatedId,
    });
  }
}

async function uploadFile(
  file: File,
  accessToken: string,
  fileName: string,
  onProgress: (progress: number) => void,
  fileId: string,
): Promise<{
  status: number;
  convertRequestDto?: ConvertRequestDto;
}> {
  const xhr = new XMLHttpRequest();
  const formData = new FormData();

  activeXhrRequests.set(fileId, xhr);
  formData.append('file', file, fileName);

  // Track upload progress
  xhr.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable) {
      const uploadProgress = Math.round((100 * event.loaded) / event.total);
      onProgress(uploadProgress);
    }
  });

  return new Promise<{
    status: number;
    convertRequestDto: ConvertRequestDto;
  }>((resolve, reject) => {
    xhr.addEventListener('load', () => {
      activeXhrRequests.delete(fileId);

      if (xhr.status !== 200) {
        reject(new UploadError(`Failed to upload`, xhr.status));
        return;
      }

      try {
        const convertRequestDto = JSON.parse(xhr.responseText);
        resolve({
          status: xhr.status,
          convertRequestDto,
        });
      } catch (error) {
        reject(new UploadError(`Could not parse JSON: ${error}`, xhr.status));
      }
    });

    xhr.addEventListener('error', (error) => {
      activeXhrRequests.delete(fileId);
      reject(new UploadError(`${error}`, xhr.status));
    });

    xhr.addEventListener('abort', () => {
      activeXhrRequests.delete(fileId);
      reject(new UploadError(`Upload aborted`, xhr.status));
    });

    const url = `${config.wordToPdfApiBaseUrl}/convert-requests/create`;

    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.send(formData);
  });
}
