export const sessionStorageFetcher = async (url: string, headers: any) => {
  const cacheKey = `swr-cache-${url}`;
  const cacheData = sessionStorage.getItem(cacheKey);

  if (cacheData) {
    // If data is in local storage, return it.
    return JSON.parse(cacheData);
  }

  // If not, fetch the data with custom headers and save it in local storage.
  const response = await fetch(url, { headers });
  const data = await response.json();
  sessionStorage.setItem(cacheKey, JSON.stringify(data));
  return data;
};
