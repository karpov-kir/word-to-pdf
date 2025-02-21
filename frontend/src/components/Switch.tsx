import { splitProps } from 'solid-js';
import { JSX } from 'solid-js/jsx-runtime';

export function Switch(props: JSX.IntrinsicElements['label'] & { checked?: boolean }) {
  const [privateProps, inheritProps] = splitProps(props, ['children', 'checked']);

  return (
    <label class="inline-flex cursor-pointer items-center" {...inheritProps}>
      <input type="checkbox" value="" checked={privateProps.checked} class="peer hidden" />
      <span class="mr-2 text-sm text-gray-50 light:text-gray-950 transition-colors">{privateProps.children}</span>
      <div
        class="peer relative h-[20] w-[40] rounded-lg bg-slate-400 peer-checked:bg-sky-700 after:absolute after:right-[calc(100%-15px)]
          after:top-[4] after:h-[12] after:w-[12] after:rounded-full after:border after:border-gray-50 after:bg-gray-50
          after:transition-all after:content-[''] peer-checked:after:right-[3px]"
      />
    </label>
  );
}
