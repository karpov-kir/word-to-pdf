import { filesize } from 'filesize';
import { For } from 'solid-js';
import { twMerge } from 'tailwind-merge';

import { CombinedConvertRequest } from '../CombinedConvertRequest';
import { ActionsColumn } from './ActionsColumn';
import classNames from './Content.module.css';
import { StatusColumn } from './StatusColumn';

export function Content(props: { combinedConvertRequests: CombinedConvertRequest[] }) {
  const baseRowClasses = 'flex text-sm mb-3';
  const titleRowClasses = `${baseRowClasses} text-gray-300 light:text-slate-600 transition-colors`;
  const rowClasses = `${baseRowClasses} items-center transition-colors`;

  const numberColClasses = 'w-[25] min-w-[25] mr-5 text-gray-300 light:text-slate-600';
  const nameColClasses = 'grow truncate mr-5 text-gray-50 light:text-gray-950';
  const sizeColClasses = 'w-[90] min-w-[90] mr-5 truncate text-gray-300 light:text-slate-600';
  const statusColClasses = 'w-[80] min-w-[80] mr-5 text-gray-300 light:text-slate-600';
  const actionColClasses = 'w-[70] min-w-[70] flex';

  return (
    <div
      class={twMerge(
        'bg-gray-900 m-6 grow overflow-auto rounded-md p-3 light:bg-slate-200 transition-colors',
        classNames['file-list-container'],
      )}
    >
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
                <ActionsColumn combinedConvertRequest={combinedConvertRequest} />
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}
