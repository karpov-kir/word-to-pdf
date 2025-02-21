import { createEffect, createSignal, onCleanup, Show } from 'solid-js';
import solidToast from 'solid-toast';
import { twMerge } from 'tailwind-merge';

import CloseIcon from '../icons/close.svg?component-solid';
import ErrorIcon from '../icons/error.svg?component-solid';
import SuccessIcon from '../icons/success.svg?component-solid';
import WarningIcon from '../icons/warning.svg?component-solid';
import classNames from './toast.module.css';

export const defaultDuration = 5000;

const gradientClassMap = {
  success: 'bg-[radial-gradient(50%_50%_at_50%_50%,rgba(0,237,81,0.12)_0%,rgba(0,237,123,0)_100%)] light:bg-none',
  warning: 'bg-[radial-gradient(50%_50%_at_50%_50%,rgba(255,212,38,0.11)_0%,rgba(255,212,38,0)_100%)] light:bg-none',
  error: 'bg-[radial-gradient(50%_50%_at_50%_50%,rgba(240,66,72,0.13)_0%,rgba(240,66,72,0)_100%)] light:bg-none',
};

const iconComponentMap = {
  error: ErrorIcon,
  success: SuccessIcon,
  warning: WarningIcon,
};

const ringClassMap = {
  success: 'bg-gray-700 light:bg-emerald-50',
  warning: 'bg-gray-700 light:bg-amber-50',
  error: 'bg-gray-700 light:bg-red-50',
};

const progressClassMap = {
  success: 'bg-emerald-500',
  warning: 'bg-yellow-400',
  error: 'bg-red-500',
};

export function toast({
  message,
  severity = 'success',
  duration = defaultDuration,
  title,
  onClose,
  autoClose = true,
}: {
  message: string;
  severity?: 'error' | 'success' | 'warning';
  duration?: number;
  title?: string;
  autoClose?: boolean;
  onClose?: () => void;
}) {
  const Icon = iconComponentMap[severity];

  return solidToast.custom(
    (t) => {
      const [life, setLife] = createSignal(100);
      const startTime = Date.now();

      const handleClose = () => {
        solidToast.dismiss(t.id);
        onClose?.();
      };

      createEffect(() => {
        if (t.paused || !autoClose) {
          return;
        }

        const intervalId = setInterval(() => {
          const timeDiff = Date.now() - startTime - t.pauseDuration;
          setLife(100 - (timeDiff / duration) * 100);

          if (timeDiff >= duration) {
            handleClose();
          }
        }, 15);

        onCleanup(() => clearInterval(intervalId));
      });

      return (
        <div
          class={twMerge(
            'min-w-[350px] overflow-hidden rounded-md bg-slate-800 shadow-md light:bg-slate-50 transition-colors',
            t.visible ? classNames['animate-enter'] : classNames['animate-leave'],
          )}
        >
          <div class="flex items-start p-3">
            <div class={twMerge('relative mr-4 rounded-full p-1 transition-colors', ringClassMap[severity])}>
              <Icon class="h-[24] w-[24]" />
              <div
                class={twMerge(
                  'absolute top-[calc(50%-106px)] left-[calc(50%-106px)] h-[212] w-[212]',
                  gradientClassMap[severity],
                )}
              />
            </div>
            <div class="relative mr-3 grow">
              <Show when={title}>
                <div class="text-sm font-semibold text-gray-50 light:text-slate-700 transition-colors">{title}</div>
              </Show>
              <div class="text-xs text-slate-300 light:text-slate-500 transition-colors">{message}</div>
            </div>
            <button onClick={handleClose} class="cursor-pointer transition-colors">
              <CloseIcon class="h-[24] w-[24] text-gray-400 hover:text-gray-300" />
            </button>
          </div>
          <Show when={autoClose}>
            <div class="relative">
              <div class="h-[4] w-full" />
              <div
                class={twMerge('absolute h-[4] top-[0] left-[-2] rounded-md', progressClassMap[severity])}
                style={{ width: `calc(${life()}% + 4px` }}
              />
              <div
                class={twMerge(
                  'absolute h-[4] top-[0] left-[-2] blur-sm light:hidden rounded-md',
                  progressClassMap[severity],
                )}
                style={{ width: `calc(${life()}% + 4px)` }}
              />
            </div>
          </Show>
        </div>
      );
    },
    {
      // To handle close manually
      duration: Infinity,
    },
  );
}
