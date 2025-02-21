import { createMemo, splitProps } from 'solid-js';
import { JSX } from 'solid-js/jsx-runtime';
import { twMerge } from 'tailwind-merge';

type ButtonProps = JSX.IntrinsicElements['button'] & {
  variant?: 'outlined' | 'contained';
};

export function Button(props: ButtonProps) {
  const [privateProps, inheritProps] = splitProps(props, ['variant', 'children']);

  const variantClasses = createMemo(() =>
    privateProps.variant === 'outlined' ? 'inset-ring-2 inset-ring-sky-400 text-sky-400' : 'bg-sky-700 text-gray-50',
  );
  const variantHoverClasses = createMemo(() =>
    privateProps.variant === 'outlined' ? 'hover:inset-ring-sky-500 hover:text-sky-500' : 'hover:bg-sky-800',
  );

  return (
    <button
      {...inheritProps}
      class={twMerge(
        'inline-flex items-center rounded-sm px-6 py-2 text-base',
        variantClasses(),
        inheritProps.class,
        !inheritProps.disabled && 'cursor-pointer transition-colors',
        !inheritProps.disabled && variantHoverClasses(),
        inheritProps.disabled && 'cursor-not-allowed opacity-30',
      )}
    >
      {privateProps.children}
    </button>
  );
}
