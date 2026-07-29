import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  drainPendingBlobDeletionsBestEffort: vi.fn(),
  getUserById: vi.fn(),
  put: vi.fn(),
  queueBlobDeletion: vi.fn(),
}));

vi.mock("@/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/blob-delete", () => ({
  drainPendingBlobDeletionsBestEffort:
    mocks.drainPendingBlobDeletionsBestEffort,
}));
vi.mock("@/lib/db/queries", () => ({
  getUserById: mocks.getUserById,
  queueBlobDeletion: mocks.queueBlobDeletion,
}));
vi.mock("@vercel/blob", () => ({ put: mocks.put }));

import { POST } from "./route";

describe("file upload authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects a valid JWT after its database user is erased", async () => {
    mocks.auth.mockResolvedValue({
      user: { id: "00000000-0000-0000-0000-000000000001" },
    });
    mocks.getUserById.mockResolvedValue(undefined);

    const response = await POST(
      new Request("http://localhost/api/files/upload", { method: "POST" })
    );

    expect(response.status).toBe(401);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  test("queues an upload that finishes after account deletion starts", async () => {
    const userId = "00000000-0000-0000-0000-000000000001";
    const blobUrl = `https://blob.test/uploads/${userId}/late.png`;
    mocks.auth.mockResolvedValue({ user: { id: userId } });
    mocks.getUserById
      .mockResolvedValueOnce({
        chatDeletionGeneration: 0,
        chatsDeletingAt: null,
        deletingAt: null,
        id: userId,
      })
      .mockResolvedValueOnce({
        chatDeletionGeneration: 0,
        chatsDeletingAt: null,
        deletingAt: new Date(),
        id: userId,
      });
    mocks.put.mockResolvedValue({ url: blobUrl });
    mocks.queueBlobDeletion.mockResolvedValue(undefined);
    mocks.drainPendingBlobDeletionsBestEffort.mockResolvedValue(1);
    const formData = new FormData();
    formData.set(
      "file",
      new File(["image"], "late.png", { type: "image/png" })
    );

    const response = await POST(
      new Request("http://localhost/api/files/upload", {
        body: formData,
        method: "POST",
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.queueBlobDeletion).toHaveBeenCalledWith({
      urls: [blobUrl],
      userId,
    });
    expect(mocks.drainPendingBlobDeletionsBestEffort).toHaveBeenCalledWith(
      userId
    );
  });

  test("queues an upload that crosses a chat-history deletion", async () => {
    const userId = "00000000-0000-0000-0000-000000000001";
    const blobUrl = `https://blob.test/uploads/${userId}/late-history.png`;
    mocks.auth.mockResolvedValue({ user: { id: userId } });
    mocks.getUserById
      .mockResolvedValueOnce({
        chatDeletionGeneration: 4,
        chatsDeletingAt: null,
        deletingAt: null,
        id: userId,
      })
      .mockResolvedValueOnce({
        chatDeletionGeneration: 5,
        chatsDeletingAt: null,
        deletingAt: null,
        id: userId,
      });
    mocks.put.mockResolvedValue({ url: blobUrl });
    mocks.queueBlobDeletion.mockResolvedValue(undefined);
    mocks.drainPendingBlobDeletionsBestEffort.mockResolvedValue(1);
    const formData = new FormData();
    formData.set(
      "file",
      new File(["image"], "late-history.png", { type: "image/png" })
    );

    const response = await POST(
      new Request("http://localhost/api/files/upload", {
        body: formData,
        method: "POST",
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.queueBlobDeletion).toHaveBeenCalledWith({
      urls: [blobUrl],
      userId,
    });
  });
});
