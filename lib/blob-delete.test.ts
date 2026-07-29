import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claimPendingBlobDeletion: vi.fn(),
  completePendingBlobDeletion: vi.fn(),
  del: vi.fn(),
  getPendingBlobDeletions: vi.fn(),
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
  getPendingBlobDeletions: mocks.getPendingBlobDeletions,
}));

import {
  areOwnedUserBlobUrlsAvailable,
  drainAllPendingBlobDeletions,
  drainPendingBlobDeletions,
  drainPendingBlobDeletionsBestEffort,
  getOwnedUserBlobUrls,
} from "./blob-delete";

describe("blob deletion outbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.claimPendingBlobDeletion.mockImplementation(
      async ({
        resolvedIdentifiers,
      }: {
        resolvedIdentifiers: { identifier: string; url: string | null }[];
      }) => ({
        deletableUrls: resolvedIdentifiers.flatMap(({ url }) =>
          url ? [url] : []
        ),
        unresolvedIdentifiers: resolvedIdentifiers.flatMap(
          ({ identifier, url }) => (url ? [] : [identifier])
        ),
      })
    );
  });

  test("only queues requested URLs owned by the user prefix", async () => {
    mocks.list.mockResolvedValue({
      blobs: [
        { url: "https://blob.test/uploads/user-1/a.png" },
        { url: "https://blob.test/uploads/user-1/b.png" },
      ],
      cursor: null,
      hasMore: false,
    });

    await expect(
      getOwnedUserBlobUrls("user-1", [
        "https://blob.test/uploads/user-1/a.png",
        "https://blob.test/uploads/user-2/private.png",
      ])
    ).resolves.toEqual(["https://blob.test/uploads/user-1/a.png"]);
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
          identifier: "https://blob.test/uploads/user-1/a.png",
          url: "https://blob.test/uploads/user-1/a.png",
        },
      ],
      userId: "user-1",
    });
    expect(mocks.completePendingBlobDeletion).toHaveBeenCalledWith({
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
      resolvedIdentifiers: [{ identifier: pathname, url: blobUrl }],
      userId: "user-1",
    });
    expect(mocks.completePendingBlobDeletion).toHaveBeenCalledWith({
      id: "deletion-1",
      unresolvedIdentifiers: [],
      userId: "user-1",
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
      resolvedIdentifiers: [{ identifier: pathname, url: null }],
      userId: "user-1",
    });
    expect(mocks.completePendingBlobDeletion).toHaveBeenLastCalledWith({
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
        { identifier: pathname, url: `https://blob.test/${pathname}` },
      ],
      userId: "user-1",
    });
    expect(mocks.completePendingBlobDeletion).toHaveBeenLastCalledWith({
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
    mocks.getPendingBlobDeletions.mockResolvedValue([deletion]);
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

  test("accepts only Blob URLs owned by the message author", async () => {
    const userId = "user-1";
    const ownedUrl = `https://blob.test/uploads/${userId}/image.png`;
    mocks.list.mockResolvedValue({
      blobs: [{ url: ownedUrl }],
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
});
