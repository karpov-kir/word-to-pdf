import { createMemo, Show } from 'solid-js';
import { twMerge } from 'tailwind-merge';

export function UploadIndicator(props: { progress: number }) {
  const isFinished = createMemo(() => props.progress >= 100);

  return (
    <div
      class={twMerge(
        'flex h-5 w-16 items-center justify-center overflow-hidden rounded-sm text-xs text-white',
        isFinished() ? 'bg-sky-800' : 'relative bg-gray-800',
      )}
    >
      <Show when={!isFinished()}>
        <div
          class="absolute top-0 bottom-0 left-0 bg-gray-500"
          style={{
            width: `${props.progress}%`,
          }}
        />
      </Show>

      <div class={twMerge(!isFinished() && 'relative')}>{props.progress}%</div>
    </div>
  );
}
