import CorvuTooltip from '@corvu/tooltip';
import { createMemo } from 'solid-js';
import { JSX } from 'solid-js/jsx-runtime';

export const Tooltip = (props: { text?: string; enabled?: boolean; children: JSX.Element }) => {
  const open = createMemo(() => (props.enabled === false ? false : !props.text ? false : undefined));
  return (
    <CorvuTooltip
      placement="top"
      openDelay={100}
      open={open()}
      floatingOptions={{
        offset: 13,
        flip: true,
        shift: true,
      }}
    >
      <CorvuTooltip.Trigger class="inline-flex" as={'span'}>
        {props.children}
      </CorvuTooltip.Trigger>
      <CorvuTooltip.Portal>
        <CorvuTooltip.Content class="rounded-lg bg-gray-800 px-3 py-1 text-sm text-white">
          {props.text}
          <CorvuTooltip.Arrow class="text-gray-800" />
        </CorvuTooltip.Content>
      </CorvuTooltip.Portal>
    </CorvuTooltip>
  );
};
