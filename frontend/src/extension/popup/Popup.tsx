import './Popup.css';

import { createSignal, onMount, Show } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { render } from 'solid-js/web';
import toast, { Toaster } from 'solid-toast';

import { EventTypes, KeepServiceWorkerAliveEvent } from '../../events';
import { chromeStorage } from '../../Storage';
import { CombinedBatchRequest, CombinedConvertRequest } from './CombinedConvertRequest';
import { Content } from './content/Content';
import { ContentActions } from './content/ContentActions';
import { EmptyContent } from './content/EmptyContent';
import { createCombinedConvertRequests } from './createCombinedConvertRequests';
import { sendWordDocumentToWorker } from './sendWordDocumentToWorker';

// Stop the default behavior of opening the dropped file in a new browser tab
window.addEventListener(
  'dragover',
  function (e) {
    e.preventDefault();
  },
  false,
);
window.addEventListener(
  'drop',
  function (e) {
    e.preventDefault();
  },
  false,
);

const Popup = () => {
  const [combinedConvertRequests, setCombinedConvertRequests] = createStore<CombinedConvertRequest[]>([]);
  const [combinedBatchRequest, setCombinedBatchRequest] = createStore<CombinedBatchRequest>({
    batchConvertRequests: undefined,
    convertRequestBeingCreated: undefined,
  });
  const [isDragging, setIsDragging] = createSignal(false);

  onMount(async () => {
    /* #region convert requests */
    const convertRequests = await chromeStorage.getConvertRequests();
    const convertRequestsBeingCreated = await chromeStorage.getConvertRequestsBeingCreated();
    let latestConvertRequests = convertRequests;
    let latestConvertRequestsBeingCreated = convertRequestsBeingCreated;

    setCombinedConvertRequests(createCombinedConvertRequests(latestConvertRequests, latestConvertRequestsBeingCreated));

    chromeStorage.onConvertRequestsChanged((newConvertRequests) => {
      console.log('Convert requests change detected in the storage', newConvertRequests);
      latestConvertRequests = newConvertRequests;
      setCombinedConvertRequests(
        reconcile(createCombinedConvertRequests(latestConvertRequests, latestConvertRequestsBeingCreated)),
      );
    });
    chromeStorage.onConvertRequestBeingCreatedChanged((newConvertRequestsBeingCreated) => {
      console.log('Content requests being created change detected in the storage', newConvertRequestsBeingCreated);
      latestConvertRequestsBeingCreated = newConvertRequestsBeingCreated;
      setCombinedConvertRequests(
        reconcile(createCombinedConvertRequests(latestConvertRequests, latestConvertRequestsBeingCreated)),
      );
    });
    /* #endregion */

    /* #region batch request */
    const batchRequest = await chromeStorage.getBatchRequest();
    const batchRequestBeingCreated = await chromeStorage.getBatchRequestBeingCreated();
    let latestBatchRequest = batchRequest;
    let latestBatchRequestBeingCreated = batchRequestBeingCreated;

    setCombinedBatchRequest({
      batchConvertRequests: latestBatchRequest,
      convertRequestBeingCreated: latestBatchRequestBeingCreated,
    });

    chromeStorage.onBatchRequestChanged((newBatchRequest) => {
      console.log('Batch request change detected in the storage', newBatchRequest);
      latestBatchRequest = newBatchRequest;
      setCombinedBatchRequest({
        batchConvertRequests: latestBatchRequest,
        convertRequestBeingCreated: latestBatchRequestBeingCreated,
      });
    });
    chromeStorage.onBatchRequestBeingCreatedChanged((newBatchRequestBeingCreated) => {
      console.log('Batch request being created change detected in the storage', newBatchRequestBeingCreated);
      latestBatchRequestBeingCreated = newBatchRequestBeingCreated;
      setCombinedBatchRequest({
        batchConvertRequests: latestBatchRequest,
        convertRequestBeingCreated: latestBatchRequestBeingCreated,
      });
    });
    /* #endregion */

    if (!(await chromeStorage.getHasPopupPingedServiceWorker())) {
      console.log('Sending keep service worker event');

      await chrome.runtime.sendMessage<KeepServiceWorkerAliveEvent>({
        type: EventTypes.KeepServiceWorkerAlive,
      });

      await chromeStorage.setHasPopupPingedServiceWorker(true);
    }
  });

  const handleDrop = (event: DragEvent) => {
    setIsDragging(false);

    if (!event.dataTransfer || !event.dataTransfer.files.length) {
      console.log('No file has been dropped, nothing to convert');
      return;
    }

    const validFiles: File[] = [];

    Array.from(event.dataTransfer.files).forEach((file, fileIndex) => {
      if (!file.name.endsWith('.doc') && !file.name.endsWith('.docx')) {
        console.log(`File ${fileIndex} is not a .doc or .docx file, skipping`);
        return;
      }

      validFiles.push(file);
    });

    if (validFiles.length === 0) {
      toast.error('No valid files have been dropped, please select .doc or .docx files');
      return;
    }

    validFiles.forEach((file) => {
      sendWordDocumentToWorker(file);
    });
  };

  const handleDragEnter = (event: DragEvent) => {
    console.log('Drag enter');
    if (!event.dataTransfer) {
      return;
    }

    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault();

    if (event.relatedTarget && (event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) {
      return;
    }

    console.log('Drag leave');

    setIsDragging(false);
  };

  const renderHeader = () => (
    <div class="flex items-center justify-between border-b-1 border-gray-900 px-6 py-5">
      <div>
        <span class="text-lg font-semibold text-gray-50">WP</span>
        <span class="pl-4 text-lg font-semibold text-gray-50">Word to PDF</span>
      </div>
      <a href="#" class="text-sm text-gray-300 hover:underline">
        Rate us
      </a>
    </div>
  );

  const renderFooter = () => (
    <div class="border-t-1 border-gray-900 px-6 py-5">
      <span class="text-sm text-gray-50">
        Support:{' '}
        <a class="underline" href="mailto:kk.prod.contact@gmail.com">
          kk.prod.contact@gmail.com
        </a>
      </span>
    </div>
  );

  const renderDropFilesOverlay = () => (
    <div class="absolute top-0 left-0 flex h-full w-full items-center justify-center bg-gray-950/70">
      <span class="mb-6 text-xl font-semibold text-sky-500">Drop files here</span>
    </div>
  );

  return (
    <div
      class="relative flex size-[600px] flex-col bg-gray-950"
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <Toaster />
      {renderHeader()}
      <Show when={!combinedConvertRequests.length}>
        <EmptyContent isDragging={isDragging()} />
      </Show>
      <Show when={combinedConvertRequests.length > 0}>
        {<Content combinedConvertRequests={combinedConvertRequests} />}
      </Show>
      <Show when={combinedConvertRequests.length > 0}>
        <ContentActions combinedBatchRequest={combinedBatchRequest} combinedConvertRequests={combinedConvertRequests} />
      </Show>
      {renderFooter()}
      <Show when={isDragging()}>{renderDropFilesOverlay()}</Show>
    </div>
  );
};

const appContainer = document.querySelector('#popup-container');
if (!appContainer) {
  throw new Error('Can not find AppContainer');
}

render(Popup, appContainer);
