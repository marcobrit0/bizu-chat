import "server-only";

import { del, head, list } from "@vercel/blob";
import {
  getPendingBlobDeletions,
  processPendingBlobDeletion,
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

export const areOwnedUserBlobUrlsAvailable = async (
  userId: string,
  requestedUrls: string[]
) => {
  const ownedPathPrefix = `/uploads/${userId}/`;
  const ownedUrls = requestedUrls.filter(
    (url) =>
      URL.canParse(url) && new URL(url).pathname.startsWith(ownedPathPrefix)
  );

  try {
    await Promise.all(ownedUrls.map((url) => head(url)));

    return true;
  } catch {
    return false;
  }
};

const drainBlobDeletions = async (
  pendingDeletions: Awaited<ReturnType<typeof getPendingBlobDeletions>>
) => {
  await Promise.all(
    pendingDeletions.map(async ({ id, urls, userId }) => {
      const resolvedIdentifiers = await Promise.all(
        urls.map(async (identifier) => {
          if (identifier.startsWith("https://")) {
            return { identifier, url: identifier };
          }

          const page = await list({ limit: 1000, prefix: identifier });
          const matchingBlob = page.blobs.find(
            (blob) => blob.pathname === identifier
          );

          return { identifier, url: matchingBlob?.url ?? null };
        })
      );
      await processPendingBlobDeletion({
        deleteUrls: del,
        id,
        resolvedIdentifiers,
        userId,
      });
    })
  );

  return pendingDeletions.length;
};

export const drainPendingBlobDeletions = async (userId: string) => {
  const pendingDeletions = await getPendingBlobDeletions({ userId });

  return await drainBlobDeletions(pendingDeletions);
};

export const drainPendingBlobDeletionsBestEffort = async (userId: string) => {
  try {
    return await drainPendingBlobDeletions(userId);
  } catch {
    return 0;
  }
};

export const drainAllPendingBlobDeletions = async () => {
  const pendingDeletions = await getPendingBlobDeletions();

  return await drainBlobDeletions(pendingDeletions);
};
