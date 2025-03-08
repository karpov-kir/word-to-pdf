import { filesize } from 'filesize';
import { createMemo, createSignal, onCleanup, Show } from 'solid-js';

import { Tooltip } from '../../../components/Tooltip';
import { config } from '../../../Config';
import { ConvertRequestErrorType } from '../../Storage';
import { CombinedConvertRequest } from '../CombinedConvertRequest';
import { checkFileHasBeenDeleted } from './checkFileHasBeenDeleted';
import { UploadIndicator } from './UploadIndicator';

export function StatusColumn(props: { combinedConvertRequest: CombinedConvertRequest }) {
  const [currentTime, setCurrentTime] = createSignal(Date.now());
  const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
  onCleanup(() => clearInterval(interval));

  const hasFileBeenDeleted = createMemo(() => checkFileHasBeenDeleted(props.combinedConvertRequest, currentTime()));

  const errorType = createMemo(() => props.combinedConvertRequest.convertRequestBeingCreated?.errorType);
  const uploadProgress = createMemo(() => props.combinedConvertRequest.convertRequestBeingCreated?.uploadProgress);
  const status = createMemo(() => {
    if (hasFileBeenDeleted()) {
      return 'expired';
    }

    return props.combinedConvertRequest.status;
  });

  const errorText = createMemo(() => {
    const errorTypeValue = errorType();
    if (errorTypeValue) {
      return getConvertRequestErrorTooltipText(errorTypeValue);
    }

    if (status() === 'error') {
      return 'Could not convert file, please try again';
    }
  });

  return (
    <>
      <Show when={errorText()}>
        <Tooltip text={errorText()}>
          <span class="text-red-500 font-semibold">Error</span>
        </Tooltip>
      </Show>
      <Show when={!errorText() && Number.isFinite(uploadProgress())} keyed>
        <UploadIndicator progress={uploadProgress()!} />
      </Show>
      <Show when={!errorText() && !Number.isFinite(uploadProgress())}>
        <span class="capitalize font-semibold">{status()}</span>
      </Show>
    </>
  );
}

function getConvertRequestErrorTooltipText(errorType: ConvertRequestErrorType): string {
  const errorTypeToText: Record<string, string> = {
    [ConvertRequestErrorType.FileTooLarge]: `The file is too large (max allowed is ${filesize(config.maxFileSizeBytes, {
      standard: 'iec',
    })})`,
    [ConvertRequestErrorType.QuotaExceeded]: `Conversion limit reached, please try again (current limit is ${config.conversionLimit} per ${config.conversionLimitReadable})`,
  };

  return errorTypeToText[errorType] || 'Could not convert file, please try again';
}
