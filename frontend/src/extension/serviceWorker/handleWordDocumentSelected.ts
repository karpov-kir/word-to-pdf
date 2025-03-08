import { Deferred } from '../../utils/deferred';
import { ConvertRequestDto } from '../../wordToPdfApiClient/ConvertRequestDto';
import { Events, EventTypes, WordDocumentSelectedEvent, WordDocumentUploadStatusEvent } from '../events';
import { chromeMessaging } from '../Messaging';
import { chromeStorage, ConvertRequestErrorType } from '../Storage';
import { ensureOffscreenDocument } from './createOffscreenDocument';
import { pollConvertRequestsInProgress } from './pollConvertRequestsInProgress';

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

  try {
    await ensureOffscreenDocument();
    await chromeStorage.appendConvertRequest({
      id: undefined,
      status: 'queued',
      fileName: event.fileName,
      createdAt: Date.now(),
      convertRequestBeingCreatedId: event.convertRequestBeingCreatedId,
      fileSize: event.fileSize,
    });

    const accessToken = await chromeStorage.getAccessToken();

    if (!accessToken) {
      throw new Error('Access token not found');
    }

    await chromeMessaging.sendMessage({
      type: EventTypes.UploadWordDocument,
      accessToken,
      fileId: event.fileId,
      convertRequestBeingCreatedId: event.convertRequestBeingCreatedId,
      fileName: event.fileName,
    });

    const createdConvertRequest = await watchWordDocumentUploading(event.convertRequestBeingCreatedId);

    await chromeStorage.modifyConvertRequestByConvertRequestBeingCreatedId(event.convertRequestBeingCreatedId, () => ({
      ...createdConvertRequest,
      convertRequestBeingCreatedId: undefined,
    }));

    await chromeStorage.removeConvertRequestBeingCreated(event.convertRequestBeingCreatedId);
  } catch (error) {
    console.error('Failed to create convert request', error);

    await chromeStorage
      .modifyConvertRequestBeingCreatedById(event.convertRequestBeingCreatedId, (existingConvertRequest) => ({
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

  pollConvertRequestsInProgress();
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
