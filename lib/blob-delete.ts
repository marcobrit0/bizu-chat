import "server-only";

import { del, list } from "@vercel/blob";
import {
  claimPendingBlobDeletion,
  completePendingBlobDeletion,
  deferPendingChatErasure,
  deferPendingDataErasure,
  deleteAllChatsByUserId,
  deleteChatById,
  deleteUserById,
  getAttachmentUrlsByChatId,
  getPendingBlobDeletions,
  getPendingChatErasures,
  getPendingDataErasures,
} from "@/lib/db/queries";

const userBlobPrefix = (userId: string) => `uploads/${userId}/`;
export const getUserBlobDeletionPrefix = userBlobPrefix;
const BLOB_OPERATION_TIMEOUT_MS = 30_000;
const BLOB_ROW_CONCURRENCY = 5;
const BLOB_DELETE_BATCH_SIZE = 100;
const BLOB_IDENTIFIER_CONCURRENCY = 5;
const MAX_BLOB_IDENTIFIERS_PER_CLAIM = 100;
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
  userId: string,
  identifiers: string[],
  cursor?: string
): Promise<{
  continuationCursor: string | null;
  resolvedIdentifiers: {
    continuation: boolean;
    identifier: string;
    url: string | null;
  }[];
}> => {
  const batch = identifiers.slice(0, BLOB_IDENTIFIER_CONCURRENCY);

  if (batch.length > 0) {
    const resolvedBatch = await Promise.all(
      batch.map(async (identifier) => {
        if (identifier === userBlobPrefix(userId)) {
          const page = await list({
            abortSignal: AbortSignal.timeout(BLOB_OPERATION_TIMEOUT_MS),
            ...(cursor ? { cursor } : {}),
            limit: 1000,
            prefix: identifier,
          });

          if (page.hasMore && page.cursor) {
            return {
              continuationCursor: page.cursor,
              resolvedIdentifiers: [
                ...page.blobs.map((blob) => ({
                  continuation: false,
                  identifier,
                  url: blob.url,
                })),
                { continuation: true, identifier, url: null },
              ],
            };
          }

          if (page.hasMore) {
            throw new Error("Blob continuation cursor is missing");
          }

          return {
            continuationCursor: null,
            resolvedIdentifiers: page.blobs.map((blob) => ({
              continuation: false,
              identifier,
              url: blob.url,
            })),
          };
        }

        if (identifier.startsWith("https://")) {
          return {
            continuationCursor: null,
            resolvedIdentifiers: [
              { continuation: false, identifier, url: identifier },
            ],
          };
        }

        const page = await list({
          abortSignal: AbortSignal.timeout(BLOB_OPERATION_TIMEOUT_MS),
          limit: 1000,
          prefix: identifier,
        });
        const matchingBlob = page.blobs.find(
          (blob) => blob.pathname === identifier
        );

        return {
          continuationCursor: null,
          resolvedIdentifiers: [
            {
              continuation: false,
              identifier,
              url: matchingBlob?.url ?? null,
            },
          ],
        };
      })
    );
    const remainingResolution = await resolveBlobIdentifiers(
      userId,
      identifiers.slice(BLOB_IDENTIFIER_CONCURRENCY),
      cursor
    );

    return {
      continuationCursor:
        resolvedBatch.find(({ continuationCursor }) => continuationCursor)
          ?.continuationCursor ?? remainingResolution.continuationCursor,
      resolvedIdentifiers: [
        ...resolvedBatch.flatMap(
          ({ resolvedIdentifiers }) => resolvedIdentifiers
        ),
        ...remainingResolution.resolvedIdentifiers,
      ],
    };
  }

  return { continuationCursor: null, resolvedIdentifiers: [] };
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

const areBlobUrlsAvailable = async (
  userId: string,
  requestedUrls: string[]
): Promise<boolean> => {
  const batch = requestedUrls.slice(0, BLOB_IDENTIFIER_CONCURRENCY);

  if (batch.length > 0) {
    const available = await Promise.all(
      batch.map(async (url) => {
        const owned =
          URL.canParse(url) &&
          new URL(url).pathname.startsWith(`/${userBlobPrefix(userId)}`);

        if (owned) {
          const page = await list({
            abortSignal: AbortSignal.timeout(BLOB_OPERATION_TIMEOUT_MS),
            limit: 1000,
            prefix: new URL(url).pathname.slice(1),
          });

          return page.blobs.some((blob) => blob.url === url);
        }

        return false;
      })
    );

    return (
      available.every(Boolean) &&
      (await areBlobUrlsAvailable(
        userId,
        requestedUrls.slice(BLOB_IDENTIFIER_CONCURRENCY)
      ))
    );
  }

  return true;
};

export const areOwnedUserBlobUrlsAvailable = async (
  userId: string,
  requestedUrls: string[]
) => {
  try {
    return await areBlobUrlsAvailable(userId, requestedUrls);
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
        batch.map(async ({ cursor, id, urls, userId }) => {
          const identifiersToResolve = urls.slice(
            0,
            MAX_BLOB_IDENTIFIERS_PER_CLAIM
          );
          const remainingIdentifiers = urls
            .slice(MAX_BLOB_IDENTIFIERS_PER_CLAIM)
            .filter((identifier) =>
              isOwnedBlobIdentifier(userId, {
                identifier,
                url: identifier.startsWith("https://") ? identifier : null,
              })
            );
          const resolution = await resolveBlobIdentifiers(
            userId,
            identifiersToResolve,
            cursor ?? undefined
          );
          const resolvedIdentifiers = resolution.resolvedIdentifiers.filter(
            (identifier) => isOwnedBlobIdentifier(userId, identifier)
          );
          const claim = await claimPendingBlobDeletion({
            id,
            ...(remainingIdentifiers.length > 0
              ? { remainingIdentifiers }
              : {}),
            resolvedIdentifiers,
            userId,
          });

          if (claim?.claimToken) {
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
              claimToken: claim.claimToken,
              ...(resolution.continuationCursor
                ? { continuationCursor: resolution.continuationCursor }
                : {}),
              continuationIdentifiers: claim.continuationIdentifiers,
              id,
              ...(remainingIdentifiers.length > 0
                ? { remainingIdentifiers }
                : {}),
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

const resumeDataErasures = async (
  pendingErasures: Awaited<ReturnType<typeof getPendingDataErasures>>
): Promise<number> => {
  const batch = pendingErasures.slice(0, BLOB_ROW_CONCURRENCY);

  if (batch.length > 0) {
    const resumed = await Promise.all(
      batch.map(
        async ({ chatDeletionGeneration, chatsDeletingAt, deletingAt, id }) => {
          try {
            const blobUrls = [userBlobPrefix(id)];

            if (deletingAt) {
              await deleteUserById({ blobUrls, id });
              return 1;
            }

            if (chatsDeletingAt) {
              await deleteAllChatsByUserId({
                blobUrls,
                chatDeletionGeneration,
                userId: id,
              });
              return 1;
            }
          } catch {
            try {
              await deferPendingDataErasure({
                accountDeletion: Boolean(deletingAt),
                id,
              });
            } catch {
              return 0;
            }

            return 0;
          }

          return 0;
        }
      )
    );

    return (
      resumed.reduce<number>((total, count) => total + count, 0) +
      (await resumeDataErasures(pendingErasures.slice(BLOB_ROW_CONCURRENCY)))
    );
  }

  return 0;
};

export const resumePendingDataErasures = async () =>
  await resumeDataErasures(await getPendingDataErasures());

const resumeChatErasures = async (
  pendingErasures: Awaited<ReturnType<typeof getPendingChatErasures>>
): Promise<number> => {
  const batch = pendingErasures.slice(0, BLOB_ROW_CONCURRENCY);

  if (batch.length > 0) {
    const resumed = await Promise.all(
      batch.map(async ({ id, userId }) => {
        try {
          const blobUrls = await getAttachmentUrlsByChatId({ chatId: id });
          await deleteChatById({ blobUrls, id, userId });

          return 1;
        } catch {
          try {
            await deferPendingChatErasure({ id, userId });
          } catch {
            return 0;
          }

          return 0;
        }
      })
    );

    return (
      resumed.reduce<number>((total, count) => total + count, 0) +
      (await resumeChatErasures(pendingErasures.slice(BLOB_ROW_CONCURRENCY)))
    );
  }

  return 0;
};

export const resumePendingChatErasures = async () =>
  await resumeChatErasures(await getPendingChatErasures());
