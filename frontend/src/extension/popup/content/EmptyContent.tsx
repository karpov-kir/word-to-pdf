import { Show } from 'solid-js';
import { twMerge } from 'tailwind-merge';

import { Button } from '../../../components/Button';
import { sendWordDocumentToWorker } from '../sendWordDocumentToWorker';

export function EmptyContent(props: { isDragging: boolean }) {
  let fileInputRef: HTMLInputElement | undefined;

  const handleFileChange = async (event: Event) => {
    const target = event.target as HTMLInputElement;

    if (!target.files?.length) {
      console.log('No file has been selected, nothing to convert');
      return;
    }

    Array.from(target.files).forEach((file) => {
      sendWordDocumentToWorker(file);
    });
  };

  return (
    <div class={twMerge(`m-6 flex grow flex-col items-center justify-center rounded-md bg-gray-900`)}>
      <Show when={!props.isDragging}>
        <Button onClick={() => fileInputRef?.click()} class="mb-3">
          <input
            type="file"
            accept=".doc,.docx"
            multiple
            onChange={handleFileChange}
            class="hidden"
            ref={fileInputRef}
          />
          Select files
        </Button>
        <span class="text-sm text-gray-50">or drop files here</span>
      </Show>
    </div>
  );
}
