import { createId } from '@paralleldrive/cuid2';

import { BatchRequestedEvent } from '../../events';
import { BatchRequestErrorType, chromeStorage } from '../../Storage';
import { ServerErrorResponse, ServerErrorType, wordToPdfApiClient } from '../../wordToPdfApiClient/WordToPdfApiClient';

export async function handleBatchRequested(_event: BatchRequestedEvent) {
  console.log('Creating batch request');

  const batchRequestBeingCreatedId = createId();

  try {
    await chromeStorage.createBatchRequestBeingCreated(batchRequestBeingCreatedId);
    await chromeStorage.createBatchRequest({
      id: undefined,
      status: 'queued',
      createdAt: Date.now(),
      batchRequestBeingCreatedId: batchRequestBeingCreatedId,
    });

    const convertRequests = await chromeStorage.getConvertRequests();
    const createdBatchRequest = await wordToPdfApiClient.createBatchRequest(
      convertRequests
        .filter((convertRequest) => convertRequest.status === 'done')
        .map((convertRequest) => convertRequest.id)
        .filter((id) => id !== undefined),
    );

    await chromeStorage.modifyBatchRequest(() => ({
      ...createdBatchRequest,
      batchRequestBeingCreatedId: undefined,
    }));
    await chromeStorage.removeBatchRequestBeingCreated();
  } catch (error) {
    console.error('Failed to create batch request', error);

    await chromeStorage
      .modifyBatchRequestBeingCreated((existingConvertRequest) => ({
        ...existingConvertRequest,
        errorType: getBatchRequestErrorType(error),
      }))
      .catch((error) => {
        console.error('Failed to update batch request being created', error);
      });

    await chromeStorage.setShouldDisplayDownloadAllError(true);
  }
}

function getBatchRequestErrorType(error: unknown) {
  if (error instanceof ServerErrorResponse) {
    const errorTypeMap: Record<string, BatchRequestErrorType> = {
      [ServerErrorType.TooManyRequestsError]: BatchRequestErrorType.QuotaExceeded,
    };

    return errorTypeMap[error.serverError.type] ?? BatchRequestErrorType.UnknownError;
  }

  return BatchRequestErrorType.UnknownError;
}
