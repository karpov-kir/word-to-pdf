import { JSX, Show } from 'solid-js';
import { twMerge } from 'tailwind-merge';

import { Button } from '../../../components/Button';
import DownloadIcon from '../../../icons/download.svg?component-solid';
import { scheduleFileForUploading } from '../scheduleFileForUploading';

export function EmptyContent(props: { isDragging: boolean }) {
  let fileInputRef: HTMLInputElement | undefined;

  const handleSelectFiles: JSX.ChangeEventHandler<HTMLInputElement, Event> = async (event) => {
    const target = event.target as HTMLInputElement;

    Array.from(target.files ?? []).forEach((file) => {
      scheduleFileForUploading(file).catch((error) => {
        console.error('Failed to schedule file for uploading', error);
      });
    });
  };

  return (
    <div
      class={twMerge(
        'm-6 flex grow flex-col items-center justify-center rounded-md bg-gray-900 light:bg-slate-200 transition-colors',
      )}
    >
      <Show when={!props.isDragging}>
        <Button onClick={() => fileInputRef?.click()} class="mb-3 px-6 py-3">
          <input
            type="file"
            accept=".doc,.docx"
            multiple
            onChange={handleSelectFiles}
            class="hidden"
            ref={fileInputRef}
          />
          Select files
          <DownloadIcon class="ml-1 w-[20] text-gray-50" />
        </Button>
        <span class="text-base text-gray-50 light:text-slate-800 transition-colors">or drop files here</span>
      </Show>
    </div>
  );
}
