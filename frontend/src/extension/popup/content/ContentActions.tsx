import { createEffect, createMemo, createSignal, JSX, onCleanup, onMount } from 'solid-js';
import solidToast from 'solid-toast';

import { Button } from '../../../components/Button';
import { IconButton } from '../../../components/IconButton';
import { Tooltip } from '../../../components/Tooltip';
import { config } from '../../../Config';
import { BatchRequestedEvent, CancelUploadWordDocumentEvent, EventTypes } from '../../../events';
import PlusIcon from '../../../icons/plus.svg?component-solid';
import { BatchRequestErrorType, chromeStorage } from '../../../Storage';
import { toast } from '../../../utils/toast';
import { CombinedBatchRequest, CombinedConvertRequest } from '../CombinedConvertRequest';
import { scheduleFileForUploading } from '../scheduleFileForUploading';
import { checkFileHasBeenDeleted } from './checkFileHasBeenDeleted';

export function ContentActions(props: {
  combinedBatchRequest: CombinedBatchRequest;
  combinedConvertRequests: CombinedConvertRequest[];
}) {
  const [currentTime, setCurrentTime] = createSignal(Date.now());
  const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
  onCleanup(() => clearInterval(interval));

  const [shouldDisplayDownloadAllError, setShouldDisplayDownloadAllError] = createSignal(false);
  const [displayDownloadAllErrorToastId, setDisplayDownloadAllErrorToastId] = createSignal<string | undefined>();

  let fileInputRef: HTMLInputElement | undefined;

  const handleSelectFiles: JSX.ChangeEventHandler<HTMLInputElement, Event> = async (event) => {
    const target = event.target as HTMLInputElement;

    Array.from(target.files ?? []).forEach((file) => {
      scheduleFileForUploading(file).catch((error) => {
        console.error('Failed to schedule file for uploading', error);
      });
    });
  };

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

  onMount(async () => {
    chromeStorage.onShouldDisplayDownloadAllErrorChanged((newShouldDisplayDownloadAllError) => {
      console.log('Should display download all error change detected in the storage', newShouldDisplayDownloadAllError);
      setShouldDisplayDownloadAllError(newShouldDisplayDownloadAllError);
    });
    setShouldDisplayDownloadAllError(await chromeStorage.shouldDisplayDownloadAllError());
  });

  createEffect(() => {
    const errorTextValue = errorText();

    if (shouldDisplayDownloadAllError() && errorTextValue) {
      const toastId = toast({
        message: errorTextValue,
        severity: 'error',
        title: 'Download all failed',
        autoClose: false,
        onClose: () => {
          chromeStorage.setShouldDisplayDownloadAllError(false);
        },
      });

      setDisplayDownloadAllErrorToastId(toastId);
    } else if (displayDownloadAllErrorToastId()) {
      solidToast.dismiss(displayDownloadAllErrorToastId());
    }
  });

  const handleDeleteAll = async () => {
    console.log('Deleting all convert requests and files for uploading');
    try {
      const convertRequestsBeingCreated = await chromeStorage.getConvertRequestsBeingCreated();
      await chromeStorage.removeAllConvertRequests();
      await chromeStorage.removeAllFilesForUploading();

      for (const convertRequestBeingCreated of convertRequestsBeingCreated) {
        chrome.runtime
          .sendMessage<CancelUploadWordDocumentEvent>({
            type: EventTypes.CancelUploadWordDocument,
            fileId: convertRequestBeingCreated.fileId,
          })
          .catch((error) => {
            console.error('Failed to send cancel upload document event', error);
          });
      }
    } catch (error) {
      console.error('Failed to remove all convert requests and files for uploading', error);
    }
  };

  const handleDownloadAll = () => {
    console.log('Downloading all convert requests');

    toast({
      title: `Compiling your files into an archive`,
      message: `Your download will start automatically once it's ready. Please wait a moment.`,
      duration: 10000,
    });

    chrome.runtime
      .sendMessage<BatchRequestedEvent>({
        type: EventTypes.BatchRequested,
      })
      .catch((error) => {
        console.error(`Failed to send ${EventTypes.WordDocumentSelected} event`, error);
      });

    chromeStorage.setShouldDisplayDownloadAllError(false).catch((error) => {
      console.error('Failed to set should display download all error', error);
    });
  };

  return (
    <div class="mx-6 mb-6 flex items-center justify-between">
      <IconButton onClick={() => fileInputRef?.click()} class="mr-3">
        <input
          type="file"
          accept=".doc,.docx"
          multiple
          onChange={handleSelectFiles}
          class="hidden"
          ref={fileInputRef}
        />
        <PlusIcon class="w-[25] text-gray-50" />
      </IconButton>

      <div>
        <Button variant="outlined" onClick={handleDeleteAll}>
          Clear list
        </Button>
        <Tooltip text={tooltipText()}>
          <Button disabled={!hasFilesToDownload() || isBatching()} onClick={handleDownloadAll} class="ml-3">
            Download all
            {isBatching() && (
              <div class="ml-2 h-[1em] w-[1em] animate-spin rounded-full border-4 border-gray-300 border-t-blue-500" />
            )}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

function getBatchRequestErrorTooltipText(errorType: BatchRequestErrorType) {
  const errorTypeToText: Record<string, string> = {
    [BatchRequestErrorType.QuotaExceeded]: `Last download all attempt failed because download all files limit was exceeded (current limit is ${config.batchLimit} per ${config.batchLimitReadable}), please try again`,
  };

  return errorTypeToText[errorType] || 'Last download all attempt failed, please try again';
}

function getBatchErrorTooltipText(_batchError: string) {
  // TODO add error codes
  return `Last download all attempt failed, please try again`;
}
