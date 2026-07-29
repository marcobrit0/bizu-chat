import "server-only";

import { del, list } from "@vercel/blob";
import {
  claimPendingBlobDeletion,
  completePendingBlobDeletion,
  getPendingBlobDeletions,
} from "@/lib/db/queries";

const userBlobPrefix = (userId: string) => `uploads/${userId}/`;
const BLOB_OPERATION_TIMEOUT_MS = 30_000;

const listUserBlobUrls = async (
  userId: string,
  cursor?: string
): Promise<string[]> => {
  const page = await list({
    abortSignal: AbortSignal.timeout(BLOB_OPERATION_TIMEOUT_MS),
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
  try {
    const ownedUrls = new Set(await listUserBlobUrls(userId));

    return requestedUrls.every((url) => ownedUrls.has(url));
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

          const page = await list({
            abortSignal: AbortSignal.timeout(BLOB_OPERATION_TIMEOUT_MS),
            limit: 1000,
            prefix: identifier,
          });
          const matchingBlob = page.blobs.find(
            (blob) => blob.pathname === identifier
          );

          return { identifier, url: matchingBlob?.url ?? null };
        })
      );
      const claim = await claimPendingBlobDeletion({
        id,
        resolvedIdentifiers,
        userId,
      });

      if (claim) {
        if (claim.deletableUrls.length > 0) {
          await del(claim.deletableUrls, {
            abortSignal: AbortSignal.timeout(BLOB_OPERATION_TIMEOUT_MS),
          });
        }

        await completePendingBlobDeletion({
          id,
          unresolvedIdentifiers: claim.unresolvedIdentifiers,
          userId,
        });
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

const drainAllReadyBlobDeletions = async (
  deletedCount: number
): Promise<number> => {
  const pendingDeletions = await getPendingBlobDeletions();

  if (pendingDeletions.length > 0) {
    await drainBlobDeletions(pendingDeletions);

    return await drainAllReadyBlobDeletions(
      deletedCount + pendingDeletions.length
    );
  }

  return deletedCount;
};

export const drainAllPendingBlobDeletions = async () =>
  await drainAllReadyBlobDeletions(0);
