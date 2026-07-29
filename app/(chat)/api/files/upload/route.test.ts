import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  drainPendingBlobDeletions: vi.fn(),
  getUserById: vi.fn(),
  put: vi.fn(),
  queueBlobDeletion: vi.fn(),
}));

vi.mock("@/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/blob-delete", () => ({
  drainPendingBlobDeletions: mocks.drainPendingBlobDeletions,
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
      .mockResolvedValueOnce({ deletingAt: null, id: userId })
      .mockResolvedValueOnce({ deletingAt: new Date(), id: userId });
    mocks.put.mockResolvedValue({ url: blobUrl });
    mocks.queueBlobDeletion.mockResolvedValue(undefined);
    mocks.drainPendingBlobDeletions.mockResolvedValue(1);
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
    expect(mocks.drainPendingBlobDeletions).toHaveBeenCalledWith(userId);
  });
});
