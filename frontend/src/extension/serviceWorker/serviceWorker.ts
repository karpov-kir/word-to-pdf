import { config } from '../../Config';
import { Events, EventTypes } from '../../events';
import { sleep } from '../../utils/sleep';
import { wordToPdfApiClient } from '../../wordToPdfApiClient/WordToPdfApiClient';
import { cleanup } from './cleanup';
import { createOffscreenDocument } from './createOffscreenDocument';
import { handleBatchRequested } from './handleBatchRequested';
import { handleWordDocumentSelected } from './handleWordDocumentSelected';
import { pollBatchRequestsInProgress } from './pollBatchRequestsInProgress';
import { pollConvertRequestsInProgress } from './pollConvertRequestsInProgress';

chrome.runtime.onMessage.addListener((event: Events) => {
  if (event.type === EventTypes.WordDocumentSelected) {
    handleWordDocumentSelected(event);
  } else if (event.type === EventTypes.BatchRequested) {
    handleBatchRequested(event);
  } else if (event.type === EventTypes.KeepServiceWorkerAlive) {
    console.log('Received keep service worker alive event');
  }
});

async function initAccessToken() {
  try {
    await wordToPdfApiClient.initAccessToken();
  } catch (error) {
    console.warn('Failed to initialize access token', error);
    await sleep(5_000);
    initAccessToken();
  }
}

initAccessToken();

console.log(`Starting to poll convert requests in progress every ${config.pollConvertRequestsInProgressIntervalMs}ms`);
pollConvertRequestsInProgress();

console.log(`Starting to poll batch requests in progress every ${config.pollBatchRequestsInProgressIntervalMs}ms`);
pollBatchRequestsInProgress();

createOffscreenDocument();

cleanup();
