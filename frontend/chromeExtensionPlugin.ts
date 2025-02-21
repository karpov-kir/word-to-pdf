import * as fs from 'fs';
import * as path from 'path';
import { InputOption, OutputAsset, OutputBundle, OutputChunk } from 'rollup';
import { Plugin } from 'vite';
import zl from 'zip-lib';

import { createManifestContent } from './manifest';

export const chromeExtensionPlugin = (): Plugin => ({
  name: 'chrome-extension',
  async writeBundle(options, bundle) {
    const config = this.environment.config;
    const build = config.build;
    const input = build.rollupOptions.input;

    if (!input) {
      throw new Error('Missing "rollupOptions.input"');
    }

    const popupAsset = findAssetForInput(bundle, 'popup', input);
    const contentScriptWrapperChunk = findChunkForInput(bundle, 'contentScriptWrapper', input);
    const serviceWorkerChunk = findChunkForInput(bundle, 'serviceWorker', input);

    const manifest = createManifestContent({
      popupPath: popupAsset.fileName,
      contentScriptWrapperPath: contentScriptWrapperChunk.fileName,
      serviceWorkerPath: serviceWorkerChunk.fileName,
    });

    writeManifestJson(build.outDir, manifest);
    writeWebAccessibleResources(manifest, build.outDir);

    const contentScriptChunk = findChunkForInput(bundle, 'contentScript', input);
    replaceContentScriptPathPlaceholder({
      buildDirPath: build.outDir,
      contentScriptWrapperPath: contentScriptWrapperChunk.fileName,
      contentScriptPath: contentScriptChunk.fileName,
    });

    // CSS
    // const cssAssetForContentScriptChunk = findCssAssetForInput(bundle, 'contentScript');
    // replaceShadowDomStylesPlaceholder({
    //   buildDirPath: build.outDir,
    //   contentScriptPath: contentScriptChunk.fileName,
    //   contentScriptCssPath: cssAssetForContentScriptChunk.fileName,
    // });

    copyLocales(build.outDir);
    copyIcons(build.outDir);
    await createBuildArchive(build.outDir, this.environment.config.mode);
  },
});

// config.build.rollupOptions.input
function getInputPath(inputName: string, input: InputOption) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !(inputName in input)) {
    throw new Error(`Missing "${inputName}" entry in the "rollupOptions.input"`);
  }

  return input[inputName];
}

function getInputAbsolutePath(inputName: string, input: InputOption): string {
  return path.resolve(__dirname, getInputPath(inputName, input));
}

function assertAsset(
  inputName: string,
  chunkOrAsset: OutputChunk | OutputAsset | undefined,
): asserts chunkOrAsset is OutputAsset {
  if (!chunkOrAsset || chunkOrAsset.type !== 'asset') {
    throw new Error(`Could not find asset for "${inputName}"`);
  }
}

function findAssetForInput(bundle: OutputBundle, inputName: string, input: InputOption): OutputAsset {
  const inputAbsolutePath = getInputAbsolutePath(inputName, input);

  const asset = Object.values(bundle).find(
    (chunkOrAsset) => chunkOrAsset.type === 'asset' && chunkOrAsset.originalFileNames.includes(inputAbsolutePath),
  );

  assertAsset(inputName, asset);

  return asset;
}

function findCssAssetForInput(bundle: OutputBundle, inputName: string) {
  const asset = Object.values(bundle).find(
    (chunkOrAsset) => chunkOrAsset.type === 'asset' && chunkOrAsset.names.includes(`${inputName}.css`),
  );

  assertAsset(inputName, asset);

  return asset;
}

function assertChunk(
  inputName: string,
  chunkOrAsset: OutputChunk | OutputAsset | undefined,
): asserts chunkOrAsset is OutputChunk {
  if (!chunkOrAsset || chunkOrAsset.type !== 'chunk') {
    throw new Error(`Could not find chunk for "${inputName}"`);
  }
}

function findChunkForInput(bundle: OutputBundle, inputName: string, input: InputOption): OutputChunk {
  const inputAbsolutePath = getInputAbsolutePath(inputName, input);

  const chunk = Object.values(bundle).find(
    (chunkOrAsset) => chunkOrAsset.type === 'chunk' && chunkOrAsset.facadeModuleId === inputAbsolutePath,
  );

  assertChunk(inputName, chunk);

  return chunk;
}

function writeManifestJson(buildDirPath: string, manifest: chrome.runtime.ManifestV3) {
  fs.writeFileSync(path.join(buildDirPath, '/manifest.json'), JSON.stringify(manifest, null, 2));
}

function writeWebAccessibleResources(manifest: chrome.runtime.ManifestV3, buildDirPath: string) {
  const webAccessibleResourcesPaths = (manifest.web_accessible_resources ?? []).reduce<string[]>(
    (accumulator, { resources }) => [...accumulator, ...resources],
    [],
  );

  webAccessibleResourcesPaths.forEach((webAccessibleResourcePath) => {
    // Extract only files that exist in the project.
    if (!fs.existsSync(webAccessibleResourcePath)) {
      return;
    }

    const writePath = path.join(buildDirPath, webAccessibleResourcePath);

    // Copy them to the build directory.
    fs.mkdirSync(path.dirname(writePath), { recursive: true });
    fs.copyFileSync(webAccessibleResourcePath, writePath);
  });
}

function replaceContentScriptPathPlaceholder({
  buildDirPath,
  contentScriptWrapperPath,
  contentScriptPath,
}: {
  buildDirPath: string;
  contentScriptWrapperPath: string;
  contentScriptPath: string;
}) {
  const contentScriptWrapperContent = fs.readFileSync(path.join(buildDirPath, contentScriptWrapperPath), 'utf-8');
  const updatedContentScriptWrapperContent = contentScriptWrapperContent.replace(
    '<contentScriptPath>',
    contentScriptPath,
  );

  fs.writeFileSync(path.join(buildDirPath, contentScriptWrapperPath), updatedContentScriptWrapperContent);
}

function replaceShadowDomStylesPlaceholder({
  buildDirPath,
  contentScriptPath,
  contentScriptCssPath,
}: {
  buildDirPath: string;
  contentScriptPath: string;
  contentScriptCssPath: string;
}) {
  const contentScriptContent = fs.readFileSync(path.join(buildDirPath, contentScriptPath), 'utf-8');
  const contentScriptCssContent = fs
    .readFileSync(path.join(buildDirPath, contentScriptCssPath), 'utf-8')
    .trim()
    .replace(/"/g, '\\"');

  const updatedContentScriptContent = contentScriptContent.replace('#shadowDomStyles#', contentScriptCssContent);

  fs.writeFileSync(path.join(buildDirPath, contentScriptPath), updatedContentScriptContent);
  fs.rmSync(path.join(buildDirPath, contentScriptCssPath));
}

function copyLocales(buildDirPath: string) {
  fs.cpSync(path.join(__dirname, 'locales'), path.join(buildDirPath, '_locales'), {
    recursive: true,
  });
}

function copyIcons(buildDirPath: string) {
  fs.cpSync(path.join(__dirname, 'icons'), path.join(buildDirPath, 'icons'), {
    recursive: true,
  });
}

async function createBuildArchive(buildDirPath: string, mode: string) {
  await zl.archiveFolder(buildDirPath, path.join(__dirname, `word-to-pdf-${mode}.zip`));
}
