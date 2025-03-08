import { config } from '../../Config';
import { sleep } from '../../utils/sleep';
import { wordToPdfApiClient } from '../../wordToPdfApiClient/WordToPdfApiClient';
import { chromeStorage, isLocalBatchRequest } from '../Storage';

let isPolling = false;

export async function pollBatchRequestsInProgress(isInitialRequest = true) {
  if (isInitialRequest) {
    console.log(`Starting to poll batch requests in progress every ${config.pollBatchRequestsInProgressIntervalMs}ms`);
  }

  if (isPolling && isInitialRequest) {
    console.log('Already polling batch requests in progress, skipping');
    return;
  }

  isPolling = true;

  const { batchRequestsInProgressCount, error } = await updateBatchRequestsInProgress();

  if (batchRequestsInProgressCount === 0 && !error) {
    console.log('No batch requests in progress, stopping polling');
    isPolling = false;
    return;
  }

  await sleep(config.pollBatchRequestsInProgressIntervalMs);

  if (!isPolling) {
    return;
  }

  pollBatchRequestsInProgress(false);
}

async function updateBatchRequestsInProgress(): Promise<{
  batchRequestsInProgressCount: number;
  error: boolean;
}> {
  try {
    const batchRequestInProgress = await chromeStorage.getBatchRequestInProgress();

    if (!batchRequestInProgress) {
      return {
        batchRequestsInProgressCount: 0,
        error: false,
      };
    }

    const batchRequestsFromServer = await wordToPdfApiClient.getBatchRequestsByIds([batchRequestInProgress.id]);
    console.log('Got new data for batch requests in progress', batchRequestsFromServer);

    await chromeStorage.modifyBatchRequest((existingBatchRequest) => {
      const relatesBatchRequestFromServer = batchRequestsFromServer.find(
        (batchRequestFromServer) => batchRequestFromServer.id === existingBatchRequest.id,
      );

      if (!relatesBatchRequestFromServer) {
        return existingBatchRequest;
      }

      const updatedBatchRequest = isLocalBatchRequest(existingBatchRequest)
        ? {
            ...relatesBatchRequestFromServer,
            batchRequestBeingCreatedId: undefined,
          }
        : {
            ...existingBatchRequest,
            ...relatesBatchRequestFromServer,
          };

      if (updatedBatchRequest.status === 'done') {
        const url = `${config.wordToPdfApiBaseUrl}/download/pdf-batch/${updatedBatchRequest.id}`;

        chrome.downloads.download({
          url: url,
          saveAs: true,
        });
      }

      return updatedBatchRequest;
    });

    return {
      batchRequestsInProgressCount: batchRequestsFromServer.length,
      error: false,
    };
  } catch (error) {
    console.error('Failed to fetch batch requests in progress (within polling)', error);
  }

  return {
    batchRequestsInProgressCount: 0,
    error: true,
  };
}
