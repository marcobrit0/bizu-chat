import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claimPendingBlobDeletion: vi.fn(),
  completePendingBlobDeletion: vi.fn(),
  deferPendingChatErasure: vi.fn(),
  deferPendingDataErasure: vi.fn(),
  del: vi.fn(),
  deleteAllChatsByUserId: vi.fn(),
  deleteChatById: vi.fn(),
  deleteUserById: vi.fn(),
  getAttachmentUrlsByChatId: vi.fn(),
  getPendingBlobDeletions: vi.fn(),
  getPendingChatErasures: vi.fn(),
  getPendingDataErasures: vi.fn(),
  list: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({
  del: mocks.del,
  list: mocks.list,
}));
vi.mock("@/lib/db/queries", () => ({
  claimPendingBlobDeletion: mocks.claimPendingBlobDeletion,
  completePendingBlobDeletion: mocks.completePendingBlobDeletion,
  deferPendingChatErasure: mocks.deferPendingChatErasure,
  deferPendingDataErasure: mocks.deferPendingDataErasure,
  deleteAllChatsByUserId: mocks.deleteAllChatsByUserId,
  deleteChatById: mocks.deleteChatById,
  deleteUserById: mocks.deleteUserById,
  getAttachmentUrlsByChatId: mocks.getAttachmentUrlsByChatId,
  getPendingBlobDeletions: mocks.getPendingBlobDeletions,
  getPendingChatErasures: mocks.getPendingChatErasures,
  getPendingDataErasures: mocks.getPendingDataErasures,
}));

import {
  areOwnedUserBlobUrlsAvailable,
  drainAllPendingBlobDeletions,
  drainPendingBlobDeletions,
  drainPendingBlobDeletionsBestEffort,
  resumePendingChatErasures,
  resumePendingDataErasures,
} from "./blob-delete";

describe("blob deletion outbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.claimPendingBlobDeletion.mockImplementation(
      async ({
        resolvedIdentifiers,
      }: {
        resolvedIdentifiers: {
          continuation: boolean;
          identifier: string;
          url: string | null;
        }[];
      }) => ({
        claimToken: "00000000-0000-0000-0000-000000000001",
        continuationIdentifiers: resolvedIdentifiers.flatMap(
          ({ continuation, identifier }) => (continuation ? [identifier] : [])
        ),
        deletableUrls: resolvedIdentifiers.flatMap(({ url }) =>
          url ? [url] : []
        ),
        unresolvedIdentifiers: resolvedIdentifiers.flatMap(
          ({ continuation, identifier, url }) =>
            url || continuation ? [] : [identifier]
        ),
      })
    );
  });

  test("removes an outbox row only after its blobs are deleted", async () => {
    mocks.getPendingBlobDeletions.mockResolvedValue([
      {
        createdAt: new Date(),
        id: "deletion-1",
        urls: ["https://blob.test/uploads/user-1/a.png"],
        userId: "user-1",
      },
    ]);
    mocks.del.mockResolvedValue(undefined);

    await drainPendingBlobDeletions("user-1");

    expect(mocks.del).toHaveBeenCalledWith(
      ["https://blob.test/uploads/user-1/a.png"],
      { abortSignal: expect.any(AbortSignal) }
    );
    expect(mocks.claimPendingBlobDeletion).toHaveBeenCalledWith({
      id: "deletion-1",
      resolvedIdentifiers: [
        {
          continuation: false,
          identifier: "https://blob.test/uploads/user-1/a.png",
          url: "https://blob.test/uploads/user-1/a.png",
        },
      ],
      userId: "user-1",
    });
    expect(mocks.completePendingBlobDeletion).toHaveBeenCalledWith({
      claimToken: "00000000-0000-0000-0000-000000000001",
      continuationIdentifiers: [],
      id: "deletion-1",
      unresolvedIdentifiers: [],
      userId: "user-1",
    });
  });

  test("resolves a crash-recovery pathname to its canonical Blob URL", async () => {
    const pathname = "uploads/user-1/recovery.png";
    const blobUrl = `https://blob.test/${pathname}`;
    mocks.getPendingBlobDeletions.mockResolvedValue([
      {
        createdAt: new Date(),
        id: "deletion-1",
        readyAt: new Date(),
        urls: [pathname],
        userId: "user-1",
      },
    ]);
    mocks.list.mockResolvedValue({
      blobs: [
        { pathname, url: blobUrl },
        { pathname: `${pathname}.other`, url: `${blobUrl}.other` },
      ],
      cursor: null,
      hasMore: false,
    });
    mocks.del.mockResolvedValue(undefined);

    await drainPendingBlobDeletions("user-1");

    expect(mocks.list).toHaveBeenCalledWith({
      abortSignal: expect.any(AbortSignal),
      limit: 1000,
      prefix: pathname,
    });
    expect(mocks.del).toHaveBeenCalledWith([blobUrl], {
      abortSignal: expect.any(AbortSignal),
    });
    expect(mocks.claimPendingBlobDeletion).toHaveBeenCalledWith({
      id: "deletion-1",
      resolvedIdentifiers: [
        { continuation: false, identifier: pathname, url: blobUrl },
      ],
      userId: "user-1",
    });
    expect(mocks.completePendingBlobDeletion).toHaveBeenCalledWith({
      claimToken: "00000000-0000-0000-0000-000000000001",
      continuationIdentifiers: [],
      id: "deletion-1",
      unresolvedIdentifiers: [],
      userId: "user-1",
    });
  });

  test("persists a user-prefix continuation after one bounded Blob page", async () => {
    const userId = "user-1";
    const prefix = `uploads/${userId}/`;
    const firstUrl = `https://blob.test/${prefix}first.png`;
    const secondUrl = `https://blob.test/${prefix}second.png`;
    mocks.getPendingBlobDeletions.mockResolvedValue([
      {
        createdAt: new Date(),
        id: "deletion-1",
        urls: [prefix],
        userId,
      },
    ]);
    mocks.list.mockResolvedValue({
      blobs: [{ url: firstUrl }, { url: secondUrl }],
      cursor: "next-page",
      hasMore: true,
    });

    await drainPendingBlobDeletions(userId);

    expect(mocks.del).toHaveBeenCalledWith([firstUrl, secondUrl], {
      abortSignal: expect.any(AbortSignal),
    });
    expect(mocks.completePendingBlobDeletion).toHaveBeenCalledWith({
      claimToken: "00000000-0000-0000-0000-000000000001",
      continuationCursor: "next-page",
      continuationIdentifiers: [prefix],
      id: "deletion-1",
      unresolvedIdentifiers: [],
      userId,
    });
  });

  test("uses the persisted cursor for the next user-prefix page", async () => {
    const userId = "user-1";
    const prefix = `uploads/${userId}/`;
    const blobUrl = `https://blob.test/${prefix}later.png`;
    mocks.getPendingBlobDeletions.mockResolvedValue([
      {
        createdAt: new Date(),
        cursor: "next-page",
        id: "deletion-1",
        urls: [prefix],
        userId,
      },
    ]);
    mocks.list.mockResolvedValue({
      blobs: [{ url: blobUrl }],
      hasMore: false,
    });

    await drainPendingBlobDeletions(userId);

    expect(mocks.list).toHaveBeenCalledWith({
      abortSignal: expect.any(AbortSignal),
      cursor: "next-page",
      limit: 1000,
      prefix,
    });
    expect(mocks.del).toHaveBeenCalledWith([blobUrl], {
      abortSignal: expect.any(AbortSignal),
    });
  });

  test("persists exact identifiers beyond one bounded claim", async () => {
    const userId = "user-1";
    const urls = Array.from(
      { length: 101 },
      (_, index) => `https://blob.test/uploads/${userId}/${index}.png`
    );
    mocks.getPendingBlobDeletions.mockResolvedValue([
      {
        createdAt: new Date(),
        id: "deletion-1",
        urls,
        userId,
      },
    ]);

    await drainPendingBlobDeletions(userId);

    expect(mocks.claimPendingBlobDeletion).toHaveBeenCalledWith({
      id: "deletion-1",
      remainingIdentifiers: [urls[100]],
      resolvedIdentifiers: urls.slice(0, 100).map((url) => ({
        continuation: false,
        identifier: url,
        url,
      })),
      userId,
    });
    expect(mocks.completePendingBlobDeletion).toHaveBeenCalledWith({
      claimToken: "00000000-0000-0000-0000-000000000001",
      continuationIdentifiers: [],
      id: "deletion-1",
      remainingIdentifiers: [urls[100]],
      unresolvedIdentifiers: [],
      userId,
    });
  });

  test("retries an unresolved crash-recovery pathname", async () => {
    const pathname = "uploads/user-1/recovery.png";
    const deletion = {
      createdAt: new Date(),
      id: "deletion-1",
      readyAt: new Date(),
      urls: [pathname],
      userId: "user-1",
    };
    mocks.getPendingBlobDeletions.mockResolvedValue([deletion]);
    mocks.list
      .mockResolvedValueOnce({
        blobs: [],
        cursor: null,
        hasMore: false,
      })
      .mockResolvedValueOnce({
        blobs: [{ pathname, url: `https://blob.test/${pathname}` }],
        cursor: null,
        hasMore: false,
      });

    await expect(drainPendingBlobDeletions("user-1")).resolves.toBe(1);

    expect(mocks.del).not.toHaveBeenCalled();
    expect(mocks.claimPendingBlobDeletion).toHaveBeenLastCalledWith({
      id: "deletion-1",
      resolvedIdentifiers: [
        { continuation: false, identifier: pathname, url: null },
      ],
      userId: "user-1",
    });
    expect(mocks.completePendingBlobDeletion).toHaveBeenLastCalledWith({
      claimToken: "00000000-0000-0000-0000-000000000001",
      continuationIdentifiers: [],
      id: "deletion-1",
      unresolvedIdentifiers: [pathname],
      userId: "user-1",
    });

    await expect(drainPendingBlobDeletions("user-1")).resolves.toBe(1);

    expect(mocks.del).toHaveBeenCalledWith([`https://blob.test/${pathname}`], {
      abortSignal: expect.any(AbortSignal),
    });
    expect(mocks.claimPendingBlobDeletion).toHaveBeenLastCalledWith({
      id: "deletion-1",
      resolvedIdentifiers: [
        {
          continuation: false,
          identifier: pathname,
          url: `https://blob.test/${pathname}`,
        },
      ],
      userId: "user-1",
    });
    expect(mocks.completePendingBlobDeletion).toHaveBeenLastCalledWith({
      claimToken: "00000000-0000-0000-0000-000000000001",
      continuationIdentifiers: [],
      id: "deletion-1",
      unresolvedIdentifiers: [],
      userId: "user-1",
    });
  });

  test("keeps the outbox row when blob deletion fails", async () => {
    mocks.getPendingBlobDeletions.mockResolvedValue([
      {
        createdAt: new Date(),
        id: "deletion-1",
        urls: ["https://blob.test/uploads/user-1/a.png"],
        userId: "user-1",
      },
    ]);
    mocks.del.mockRejectedValue(new Error("blob unavailable"));

    await expect(drainPendingBlobDeletions("user-1")).rejects.toThrow(
      "blob unavailable"
    );
    expect(mocks.claimPendingBlobDeletion).toHaveBeenCalledOnce();
    expect(mocks.completePendingBlobDeletion).not.toHaveBeenCalled();
  });

  test("does not fail committed erasure when immediate blob deletion fails", async () => {
    mocks.getPendingBlobDeletions.mockResolvedValue([
      {
        createdAt: new Date(),
        id: "deletion-1",
        urls: ["https://blob.test/uploads/user-1/a.png"],
        userId: "user-1",
      },
    ]);
    mocks.del.mockRejectedValue(new Error("blob unavailable"));

    await expect(drainPendingBlobDeletionsBestEffort("user-1")).resolves.toBe(
      0
    );
    expect(mocks.claimPendingBlobDeletion).toHaveBeenCalledOnce();
    expect(mocks.completePendingBlobDeletion).not.toHaveBeenCalled();
  });

  test("an independent worker retries a failed account deletion", async () => {
    const deletion = {
      createdAt: new Date(),
      id: "deletion-1",
      urls: ["https://blob.test/uploads/user-1/a.png"],
      userId: "user-1",
    };
    mocks.getPendingBlobDeletions
      .mockResolvedValueOnce([deletion])
      .mockResolvedValueOnce([deletion])
      .mockResolvedValueOnce([]);
    mocks.del
      .mockRejectedValueOnce(new Error("blob unavailable"))
      .mockResolvedValueOnce(undefined);

    await expect(drainPendingBlobDeletions("user-1")).rejects.toThrow(
      "blob unavailable"
    );
    await expect(drainAllPendingBlobDeletions()).resolves.toBe(1);

    expect(mocks.getPendingBlobDeletions).toHaveBeenNthCalledWith(1, {
      userId: "user-1",
    });
    expect(mocks.getPendingBlobDeletions).toHaveBeenNthCalledWith(2);
    expect(mocks.claimPendingBlobDeletion).toHaveBeenCalledTimes(2);
    expect(mocks.completePendingBlobDeletion).toHaveBeenCalledOnce();
  });

  test("an independent worker drains every ready outbox page", async () => {
    let activeDeletes = 0;
    let maximumActiveDeletes = 0;
    const deletion = (index: number) => ({
      createdAt: new Date(),
      id: `deletion-${index}`,
      urls: [`https://blob.test/uploads/user-${index}/image.png`],
      userId: `user-${index}`,
    });
    mocks.del.mockImplementation(async () => {
      activeDeletes += 1;
      maximumActiveDeletes = Math.max(maximumActiveDeletes, activeDeletes);
      await Promise.resolve();
      activeDeletes -= 1;
    });
    mocks.getPendingBlobDeletions
      .mockResolvedValueOnce(
        Array.from({ length: 100 }, (_, index) => deletion(index))
      )
      .mockResolvedValueOnce([deletion(100)])
      .mockResolvedValueOnce([]);

    await expect(drainAllPendingBlobDeletions()).resolves.toBe(101);

    expect(mocks.getPendingBlobDeletions).toHaveBeenCalledTimes(3);
    expect(mocks.completePendingBlobDeletion).toHaveBeenCalledTimes(101);
    expect(maximumActiveDeletes).toBe(5);
  });

  test("an independent worker caps each invocation", async () => {
    const readyBatch = Array.from({ length: 100 }, (_, index) => ({
      createdAt: new Date(),
      id: `deletion-${index}`,
      urls: [`https://blob.test/uploads/user-${index}/image.png`],
      userId: `user-${index}`,
    }));
    mocks.getPendingBlobDeletions.mockResolvedValue(readyBatch);
    mocks.claimPendingBlobDeletion.mockResolvedValue(null);

    await expect(drainAllPendingBlobDeletions()).resolves.toBe(1000);

    expect(mocks.getPendingBlobDeletions).toHaveBeenCalledTimes(10);
  });

  test("rejects a forged cross-tenant deletion row", async () => {
    const victimUrl = "https://blob.test/uploads/user-2/private.png";
    mocks.getPendingBlobDeletions.mockResolvedValue([
      {
        createdAt: new Date(),
        id: "deletion-1",
        urls: [victimUrl],
        userId: "user-1",
      },
    ]);

    await drainPendingBlobDeletions("user-1");

    expect(mocks.claimPendingBlobDeletion).toHaveBeenCalledWith({
      id: "deletion-1",
      resolvedIdentifiers: [],
      userId: "user-1",
    });
    expect(mocks.del).not.toHaveBeenCalled();
  });

  test("accepts only Blob URLs owned by the message author", async () => {
    const userId = "user-1";
    const ownedUrl = `https://blob.test/uploads/${userId}/image.png`;
    mocks.list.mockResolvedValue({
      blobs: [{ pathname: `uploads/${userId}/image.png`, url: ownedUrl }],
      cursor: null,
      hasMore: false,
    });

    await expect(
      areOwnedUserBlobUrlsAvailable(userId, [ownedUrl])
    ).resolves.toBe(true);

    await expect(
      areOwnedUserBlobUrlsAvailable(userId, [
        "https://blob.test/uploads/user-2/private.png",
      ])
    ).resolves.toBe(false);
  });

  test("an independent worker resumes durable account and history erasure markers", async () => {
    const accountId = "00000000-0000-0000-0000-000000000010";
    const historyId = "00000000-0000-0000-0000-000000000020";
    mocks.getPendingDataErasures.mockResolvedValue([
      {
        chatDeletionGeneration: 1,
        chatsDeletingAt: null,
        deletingAt: new Date(),
        id: accountId,
      },
      {
        chatDeletionGeneration: 2,
        chatsDeletingAt: new Date(),
        deletingAt: null,
        id: historyId,
      },
    ]);
    await expect(resumePendingDataErasures()).resolves.toBe(2);

    expect(mocks.deleteUserById).toHaveBeenCalledWith({
      blobUrls: [`uploads/${accountId}/`],
      id: accountId,
    });
    expect(mocks.deleteAllChatsByUserId).toHaveBeenCalledWith({
      blobUrls: [`uploads/${historyId}/`],
      chatDeletionGeneration: 2,
      userId: historyId,
    });
  });

  test("a failed erasure is deferred without blocking the worker", async () => {
    const userId = "00000000-0000-0000-0000-000000000030";
    mocks.getPendingDataErasures.mockResolvedValue([
      {
        chatDeletionGeneration: 1,
        chatsDeletingAt: null,
        deletingAt: new Date(),
        id: userId,
      },
    ]);
    mocks.deleteUserById.mockRejectedValue(new Error("database unavailable"));

    await expect(resumePendingDataErasures()).resolves.toBe(0);

    expect(mocks.deferPendingDataErasure).toHaveBeenCalledWith({
      accountDeletion: true,
      id: userId,
    });
    expect(mocks.deleteUserById).toHaveBeenCalledOnce();
  });

  test("an independent worker resumes individually marked chat erasure", async () => {
    const userId = "00000000-0000-0000-0000-000000000040";
    const chatId = "00000000-0000-0000-0000-000000000041";
    const blobUrl = `https://blob.test/uploads/${userId}/chat.png`;
    mocks.getPendingChatErasures.mockResolvedValue([
      { deletingAt: new Date(), id: chatId, userId },
    ]);
    mocks.getAttachmentUrlsByChatId.mockResolvedValue([blobUrl]);

    await expect(resumePendingChatErasures()).resolves.toBe(1);

    expect(mocks.deleteChatById).toHaveBeenCalledWith({
      blobUrls: [blobUrl],
      id: chatId,
      userId,
    });
  });
});
