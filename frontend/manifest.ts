import * as packageJson from './package.json';

const { version } = packageJson;

// Convert from Semver (example: 0.1.0-beta6)
const [major, minor, patch, label = '0'] = version
  // can only contain digits, dots, or dash
  .replace(/[^\d.-]+/g, '')
  // split into version parts
  .split(/[.-]/);

export const getManifest = ({
  mode,
  popupPath,
  // contentScriptWrapperPath,
  serviceWorkerPath,
}: {
  mode: string;
  popupPath: string;
  contentScriptWrapperPath: string;
  serviceWorkerPath: string;
}) => {
  const manifest: chrome.runtime.ManifestV3 = {
    manifest_version: 3,
    name: mode === 'development' ? 'Word to PDF [DEV]' : 'Word to PDF',
    // up to four numbers separated by dots
    version: `${major}.${minor}.${patch}.${label}`,
    // semver is OK in "version_name"
    version_name: version,
    permissions: ['offscreen', 'storage', 'downloads'],
    action: { default_popup: popupPath },
    // content_scripts: [
    //   {
    //     js: [contentScriptWrapperPath],
    //     matches: ['<all_urls>'],
    //   },
    // ],
    web_accessible_resources: [
      {
        resources: ['assets/*'],
        matches: ['<all_urls>'],
      },
    ],
    background: {
      service_worker: serviceWorkerPath,
      type: 'module',
    },
  };

  return manifest;
};
