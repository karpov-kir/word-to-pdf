import { chromeStorage, isLocalConvertRequest } from '../Storage';

export async function cleanup() {
  try {
    await removeOrphanBatchAndConvertRequests();
    await removeOrphanFiles();
    await chromeStorage.getIdsOfFilesForUploading();
  } catch (error) {
    console.error('Failed to cleanup', error);
  }
}

/**
 * We store convert and batch requests in the local storage, but we also store convert and batch requests being created
 * in the local storage, so if the browser is closed in the middle of processing a convert or batch request,
 * convert and batch requests being created are deleted, but convert and batch requests are not.
 * This function removes orphan convert and batch requests.
 */
async function removeOrphanBatchAndConvertRequests() {
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
    throw new Error(`Failed to remove orphan convert and batch requests ${error}`);
  }
}

/**
 * Basically the same idea as in `removeOrphanBatchAndConvertRequests`, but for files.
 */
async function removeOrphanFiles() {
  try {
    const idsOfFilesForUploading = await chromeStorage.getIdsOfFilesForUploading();
    const convertRequestsBeingCreated = await chromeStorage.getConvertRequestsBeingCreated();

    for (const idOfFileForUploading of idsOfFilesForUploading) {
      if (
        convertRequestsBeingCreated.some(
          (convertRequestBeingCreated) => convertRequestBeingCreated.fileId === idOfFileForUploading,
        )
      ) {
        continue;
      }

      await chromeStorage.removeFileForUploading(idOfFileForUploading);
    }
  } catch (error) {
    throw new Error(`Failed to remove orphan files ${error}`);
  }
}
