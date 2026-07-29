import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  deletePendingBlobDeletion: vi.fn(),
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
  deletePendingBlobDeletion: mocks.deletePendingBlobDeletion,
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

  test("removes the recovery intent after an authorised upload", async () => {
    const userId = "00000000-0000-0000-0000-000000000001";
    const activeUser = {
      chatDeletionGeneration: 0,
      chatsDeletingAt: null,
      deletingAt: null,
      id: userId,
    };
    mocks.auth.mockResolvedValue({ user: { id: userId } });
    mocks.getUserById.mockResolvedValue(activeUser);
    mocks.queueBlobDeletion.mockResolvedValue([{ id: "intent-1" }]);
    mocks.put.mockResolvedValue({
      url: `https://blob.test/uploads/${userId}/image.png`,
    });
    const formData = new FormData();
    formData.set(
      "file",
      new File(["image"], "image.png", { type: "image/png" })
    );

    const response = await POST(
      new Request("http://localhost/api/files/upload", {
        body: formData,
        method: "POST",
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.queueBlobDeletion).toHaveBeenCalledBefore(mocks.put);
    expect(mocks.deletePendingBlobDeletion).toHaveBeenCalledWith({
      id: "intent-1",
    });
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
    mocks.queueBlobDeletion.mockResolvedValue([{ id: "intent-1" }]);
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
    expect(mocks.queueBlobDeletion).toHaveBeenCalledOnce();
    expect(mocks.put).toHaveBeenCalledOnce();
    expect(mocks.deletePendingBlobDeletion).not.toHaveBeenCalled();
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
    mocks.queueBlobDeletion.mockResolvedValue([{ id: "intent-1" }]);
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
    expect(mocks.queueBlobDeletion).toHaveBeenCalledOnce();
    expect(mocks.deletePendingBlobDeletion).not.toHaveBeenCalled();
  });

  test("does not upload when the durable deletion intent cannot be written", async () => {
    const userId = "00000000-0000-0000-0000-000000000001";
    mocks.auth.mockResolvedValue({ user: { id: userId } });
    mocks.getUserById.mockResolvedValue({
      chatDeletionGeneration: 0,
      chatsDeletingAt: null,
      deletingAt: null,
      id: userId,
    });
    mocks.queueBlobDeletion.mockRejectedValue(
      new Error("database unavailable")
    );
    const formData = new FormData();
    formData.set(
      "file",
      new File(["image"], "blocked.png", { type: "image/png" })
    );

    const response = await POST(
      new Request("http://localhost/api/files/upload", {
        body: formData,
        method: "POST",
      })
    );

    expect(response.status).toBe(500);
    expect(mocks.put).not.toHaveBeenCalled();
  });
});
