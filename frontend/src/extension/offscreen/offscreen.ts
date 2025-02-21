import throttle from 'lodash.throttle';
import pRetry from 'p-retry';

import { config } from '../../Config';
import {
  Events,
  EventTypes,
  KeepServiceWorkerAliveEvent,
  UploadWordDocumentEvent,
  WordDocumentUploadStatusEvent,
} from '../../events';
import { chromeStorage } from '../../Storage';
import { ConvertRequestDto } from '../../wordToPdfApiClient/ConvertRequestDto';
import { UploadError } from '../serviceWorker/handleWordDocumentSelected';

const maxParallelUploads = 5;
const uploadQueue: UploadWordDocumentEvent[] = [];
let activeUploads = 0;
const activeXhrRequests: Map<string, XMLHttpRequest> = new Map();

setInterval(async () => {
  try {
    console.log('Sending keep service worker event');

    await chrome.runtime.sendMessage<KeepServiceWorkerAliveEvent>({
      type: EventTypes.KeepServiceWorkerAlive,
    });
  } catch (error) {
    console.error('Failed to keep service worker alive', error);
  }
}, 20_000);

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

async function handleUploadWordDocument({
  accessToken,
  fileId,
  convertRequestBeingCreatedId,
  fileName,
}: UploadWordDocumentEvent) {
  try {
    console.log('Creating convert request');

    const handleLoadProgress = throttle((progress: number) => {
      chrome.runtime
        .sendMessage<WordDocumentUploadStatusEvent>({
          type: EventTypes.WordDocumentUploadStatus,
          uploadProgress: progress,
          isCompleted: false,
          convertRequestBeingCreatedId,
        })
        .catch((error) => {
          console.error(`Failed to send progress ${EventTypes.WordDocumentUploadStatus} event`, error);
        });
    }, 200);

    const file = await chromeStorage.getFileForUploading(fileId);

    if (!file) {
      throw new Error(`File with id ${fileId} not found`);
    }

    const { status, convertRequestDto } = await uploadFile(file, accessToken, fileName, handleLoadProgress, fileId);

    await pRetry(
      () =>
        chrome.runtime.sendMessage<WordDocumentUploadStatusEvent>({
          type: EventTypes.WordDocumentUploadStatus,
          uploadProgress: 100,
          isCompleted: true,
          convertRequestDto,
          status,
          error: undefined,
          convertRequestBeingCreatedId,
        }),
      { retries: 5, minTimeout: 20, maxTimeout: 100 },
    );
  } catch (error) {
    console.error('Failed to create convert request', error);
    await pRetry(
      () =>
        chrome.runtime.sendMessage<WordDocumentUploadStatusEvent>({
          type: EventTypes.WordDocumentUploadStatus,
          uploadProgress: 100,
          isCompleted: true,
          convertRequestDto: undefined,
          status: error instanceof UploadError ? error.status : undefined,
          error: `${error}`,
          convertRequestBeingCreatedId,
        }),
      {
        retries: 5,
        minTimeout: 20,
        maxTimeout: 100,
      },
    ).catch((error) => {
      console.error(`Failed to send error ${EventTypes.WordDocumentUploadStatus} event`, error);
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
