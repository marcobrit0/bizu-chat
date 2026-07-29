import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getUserById: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/queries", () => ({ getUserById: mocks.getUserById }));
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
});
