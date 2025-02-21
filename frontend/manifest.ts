import * as packageJson from './package.json';

const { version } = packageJson;

// Convert from Semver (example: 0.1.0-beta6)
const [major, minor, patch, label = '0'] = version
  // can only contain digits, dots, or dash
  .replace(/[^\d.-]+/g, '')
  // split into version parts
  .split(/[.-]/);

const publicKey = [
  `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjlGjUHUq2Lj/UcBWaCP9`,
  `cZhEmKFLBgL8s38hpD3mWXWT9pj4WfZh5q+f39QrXn+fdVbQ7eVkFRjtleNBrtyM`,
  `cqcdL+EKjRDDWiZxZi0hjqHJ4voZlOP00jjEirOquFnoOAWzZQ2Ly5ox6QYWOu6M`,
  `V/szz96eP9mUTyaUx3j51TE/vedqKWVDpqO6SH8HSxua3x4gCN0ZRZfnXgC99+im`,
  `I7Bomj1u0HXZ2+PjuTKHzMqYc+sGEN+w5GLruEKakfOqg/jQAr+IE5Rzpq3xCMQj`,
  `SnDyccReYDn4AqcudnyXFMcD/06pw6FMUPhCWXntzZ1oye7g5MtGkSv5Vcv+VfDr`,
  `zwIDAQAB`,
];

const iconMap = {
  16: 'icons/16x16.png',
  32: 'icons/32x32.png',
  48: 'icons/48x48.png',
  64: 'icons/64x64.png',
  128: 'icons/128x128-96x96.png',
};

export const createManifestContent = ({
  popupPath,
  // contentScriptWrapperPath,
  serviceWorkerPath,
}: {
  popupPath: string;
  contentScriptWrapperPath: string;
  serviceWorkerPath: string;
}) => {
  const manifest: chrome.runtime.ManifestV3 = {
    manifest_version: 3,
    name: '__MSG_appName__',
    description: '__MSG_shortDesc__',
    default_locale: 'en',
    key: publicKey.join(''),
    // Up to four numbers separated by dots
    version: `${major}.${minor}.${patch}.${label}`,
    // Semver is OK in the `version_name`
    version_name: version,
    permissions: ['offscreen', 'storage', 'downloads'],
    action: { default_popup: popupPath, default_icon: iconMap },
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
    icons: iconMap,
  };

  return manifest;
};
