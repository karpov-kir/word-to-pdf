import { JSX } from 'solid-js/jsx-runtime';
import { twMerge } from 'tailwind-merge';

export function Button(props: JSX.IntrinsicElements['button']) {
  return (
    <button
      {...props}
      class={twMerge(
        'rounded-sm bg-sky-800 px-6 py-2 text-base text-gray-50',
        props.class,
        !props.disabled && 'cursor-pointer transition-colors duration-100 hover:bg-sky-700',
        props.disabled && 'cursor-not-allowed opacity-30',
      )}
    >
      {props.children}
    </button>
  );
}
