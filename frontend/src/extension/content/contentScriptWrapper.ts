// Unlike popup and background, content script is not a module.
// To fix this we split up the content script into two. The entry point file will import the main file which is generated as a different file.
// The main file is considered a module when its lazily imported and in the main file we can use imports.
// Credit to: https://ajaynjain.medium.com/how-i-built-a-chrome-extension-with-react-and-vite-without-crxjs-plugin-b607194c4f5e.
(async () => {
  const contentScriptPath = chrome.runtime.getURL('<contentScriptPath>');
  await import(contentScriptPath);
})();
