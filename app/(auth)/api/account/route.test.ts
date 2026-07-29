import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  deleteUserById: vi.fn(),
  drainPendingBlobDeletionsBestEffort: vi.fn(),
  getAllUserBlobUrls: vi.fn(),
  markUserForDeletion: vi.fn(),
}));

vi.mock("@/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/blob-delete", () => ({
  drainPendingBlobDeletionsBestEffort:
    mocks.drainPendingBlobDeletionsBestEffort,
  getAllUserBlobUrls: mocks.getAllUserBlobUrls,
}));
vi.mock("@/lib/db/queries", () => ({
  deleteUserById: mocks.deleteUserById,
  markUserForDeletion: mocks.markUserForDeletion,
}));

import { DELETE } from "./route";

describe("account erasure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("commits erasure before best-effort blob delivery", async () => {
    const userId = "00000000-0000-0000-0000-000000000001";
    mocks.auth.mockResolvedValue({ user: { id: userId } });
    mocks.markUserForDeletion.mockResolvedValue({ id: userId });
    mocks.getAllUserBlobUrls.mockResolvedValue([
      `https://blob.test/uploads/${userId}/avatar.png`,
    ]);
    mocks.deleteUserById.mockResolvedValue({ id: userId });
    mocks.drainPendingBlobDeletionsBestEffort.mockResolvedValue(0);

    const response = await DELETE();

    expect(response.status).toBe(204);
    expect(mocks.deleteUserById).toHaveBeenCalledBefore(
      mocks.drainPendingBlobDeletionsBestEffort
    );
  });
});
