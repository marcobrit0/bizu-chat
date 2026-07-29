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

const drainBlobDeletions = async (
  pendingDeletions: Awaited<ReturnType<typeof getPendingBlobDeletions>>
) => {
  await Promise.all(
    pendingDeletions.map(async ({ id, urls }) => {
      const resolvedIdentifiers = await Promise.all(
        urls.map(async (identifier) => {
          if (identifier.startsWith("https://")) {
            return { resolved: true, urls: [identifier] };
          }

          const page = await list({ limit: 1000, prefix: identifier });
          const matchingUrls = page.blobs
            .filter((blob) => blob.pathname === identifier)
            .map((blob) => blob.url);

          return { resolved: matchingUrls.length > 0, urls: matchingUrls };
        })
      );
      const resolvedUrls = resolvedIdentifiers.flatMap(
        ({ urls: identifierUrls }) => identifierUrls
      );

      if (resolvedUrls.length > 0) {
        await del(resolvedUrls);
      }

      if (resolvedIdentifiers.every(({ resolved }) => resolved)) {
        await deletePendingBlobDeletion({ id });
      }
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
