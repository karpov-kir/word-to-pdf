import { Events, EventTypes } from '../events';
import { cleanup } from './cleanup';
import { handleBatchRequested } from './handleBatchRequested';
import { handleWordDocumentSelected } from './handleWordDocumentSelected';
import { pollBatchRequestsInProgress } from './pollBatchRequestsInProgress';
import { pollConvertRequestsInProgress } from './pollConvertRequestsInProgress';

chrome.runtime.onMessage.addListener((event: Events, _: unknown, sendResponse: (response: unknown) => void) => {
  console.log('Received event', event);

  if (event.type === EventTypes.WordDocumentSelected) {
    handleWordDocumentSelected(event);
  } else if (event.type === EventTypes.BatchRequested) {
    handleBatchRequested(event);
  } else if (event.type === EventTypes.WakeServiceWorkerUp) {
    console.log('Received keep service worker alive event, acknowledging...');
    sendResponse({ data: `acknowledge-${event.type}-in-service-worker` });
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({
      url: 'https://kk-forge.com/products/word-to-pdf/welcome',
    });
  } else if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
    // When extension is updated
  } else if (details.reason === chrome.runtime.OnInstalledReason.CHROME_UPDATE) {
    // When browser is updated
  } else if (details.reason === chrome.runtime.OnInstalledReason.SHARED_MODULE_UPDATE) {
    // When a shared module is updated
  }
});

pollConvertRequestsInProgress();
pollBatchRequestsInProgress();
cleanup();
