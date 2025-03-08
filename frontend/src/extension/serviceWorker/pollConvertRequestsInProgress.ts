import { config } from '../../Config';
import { sleep } from '../../utils/sleep';
import { wordToPdfApiClient } from '../../wordToPdfApiClient/WordToPdfApiClient';
import { chromeStorage, isLocalConvertRequest } from '../Storage';

let isPolling = false;

export async function pollConvertRequestsInProgress(isInitialRequest = true) {
  if (isInitialRequest) {
    console.log(
      `Starting to poll convert requests in progress every ${config.pollConvertRequestsInProgressIntervalMs}ms`,
    );
  }

  if (isPolling && isInitialRequest) {
    console.log('Already polling batch requests in progress, skipping');
    return;
  }

  isPolling = true;

  const { convertRequestsInProgressCount, error } = await updateConvertRequestsInProgress();

  if (convertRequestsInProgressCount === 0 && !error) {
    isPolling = false;
    console.log('No convert requests in progress, stopping polling');
    return;
  }

  await sleep(config.pollConvertRequestsInProgressIntervalMs);

  if (!isPolling) {
    return;
  }
  pollConvertRequestsInProgress(false);
}

async function updateConvertRequestsInProgress(): Promise<{ convertRequestsInProgressCount: number; error: boolean }> {
  try {
    const convertRequestsInProgress = await chromeStorage.getConvertRequestsInProgress();

    if (!convertRequestsInProgress.length) {
      return {
        convertRequestsInProgressCount: 0,
        error: false,
      };
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

    return {
      convertRequestsInProgressCount: convertRequestsFromServer.length,
      error: false,
    };
  } catch (error) {
    console.error('Failed to fetch convert requests in progress (within polling)', error);
  }

  return {
    convertRequestsInProgressCount: 0,
    error: true,
  };
}
