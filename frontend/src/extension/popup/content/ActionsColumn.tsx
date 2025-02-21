import { createMemo, createSignal, onCleanup } from 'solid-js';
import { twMerge } from 'tailwind-merge';

import { Tooltip } from '../../../components/Tooltip';
import { config } from '../../../Config';
import DownloadIcon from '../../../icons/download.svg?component-solid';
import RemoveIcon from '../../../icons/remove.svg?component-solid';
import { chromeStorage, ConvertRequest, isLocalConvertRequest } from '../../../Storage';
import { checkFileHasBeenDeleted } from './checkFileHasBeenDeleted';

export function ActionsColumn(props: { convertRequest: ConvertRequest }) {
  const [currentTime, setCurrentTime] = createSignal(Date.now());
  const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
  onCleanup(() => clearInterval(interval));

  const hasFileBeenConverted = createMemo(() => props.convertRequest.status === 'done');
  const hasFileBeenDeleted = createMemo(() => checkFileHasBeenDeleted(props.convertRequest, currentTime()));
  const isDownloadPossible = createMemo(() => hasFileBeenConverted() && !hasFileBeenDeleted());

  const handleRemove = (convertRequest: ConvertRequest) => {
    console.log('Removing convert request', convertRequest);
    chromeStorage
      .removeConvertRequest(
        isLocalConvertRequest(convertRequest)
          ? {
              convertRequestId: undefined,
              convertRequestBeingCreatedId: convertRequest.convertRequestBeingCreatedId,
            }
          : {
              convertRequestId: convertRequest.id,
              convertRequestBeingCreatedId: undefined,
            },
      )
      .catch((error) => {
        console.error('Failed to remove convert request', error);
      });
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
          onClick={() => handleDownload(props.convertRequest.id || '-1')}
          class={twMerge(
            'block rounded-md bg-sky-800 fill-gray-50 p-1',
            isDownloadPossible() && 'cursor-pointer transition-colors duration-100 hover:bg-sky-700',
            !isDownloadPossible() && 'cursor-not-allowed opacity-30',
          )}
        >
          <DownloadIcon />
        </button>
      </Tooltip>
      <button
        onClick={() => handleRemove(props.convertRequest)}
        class="block cursor-pointer fill-gray-400 pl-3 transition-colors duration-100 hover:fill-gray-300"
      >
        <RemoveIcon />
      </button>
    </>
  );
}
