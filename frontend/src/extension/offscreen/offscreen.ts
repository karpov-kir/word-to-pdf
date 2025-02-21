import throttle from 'lodash.throttle';

import { config } from '../../Config';
import {
  Events,
  EventTypes,
  KeepServiceWorkerAliveEvent,
  UploadWordDocumentEvent,
  WordDocumentUploadStatusEvent,
} from '../../events';
import { convertBase64ToBlob } from '../../utils/convertBase64ToBlob';
import { ConvertRequestDto } from '../../wordToPdfApiClient/ConvertRequestDto';

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
    handleUploadWordDocument(event);
  }
});

async function handleUploadWordDocument({
  accessToken,
  wordDocumentBase64,
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
          console.error('Failed to send upload word document progress message', error);
        });
    }, 200);

    const { status, convertRequestDto, error } = await uploadFile(
      wordDocumentBase64,
      accessToken,
      fileName,
      handleLoadProgress,
    );

    await chrome.runtime.sendMessage<WordDocumentUploadStatusEvent>({
      type: EventTypes.WordDocumentUploadStatus,
      uploadProgress: 100,
      isCompleted: true,
      convertRequestDto,
      status,
      error,
      convertRequestBeingCreatedId,
    });

    if (status !== 200) {
      throw new Error(`Failed to upload file: ${error}`);
    }
  } catch (error) {
    console.warn('Failed to create convert request', error);
  }
}

// Cannot fail
async function uploadFile(
  wordDocumentBase64: string,
  accessToken: string,
  fileName: string,
  onProgress: (progress: number) => void,
): Promise<{
  status: number;
  convertRequestDto?: ConvertRequestDto;
  error?: string;
}> {
  const fileBlob = await convertBase64ToBlob(wordDocumentBase64);

  const xhr = new XMLHttpRequest();
  const formData = new FormData();

  formData.append('file', fileBlob, fileName);

  // Track upload progress
  xhr.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable) {
      const uploadProgress = Math.round((100 * event.loaded) / event.total);
      onProgress(uploadProgress);
    }
  });

  return new Promise<{
    status: number;
    convertRequestDto?: ConvertRequestDto;
    error?: string;
  }>((resolve) => {
    xhr.addEventListener('load', () => {
      if (xhr.status !== 200) {
        resolve({
          status: xhr.status,
          error: xhr.responseText || 'Failed to upload file',
        });
        return;
      }

      try {
        const convertRequestDto = JSON.parse(xhr.responseText);
        resolve({
          status: xhr.status,
          convertRequestDto,
        });
      } catch (error) {
        resolve({
          status: 0,
          error: `${error}`,
        });
      }
    });

    // Handle errors
    xhr.addEventListener('error', (error) => {
      resolve({
        status: xhr.status,
        error: `${error}`,
      });
    });

    // Handle abort
    xhr.addEventListener('abort', () => {
      resolve({
        status: xhr.status,
        error: `Upload aborted`,
      });
    });

    const url = `${config.wordToPdfApiBaseUrl}/convert-requests/create`;

    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.send(formData);
  });
}
