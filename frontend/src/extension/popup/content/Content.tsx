import { filesize } from 'filesize';
import { For } from 'solid-js';
import { twMerge } from 'tailwind-merge';

import { CombinedConvertRequest } from '../CombinedConvertRequest';
import { ActionsColumn } from './ActionsColumn';
import classNames from './Content.module.css';
import { StatusColumn } from './StatusColumn';

export function Content(props: { combinedConvertRequests: CombinedConvertRequest[] }) {
  const baseRowClasses = 'flex text-sm mb-3';
  const titleRowClasses = `${baseRowClasses} text-gray-300`;
  const rowClasses = `${baseRowClasses} items-center text-gray-50`;

  const numberColClasses = 'w-[25] min-w-[25] mr-3';
  const nameColClasses = 'grow mr-3 truncate';
  const sizeColClasses = 'w-[100] min-w-[100] mr-3 truncate';
  const statusColClasses = 'w-[70] min-w-[70] mr-3';
  const actionColClasses = 'w-[70] min-w-[70] flex';

  return (
    <div class={twMerge(`g-gray-900 m-6 grow overflow-auto rounded-md p-3`, classNames['file-list-container'])}>
      <div class={titleRowClasses}>
        <div class={numberColClasses}>N</div>
        <div class={nameColClasses}>Name</div>
        <div class={sizeColClasses}>Size</div>
        <div class={statusColClasses}>Status</div>
        <div class={actionColClasses}>Actions</div>
      </div>
      <For each={props.combinedConvertRequests}>
        {(combinedConvertRequest, combinedConvertRequestIndex) => {
          return (
            <div class={rowClasses}>
              <div class={numberColClasses}>{combinedConvertRequestIndex() + 1}</div>
              <div class={nameColClasses}>{combinedConvertRequest.fileName}</div>
              <div class={sizeColClasses}>
                {filesize(combinedConvertRequest.fileSize, {
                  standard: 'iec',
                })}
              </div>
              <div class={statusColClasses}>
                <StatusColumn combinedConvertRequest={combinedConvertRequest} />
              </div>
              <div class={actionColClasses}>
                <ActionsColumn convertRequest={combinedConvertRequest} />
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}
