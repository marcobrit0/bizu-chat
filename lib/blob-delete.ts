import "server-only";

import { del, list } from "@vercel/blob";
import {
  deletePendingBlobDeletion,
  getPendingBlobDeletions,
} from "@/lib/db/queries";

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

export const getAllUserBlobUrls = listUserBlobUrls;

export const getOwnedUserBlobUrls = async (
  userId: string,
  requestedUrls: string[]
) => {
  const requested = new Set(requestedUrls);
  const ownedUrls = await listUserBlobUrls(userId);

  return ownedUrls.filter((url) => requested.has(url));
};

export const drainPendingBlobDeletions = async (userId: string) => {
  const pendingDeletions = await getPendingBlobDeletions({ userId });

  await Promise.all(
    pendingDeletions.map(async ({ id, urls }) => {
      if (urls.length > 0) {
        await del(urls);
      }

      await deletePendingBlobDeletion({ id });
    })
  );
};
