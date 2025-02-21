import { EventTypes, WordDocumentSelectedEvent } from '../../events';

export const sendWordDocumentToWorker = (file: File) => {
  const reader = new FileReader();

  reader.addEventListener('load', (event) => {
    if (!event.target) {
      console.error('No target in FileReader onload event');
      return;
    }

    const fileContent = event.target.result;

    if (!fileContent) {
      console.error('No file content in FileReader onload event');
      return;
    }

    if (typeof fileContent !== 'string') {
      console.error('Failed to convert selected Word document to base64');
      return;
    }

    console.log(`Sending ${EventTypes.WordDocumentSelected} event using file`, file);
    chrome.runtime
      .sendMessage<WordDocumentSelectedEvent>({
        type: EventTypes.WordDocumentSelected,
        wordDocumentBase64: fileContent,
        fileType: file.type,
        fileName: file.name,
        fileSize: file.size,
      })
      .catch((error) => {
        console.error(`Failed to send ${EventTypes.WordDocumentSelected} event`, error);
      });
  });

  reader.readAsDataURL(file);
};
