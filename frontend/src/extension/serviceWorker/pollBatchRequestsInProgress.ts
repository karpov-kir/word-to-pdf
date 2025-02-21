import { config } from '../../Config';
import { chromeStorage, isLocalBatchRequest } from '../../Storage';
import { sleep } from '../../utils/sleep';
import { wordToPdfApiClient } from '../../wordToPdfApiClient/WordToPdfApiClient';

export async function pollBatchRequestsInProgress() {
  await updateBatchRequestsInProgress();
  await sleep(config.pollBatchRequestsInProgressIntervalMs);
  pollBatchRequestsInProgress();
}

async function updateBatchRequestsInProgress() {
  try {
    const batchRequestInProgress = await chromeStorage.getBatchRequestInProgress();

    if (!batchRequestInProgress) {
      return;
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
  } catch (error) {
    console.error('Failed to fetch batch requests in progress (within polling)', error);
  }
}
