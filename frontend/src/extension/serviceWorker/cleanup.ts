import { chromeStorage, isLocalConvertRequest } from '../../Storage';

export async function cleanup() {
  try {
    const convertRequestsBeingCreated = await chromeStorage.getConvertRequestsBeingCreated();

    for (const convertRequest of await chromeStorage.getConvertRequests()) {
      if (!isLocalConvertRequest(convertRequest)) {
        continue;
      }

      if (
        convertRequestsBeingCreated.some(
          (convertRequestBeingCreated) => convertRequestBeingCreated.id === convertRequest.id,
        )
      ) {
        continue;
      }

      await chromeStorage.removeConvertRequestByBeingCreatedId(convertRequest.convertRequestBeingCreatedId);
    }

    const batchRequestBeingCreated = await chromeStorage.getBatchRequestBeingCreated();
    const batchRequest = await chromeStorage.getBatchRequest();

    if (batchRequest && !batchRequestBeingCreated) {
      await chromeStorage.removeBatchRequest();
    }
  } catch (error) {
    console.error('Failed to cleanup', error);
  }
}
