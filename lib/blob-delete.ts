import "server-only";

import { del, list } from "@vercel/blob";

const userBlobPrefix = (userId: string) => `uploads/${userId}/`;

const listUserBlobUrls = async (
  userId: string,
  cursor?: string
): Promise<string[]> => {
  const page = await list({
    cursor,
    limit: 1000,
    prefix: userBlobPrefix(userId),
  });
  const urls = page.blobs.map((blob) => blob.url);

  if (page.hasMore && page.cursor) {
    return [...urls, ...(await listUserBlobUrls(userId, page.cursor))];
  }

  return urls;
};

export const deleteAllUserBlobs = async (userId: string) => {
  const urls = await listUserBlobUrls(userId);

  if (urls.length > 0) {
    await del(urls);
  }
};

export const deleteUserBlobUrls = async (
  userId: string,
  requestedUrls: string[]
) => {
  const requested = new Set(requestedUrls);
  const ownedUrls = await listUserBlobUrls(userId);
  const urls = ownedUrls.filter((url) => requested.has(url));

  if (urls.length > 0) {
    await del(urls);
  }
};
