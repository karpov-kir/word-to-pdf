import { splitProps } from 'solid-js';
import { JSX } from 'solid-js/jsx-runtime';

export function IconButton(props: JSX.IntrinsicElements['button']) {
  const [privateProps, inheritProps] = splitProps(props, ['children']);

  return (
    <button
      {...inheritProps}
      class={`inline-flex h-[32] w-[32] cursor-pointer items-center justify-center rounded-full bg-sky-700 transition-colors
        hover:bg-sky-800`}
    >
      {privateProps.children}
    </button>
  );
}
