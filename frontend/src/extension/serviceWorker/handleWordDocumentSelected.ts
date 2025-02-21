import { createId } from '@paralleldrive/cuid2';

import {
  Events,
  EventTypes,
  UploadWordDocumentEvent,
  WordDocumentSelectedEvent,
  WordDocumentUploadStatusEvent,
} from '../../events';
import { chromeStorage, ConvertRequestErrorType } from '../../Storage';
import { Deferred } from '../../utils/deferred';
import { ConvertRequestDto } from '../../wordToPdfApiClient/ConvertRequestDto';

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function handleWordDocumentSelected(event: WordDocumentSelectedEvent) {
  console.log('Creating convert request');

  const convertRequestBeingCreatedId = createId();

  try {
    await chromeStorage.appendConvertRequestBeingCreated({
      id: convertRequestBeingCreatedId,
      fileName: event.fileName,
      fileId: event.fileId,
    });
    await chromeStorage.appendConvertRequest({
      id: undefined,
      status: 'queued',
      fileName: event.fileName,
      createdAt: Date.now(),
      convertRequestBeingCreatedId,
      fileSize: event.fileSize,
    });

    const accessToken = await chromeStorage.getAccessToken();

    if (!accessToken) {
      throw new Error('Access token not found');
    }

    await chrome.runtime.sendMessage<UploadWordDocumentEvent>({
      ...event,
      type: EventTypes.UploadWordDocument,
      accessToken,
      convertRequestBeingCreatedId,
    });

    const createdConvertRequest = await watchWordDocumentUploading(convertRequestBeingCreatedId);

    await chromeStorage.modifyConvertRequestByConvertRequestBeingCreatedId(convertRequestBeingCreatedId, () => ({
      ...createdConvertRequest,
      convertRequestBeingCreatedId: undefined,
    }));

    await chromeStorage.removeConvertRequestBeingCreated(convertRequestBeingCreatedId);
  } catch (error) {
    console.error('Failed to create convert request', error);

    await chromeStorage
      .modifyConvertRequestBeingCreatedById(convertRequestBeingCreatedId, (existingConvertRequest) => ({
        ...existingConvertRequest,
        errorType: getConvertRequestErrorType(error),
        errorMessage: `${error}`,
      }))
      .catch((error) => {
        console.error('Failed to update convert request being created', error);
      });
  }

  await chromeStorage.removeFileForUploading(event.fileId).catch((error) => {
    console.error('Failed to remove file for uploading', error);
  });
}

function getConvertRequestErrorType(error: unknown): ConvertRequestErrorType {
  const errorTypeMap: Record<string, ConvertRequestErrorType> = {
    413: ConvertRequestErrorType.FileTooLarge,
    429: ConvertRequestErrorType.QuotaExceeded,
  };

  if (error instanceof UploadError) {
    return errorTypeMap[error.status] ?? ConvertRequestErrorType.UnknownError;
  }

  return ConvertRequestErrorType.UnknownError;
}

function watchWordDocumentUploading(convertRequestBeingCreatedIdToWaitFor: string): Promise<ConvertRequestDto> {
  const deferred = new Deferred<ConvertRequestDto>();
  const timeout = 10 * 60 * 1000;
  let timeoutId: NodeJS.Timeout;

  const runAndUpdateTimeout = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      deferred.reject(new Error('Waiting for word document uploading timed out'));
    }, timeout);
  };

  const statusHandler = async ({
    convertRequestBeingCreatedId,
    uploadProgress,
    convertRequestDto,
    error,
    status,
    isCompleted,
  }: WordDocumentUploadStatusEvent) => {
    runAndUpdateTimeout();

    try {
      await chromeStorage.modifyConvertRequestBeingCreatedById(
        convertRequestBeingCreatedId,
        (existingConvertRequest) => ({
          ...existingConvertRequest,
          uploadProgress,
        }),
      );

      if (isCompleted) {
        if (error) {
          deferred.reject(new UploadError(error, status ?? 0));
        }

        if (!convertRequestDto) {
          throw new Error('Convert request DTO was not resolved');
        }

        deferred.resolve(convertRequestDto);
      }
    } catch (error) {
      deferred.reject(error);
    }
  };

  const eventListener = (event: Events) => {
    if (
      event.type === EventTypes.WordDocumentUploadStatus &&
      event.convertRequestBeingCreatedId === convertRequestBeingCreatedIdToWaitFor
    ) {
      statusHandler(event);
    }
  };

  chrome.runtime.onMessage.addListener(eventListener);

  return deferred.promise
    .then((convertRequest) => {
      chrome.runtime.onMessage.removeListener(eventListener);
      return convertRequest;
    })
    .catch((error) => {
      chrome.runtime.onMessage.removeListener(eventListener);
      throw error;
    });
}
