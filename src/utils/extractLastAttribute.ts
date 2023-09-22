export const extractLastAttribute = (path: string) => {
  const pathItems = path
    ?.split('[')
    .map((item) => item.replace(/[\]$'"]/g, ''));
  return pathItems?.length ? pathItems[pathItems.length - 1] : path;
};
