/**
 * For Cloudinary URLs we don't need local filesystem access.
 */

export const getFilePath = (filePath) => {
  return filePath;
};

export const assertFileExists = async (filePath) => {
  if (!filePath.startsWith("http://") && !filePath.startsWith("https://")) {
    throw new Error(`Invalid image URL: ${filePath}`);
  }

  return filePath;
};
