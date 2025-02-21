export async function createOffscreenDocument() {
  console.log('Creating offscreen document');

  if (await chrome.offscreen.hasDocument()) {
    console.log('Offscreen document already exists, skipping creation');
    return;
  }

  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL('src/extension/offscreen/offscreen.html'),
    reasons: [chrome.offscreen.Reason.BLOBS],
    justification: 'Upload files to convert them to PDF exposing progress and keeps the service worker alive',
  });
}
