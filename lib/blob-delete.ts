import "server-only";

import { del, list } from "@vercel/blob";
import {
  claimPendingBlobDeletion,
  completePendingBlobDeletion,
  getPendingBlobDeletions,
} from "@/lib/db/queries";

const userBlobPrefix = (userId: string) => `uploads/${userId}/`;
const BLOB_OPERATION_TIMEOUT_MS = 30_000;
const BLOB_ROW_CONCURRENCY = 5;
const BLOB_DELETE_BATCH_SIZE = 100;
const BLOB_IDENTIFIER_CONCURRENCY = 5;
const MAX_BLOB_DELETIONS_PER_DRAIN = 1000;

const processInBatches = async <T>(
  items: T[],
  batchSize: number,
  processBatch: (batch: T[]) => Promise<void>
): Promise<void> => {
  const batch = items.slice(0, batchSize);

  if (batch.length > 0) {
    await processBatch(batch);
    await processInBatches(items.slice(batchSize), batchSize, processBatch);
  }
};

const resolveBlobIdentifiers = async (
  identifiers: string[]
): Promise<{ identifier: string; url: string | null }[]> => {
  const batch = identifiers.slice(0, BLOB_IDENTIFIER_CONCURRENCY);

  if (batch.length > 0) {
    const resolvedBatch = await Promise.all(
      batch.map(async (identifier) => {
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

    return [
      ...resolvedBatch,
      ...(await resolveBlobIdentifiers(
        identifiers.slice(BLOB_IDENTIFIER_CONCURRENCY)
      )),
    ];
  }

  return [];
};

const isOwnedBlobIdentifier = (
  userId: string,
  { identifier, url }: { identifier: string; url: string | null }
) => {
  const prefix = userBlobPrefix(userId);

  if (url) {
    return URL.canParse(url) && new URL(url).pathname.startsWith(`/${prefix}`);
  }

  return identifier.startsWith(prefix);
};

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
  await processInBatches(
    pendingDeletions,
    BLOB_ROW_CONCURRENCY,
    async (batch) => {
      await Promise.all(
        batch.map(async ({ id, urls, userId }) => {
          const resolvedIdentifiers = (
            await resolveBlobIdentifiers(urls)
          ).filter((identifier) => isOwnedBlobIdentifier(userId, identifier));
          const claim = await claimPendingBlobDeletion({
            id,
            resolvedIdentifiers,
            userId,
          });

          if (claim) {
            await processInBatches(
              claim.deletableUrls,
              BLOB_DELETE_BATCH_SIZE,
              async (urlsToDelete) => {
                await del(urlsToDelete, {
                  abortSignal: AbortSignal.timeout(BLOB_OPERATION_TIMEOUT_MS),
                });
              }
            );

            await completePendingBlobDeletion({
              id,
              unresolvedIdentifiers: claim.unresolvedIdentifiers,
              userId,
            });
          }
        })
      );
    }
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
  const remainingCapacity = MAX_BLOB_DELETIONS_PER_DRAIN - deletedCount;

  if (remainingCapacity > 0) {
    const pendingDeletions = (await getPendingBlobDeletions()).slice(
      0,
      remainingCapacity
    );

    if (pendingDeletions.length > 0) {
      await drainBlobDeletions(pendingDeletions);

      return await drainAllReadyBlobDeletions(
        deletedCount + pendingDeletions.length
      );
    }
  }

  return deletedCount;
};

export const drainAllPendingBlobDeletions = async () =>
  await drainAllReadyBlobDeletions(0);
