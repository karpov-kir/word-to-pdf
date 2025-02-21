import { EventTypes, WordDocumentSelectedEvent } from '../../events';
import { chromeStorage } from '../../Storage';

export const scheduleFileForUploading = async (file: File) => {
  let fileId: string;
  try {
    fileId = await chromeStorage.saveFileForUploading(file);
  } catch (error) {
    throw new Error(`Could not save file for uploading to DB: ${error}`);
  }

  try {
    await chrome.runtime.sendMessage<WordDocumentSelectedEvent>({
      type: EventTypes.WordDocumentSelected,
      fileId,
      fileType: file.type,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error) {
    throw new Error(`Failed to send ${EventTypes.WordDocumentSelected} event: ${error}`);
  }
};
