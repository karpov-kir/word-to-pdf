export const convertBase64ToBlob = async (base64: string) => {
  try {
    const response = await fetch(base64);
    const blob = await response.blob();
    return blob;
  } catch (_error) {
    throw new Error('Failed to convert base64 to blob');
  }
};
