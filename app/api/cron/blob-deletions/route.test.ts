import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  drainAllPendingBlobDeletions: vi.fn(),
}));

vi.mock("@/lib/blob-delete", () => ({
  drainAllPendingBlobDeletions: mocks.drainAllPendingBlobDeletions,
}));

import { GET } from "./route";

describe("blob deletion cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  test("drains the outbox only for Vercel's bearer secret", async () => {
    const unauthorized = await GET(
      new Request("http://localhost/api/cron/blob-deletions")
    );
    mocks.drainAllPendingBlobDeletions.mockResolvedValue(2);
    const authorized = await GET(
      new Request("http://localhost/api/cron/blob-deletions", {
        headers: { authorization: "Bearer test-cron-secret" },
      })
    );

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(200);
    await expect(authorized.json()).resolves.toEqual({ deletedCount: 2 });
    expect(mocks.drainAllPendingBlobDeletions).toHaveBeenCalledOnce();
  });
});
