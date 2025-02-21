import { config } from '../../Config';
import { chromeStorage, isLocalConvertRequest } from '../../Storage';
import { sleep } from '../../utils/sleep';
import { wordToPdfApiClient } from '../../wordToPdfApiClient/WordToPdfApiClient';

export async function pollConvertRequestsInProgress() {
  await updateConvertRequestsInProgress();
  await sleep(config.pollConvertRequestsInProgressIntervalMs);
  pollConvertRequestsInProgress();
}

async function updateConvertRequestsInProgress() {
  try {
    const convertRequestsInProgress = await chromeStorage.getConvertRequestsInProgress();

    if (convertRequestsInProgress.length === 0) {
      return;
    }

    const convertRequestsFromServer = await wordToPdfApiClient.getConvertRequestsByIds(
      convertRequestsInProgress.map((convertRequest) => convertRequest.id),
    );
    console.log('Got new data for convert requests in progress', convertRequestsFromServer);

    await chromeStorage.modifyConvertRequests((convertRequests) =>
      convertRequests.map((existingConvertRequest) => {
        const relatedConvertRequestFromServer = convertRequestsFromServer.find(
          (convertRequestFromServer) => convertRequestFromServer.id === existingConvertRequest.id,
        );

        if (!relatedConvertRequestFromServer) {
          return existingConvertRequest;
        }

        if (isLocalConvertRequest(existingConvertRequest)) {
          return {
            ...relatedConvertRequestFromServer,
            convertRequestBeingCreatedId: undefined,
          };
        }

        return {
          ...existingConvertRequest,
          ...relatedConvertRequestFromServer,
        };
      }),
    );
  } catch (error) {
    console.error('Failed to fetch convert requests in progress (within polling)', error);
  }
}
