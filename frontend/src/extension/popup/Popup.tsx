import './Popup.css';

import { createSignal, JSX, onMount, Show } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { render } from 'solid-js/web';
import { Toaster } from 'solid-toast';

import { Switch } from '../../components/Switch';
import { config } from '../../Config';
import DownloadIcon from '../../icons/download.svg?component-solid';
import WordToPdfIcon from '../../icons/word-to-pdf.svg?component-solid';
import { defaultDuration, toast } from '../../utils/toast';
import { popupChromeMessaging } from '../Messaging';
import { chromeStorage } from '../Storage';
import { CombinedBatchRequest, CombinedConvertRequest } from './CombinedConvertRequest';
import { Content } from './content/Content';
import { ContentActions } from './content/ContentActions';
import { EmptyContent } from './content/EmptyContent';
import { createCombinedConvertRequests } from './createCombinedConvertRequests';
import { scheduleFileForUploading } from './scheduleFileForUploading';

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

const updateDocumentDataTheme = () =>
  document.documentElement.setAttribute('data-theme', chromeStorage.isDarkModeEnabled() ? 'dark' : 'light');

updateDocumentDataTheme();

function Popup() {
  const [combinedConvertRequests, setCombinedConvertRequests] = createStore<CombinedConvertRequest[]>([]);
  const [combinedBatchRequest, setCombinedBatchRequest] = createStore<CombinedBatchRequest>({
    batchConvertRequests: undefined,
    convertRequestBeingCreated: undefined,
  });
  const [isDragging, setIsDragging] = createSignal(false);
  const [isDarkModeEnabled, setIsDarkModeEnabled] = createSignal(chromeStorage.isDarkModeEnabled());

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

    if ((await chromeStorage.getConvertRequestsInProgress()).length) {
      await popupChromeMessaging.ensureServiceWorkerAlive();
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
      toast({
        title: 'No valid files have been dropped',
        message: 'Please select .doc or .docx files',
        severity: 'error',
      });
      return;
    }

    validFiles.forEach((file) => {
      scheduleFileForUploading(file).catch((error) => {
        console.error('Failed to schedule file for uploading', error);
      });
    });
  };

  const handleDragEnter = (event: DragEvent) => {
    if (!event.dataTransfer) {
      return;
    }

    setIsDragging(true);
  };

  const handleDragLeave: JSX.EventHandler<HTMLElement, DragEvent> = (event) => {
    if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget as Node)) {
      return;
    }

    setIsDragging(false);
  };

  const handleDarkModeToggle: JSX.ChangeEventHandler<HTMLLabelElement, Event> = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const isDarkModeEnabled = target.checked;
    setIsDarkModeEnabled(isDarkModeEnabled);
    chromeStorage.setIsDarkModeEnabled(isDarkModeEnabled);
    updateDocumentDataTheme();
  };

  const renderHeader = () => (
    <div class="flex justify-between px-6 border-b-1 border-gray-900 py-5 light:border-slate-300 transition-colors items-center">
      <div class="flex items-center">
        <span class="text-lg font-semibold text-gray-50">
          <WordToPdfIcon class="h-[32] w-[32]" />
        </span>
        <span class="pl-4 text-lg font-semibold text-gray-50 light:text-gray-950 transition-colors">
          Word to PDF {config.env !== 'production' ? ` [${config.env}]` : ''}
        </span>
      </div>
      <div>
        <Switch checked={isDarkModeEnabled()} onChange={handleDarkModeToggle}>
          Dark mode
        </Switch>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div class="border-t-1 border-gray-900 px-6 py-5 light:border-slate-300 transition-colors">
      <a
        class="border-r-1 border-gray-900 pr-4 text-sm text-gray-300 underline transition-colors hover:text-sky-400 light:text-gray-950
          light:border-slate-400"
        href="mailto:kk.prod.contact@gmail.com"
      >
        Support
      </a>
      <a
        href="https://chromewebstore.google.com/detail/adobe-acrobat-pdf-edit-co/djmlinomlgiincjehoedbklhiongnkhm/reviews"
        target="_blank"
        class="pl-4 text-sm text-gray-300 underline transition-colors hover:text-sky-400 light:text-gray-950"
      >
        Rate us
      </a>
    </div>
  );

  const renderDropFilesOverlay = () => (
    <div
      class="absolute top-0 left-0 flex h-full w-full items-center justify-center border-1 border-dashed border-gray-700
        bg-gray-700/70 light:bg-gray-400/70 transition-colors"
    >
      <span class="mb-6 inline-flex text-xl font-semibold text-gray-50 light:text-slate-700 transition-colors">
        drop files here <DownloadIcon class="ml-1 w-[24] text-gray-50 light:text-slate-700 transition-colors" />
      </span>
    </div>
  );

  return (
    <>
      <div
        class="relative flex size-[600px] flex-col bg-gray-950 light:bg-slate-50 transition-colors"
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <Toaster
          toastOptions={{
            duration: defaultDuration,
          }}
        />
        {renderHeader()}
        <Show when={!combinedConvertRequests.length}>
          <EmptyContent isDragging={isDragging()} />
        </Show>
        <Show when={combinedConvertRequests.length > 0}>
          {<Content combinedConvertRequests={combinedConvertRequests} />}
        </Show>
        <Show when={combinedConvertRequests.length > 0}>
          <ContentActions
            combinedBatchRequest={combinedBatchRequest}
            combinedConvertRequests={combinedConvertRequests}
          />
        </Show>
        {renderFooter()}
        <Show when={isDragging()}>{renderDropFilesOverlay()}</Show>
      </div>
    </>
  );
}

const appContainer = document.querySelector('#popup-container');
if (!appContainer) {
  throw new Error('Could not find popup container');
}

render(Popup, appContainer);
