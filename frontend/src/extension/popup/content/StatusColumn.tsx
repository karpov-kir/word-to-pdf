import { filesize } from 'filesize';
import { createMemo, createSignal, onCleanup, Show } from 'solid-js';

import { Tooltip } from '../../../components/Tooltip';
import { config } from '../../../Config';
import { ConvertRequestErrorType } from '../../../Storage';
import { CombinedConvertRequest } from '../CombinedConvertRequest';
import { checkFileHasBeenDeleted } from './checkFileHasBeenDeleted';
import { UploadIndicator } from './UploadIndicator';

export function StatusColumn(props: { combinedConvertRequest: CombinedConvertRequest }) {
  const [currentTime, setCurrentTime] = createSignal(Date.now());
  const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
  onCleanup(() => clearInterval(interval));

  const hasFileBeenDeleted = createMemo(() => checkFileHasBeenDeleted(props.combinedConvertRequest, currentTime()));

  const errorType = createMemo(() => props.combinedConvertRequest.convertRequestBeingCreated?.errorType);
  const error = createMemo(() => props.combinedConvertRequest.error);
  const uploadProgress = createMemo(() => props.combinedConvertRequest.convertRequestBeingCreated?.uploadProgress);
  const status = createMemo(() => {
    if (hasFileBeenDeleted()) {
      return 'Expired';
    }

    return props.combinedConvertRequest.status;
  });

  const errorText = createMemo(() => {
    const errorTypeValue = errorType();
    if (errorTypeValue) {
      return getConvertRequestErrorTooltipText(errorTypeValue);
    }

    const errorValue = error();
    if (errorValue) {
      return getConvertErrorTooltipText(errorValue);
    }
  });

  return (
    <>
      <Show when={errorText()}>
        <Tooltip text={errorText()}>
          <span class="text-red-400">Error</span>
        </Tooltip>
      </Show>
      <Show when={!errorText() && Number.isFinite(uploadProgress())} keyed>
        <UploadIndicator progress={uploadProgress()!} />
      </Show>
      <Show when={!errorText() && !Number.isFinite(uploadProgress())}>
        <span class="capitalize">{status()}</span>
      </Show>
    </>
  );
}

function getConvertRequestErrorTooltipText(errorType: ConvertRequestErrorType): string {
  const errorTypeToText: Record<string, string> = {
    [ConvertRequestErrorType.FileTooLarge]: `The file is too large (max allowed is ${filesize(config.maxFileSizeBytes, {
      standard: 'iec',
    })})`,
    [ConvertRequestErrorType.QuotaExceeded]: `Conversion limit reached, please try again later (current limit is ${config.conversionLimitPerHour} per hour)`,
  };

  return errorTypeToText[errorType] || 'Could not convert file, please try again later';
}

function getConvertErrorTooltipText(_convertError: string) {
  // TODO add error codes
  return `Could not convert file, please try again later`;
}
