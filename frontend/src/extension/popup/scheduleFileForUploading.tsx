import { createId } from '@paralleldrive/cuid2';

import { EventTypes } from '../events';
import { popupChromeMessaging } from '../Messaging';
import { chromeStorage } from '../Storage';

export const scheduleFileForUploading = async (file: File) => {
  let fileId: string;
  try {
    fileId = await chromeStorage.saveFileForUploading(file);
  } catch (error) {
    throw new Error(`Could not save file for uploading to DB: ${error}`);
  }

  const convertRequestBeingCreatedId = createId();

  await chromeStorage.appendConvertRequestBeingCreated({
    id: convertRequestBeingCreatedId,
    fileName: file.name,
    fileId,
  });

  await popupChromeMessaging.sendMessage({
    type: EventTypes.WordDocumentSelected,
    convertRequestBeingCreatedId,
    fileId,
    fileName: file.name,
    fileSize: file.size,
  });
};
