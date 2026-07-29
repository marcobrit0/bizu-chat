import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  del: vi.fn(),
  deletePendingBlobDeletion: vi.fn(),
  getPendingBlobDeletions: vi.fn(),
  list: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({
  del: mocks.del,
  list: mocks.list,
}));
vi.mock("@/lib/db/queries", () => ({
  deletePendingBlobDeletion: mocks.deletePendingBlobDeletion,
  getPendingBlobDeletions: mocks.getPendingBlobDeletions,
}));

import { drainPendingBlobDeletions, getOwnedUserBlobUrls } from "./blob-delete";

describe("blob deletion outbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mocks.deletePendingBlobDeletion.mockResolvedValue(undefined);

    await drainPendingBlobDeletions("user-1");

    expect(mocks.del).toHaveBeenCalledWith([
      "https://blob.test/uploads/user-1/a.png",
    ]);
    expect(mocks.deletePendingBlobDeletion).toHaveBeenCalledWith({
      id: "deletion-1",
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
    expect(mocks.deletePendingBlobDeletion).not.toHaveBeenCalled();
  });
});
