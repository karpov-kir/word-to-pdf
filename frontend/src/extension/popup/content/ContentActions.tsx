import { createMemo, createSignal, onCleanup, Show } from 'solid-js';
import toast from 'solid-toast';

import { Button } from '../../../components/Button';
import { Tooltip } from '../../../components/Tooltip';
import { config } from '../../../Config';
import { BatchRequestedEvent, EventTypes } from '../../../events';
import WarningIcon from '../../../icons/warning.svg?component-solid';
import { BatchRequestErrorType, chromeStorage } from '../../../Storage';
import { CombinedBatchRequest, CombinedConvertRequest } from '../CombinedConvertRequest';
import { checkFileHasBeenDeleted } from './checkFileHasBeenDeleted';

export function ContentActions(props: {
  combinedBatchRequest: CombinedBatchRequest;
  combinedConvertRequests: CombinedConvertRequest[];
}) {
  const [currentTime, setCurrentTime] = createSignal(Date.now());
  const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
  onCleanup(() => clearInterval(interval));

  const hasFilesToDownload = createMemo(() =>
    props.combinedConvertRequests.some(
      (combinedConvertRequest) =>
        combinedConvertRequest.status === 'done' && !checkFileHasBeenDeleted(combinedConvertRequest, currentTime()),
    ),
  );

  const hasSomeFilesInProgress = createMemo(() =>
    props.combinedConvertRequests.some(
      (combinedConvertRequest) =>
        combinedConvertRequest.status === 'queued' || combinedConvertRequest.status === 'converting',
    ),
  );

  const tooltipText = createMemo(() => {
    if (hasFilesToDownload() && hasSomeFilesInProgress()) {
      return 'Only converted files will be downloaded.';
    }
  });

  const batchRequestBeingCreated = createMemo(() => props.combinedBatchRequest.convertRequestBeingCreated);
  const batchRequest = createMemo(() => props.combinedBatchRequest.batchConvertRequests);

  const isBatching = createMemo(() => {
    const batchRequestBeingCreatedValue = batchRequestBeingCreated();
    const batchRequestValue = batchRequest();

    if (batchRequestBeingCreatedValue) {
      return !batchRequestBeingCreatedValue.errorType;
    }

    if (batchRequestValue) {
      return !batchRequestValue.error && ['queued', 'batching'].includes(batchRequestValue.status);
    }

    return false;
  });

  const errorText = createMemo(() => {
    const batchRequestBeingCreatedValue = batchRequestBeingCreated();
    if (batchRequestBeingCreatedValue?.errorType) {
      return getBatchRequestErrorTooltipText(batchRequestBeingCreatedValue.errorType);
    }

    const batchRequestValue = batchRequest();
    if (batchRequestValue?.error) {
      return getBatchErrorTooltipText(batchRequestValue.error);
    }
  });

  const handleDeleteAll = () => {
    console.log('Deleting all convert requests');
    chromeStorage.removeAllConvertRequests().catch((error) => {
      console.error('Failed to remove all convert requests', error);
    });
  };

  const handleDownloadAll = () => {
    console.log('Downloading all convert requests');

    toast.success(
      'Compiling your files into a single archive, please wait a moment. Download will start automatically once the archive is ready.',
      {
        duration: 10000,
      },
    );

    chrome.runtime
      .sendMessage<BatchRequestedEvent>({
        type: EventTypes.BatchRequested,
      })
      .catch((error) => {
        console.error(`Failed to send ${EventTypes.WordDocumentSelected} event`, error);
      });
  };

  return (
    <div class="align-center mr-6 mb-6 flex justify-end">
      <button
        onClick={handleDeleteAll}
        class="cursor-pointer rounded-sm border-2 border-sky-600 px-6 py-2 text-base text-sky-600 transition-colors duration-100 hover:border-sky-500 hover:text-sky-500"
      >
        Delete all
      </button>

      <Tooltip text={tooltipText()}>
        <Button
          disabled={!hasFilesToDownload() || isBatching()}
          onClick={handleDownloadAll}
          class="ml-3 flex items-center"
        >
          Download all
          {isBatching() && (
            <div class="ml-2 h-[1em] w-[1em] animate-spin rounded-full border-4 border-gray-300 border-t-blue-500" />
          )}
        </Button>
      </Tooltip>

      <Show when={errorText()}>
        <Tooltip text={errorText()}>
          <WarningIcon class="ml-3 h-[40] w-[40] stroke-red-400" />
        </Tooltip>
      </Show>
    </div>
  );
}

function getBatchRequestErrorTooltipText(errorType: BatchRequestErrorType) {
  const errorTypeToText: Record<string, string> = {
    [BatchRequestErrorType.QuotaExceeded]: `Last download all attempt failed because download all files limit was exceeded (current limit is ${config.batchLimitPerHour} per hour), please try again later`,
  };

  return errorTypeToText[errorType] || 'Last download all attempt failed, please try again later';
}

function getBatchErrorTooltipText(_batchError: string) {
  // TODO add error codes
  return `Last download all attempt failed, please try again later`;
}
