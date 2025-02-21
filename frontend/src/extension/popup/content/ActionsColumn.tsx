import { createMemo, createSignal, onCleanup } from 'solid-js';
import { twMerge } from 'tailwind-merge';

import { Tooltip } from '../../../components/Tooltip';
import { config } from '../../../Config';
import { CancelUploadWordDocumentEvent, EventTypes } from '../../../events';
import DownloadIcon from '../../../icons/download.svg?component-solid';
import RemoveIcon from '../../../icons/remove.svg?component-solid';
import { chromeStorage, isLocalConvertRequest } from '../../../Storage';
import { CombinedConvertRequest } from '../CombinedConvertRequest';
import { checkFileHasBeenDeleted } from './checkFileHasBeenDeleted';

export function ActionsColumn(props: { combinedConvertRequest: CombinedConvertRequest }) {
  const [currentTime, setCurrentTime] = createSignal(Date.now());
  const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
  onCleanup(() => clearInterval(interval));

  const hasFileBeenConverted = createMemo(() => props.combinedConvertRequest.status === 'done');
  const hasFileBeenDeleted = createMemo(() => checkFileHasBeenDeleted(props.combinedConvertRequest, currentTime()));
  const isDownloadPossible = createMemo(() => hasFileBeenConverted() && !hasFileBeenDeleted());

  const handleRemove = (combinedConvertRequest: CombinedConvertRequest) => {
    console.log('Removing convert request', combinedConvertRequest);
    chromeStorage
      .removeConvertRequest(
        isLocalConvertRequest(combinedConvertRequest)
          ? {
              convertRequestId: undefined,
              convertRequestBeingCreatedId: combinedConvertRequest.convertRequestBeingCreatedId,
            }
          : {
              convertRequestId: combinedConvertRequest.id,
              convertRequestBeingCreatedId: undefined,
            },
      )
      .catch((error) => {
        console.error('Failed to remove convert request', error);
      });

    if (combinedConvertRequest.convertRequestBeingCreated) {
      chrome.runtime
        .sendMessage<CancelUploadWordDocumentEvent>({
          type: EventTypes.CancelUploadWordDocument,
          fileId: combinedConvertRequest.convertRequestBeingCreated.fileId,
        })
        .catch((error) => {
          console.error('Failed to send cancel upload document event', error);
        });
    }
  };

  const handleDownload = (convertRequestId: string) => {
    console.log('Downloading convert request', convertRequestId);
    const url = `${config.wordToPdfApiBaseUrl}/download/pdf/${convertRequestId}`;

    chrome.downloads.download({ url }).catch((error) => {
      console.error(`Failed to download file from convert request ${convertRequestId}`, error);
    });
  };

  return (
    <>
      <Tooltip text="The file is no longer available" enabled={hasFileBeenDeleted()}>
        <button
          disabled={!isDownloadPossible}
          onClick={() => handleDownload(props.combinedConvertRequest.id || '-1')}
          class={twMerge(
            'block rounded-md bg-sky-700 p-1',
            isDownloadPossible() && 'cursor-pointer transition-colors hover:bg-sky-800',
            !isDownloadPossible() && 'cursor-not-allowed opacity-30',
          )}
        >
          <DownloadIcon class="w-[20] text-gray-50" />
        </button>
      </Tooltip>
      <button
        onClick={() => handleRemove(props.combinedConvertRequest)}
        class="block cursor-pointer pl-3 transition-colors"
      >
        <RemoveIcon class="w-[28] text-gray-400 hover:text-gray-300 light:text-slate-400 light:hover:text-slate-500" />
      </button>
    </>
  );
}
