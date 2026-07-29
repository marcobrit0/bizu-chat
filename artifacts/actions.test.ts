import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getSuggestionsByDocumentId: vi.fn(),
}));

vi.mock("@/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/queries", () => ({
  getSuggestionsByDocumentId: mocks.getSuggestionsByDocumentId,
}));

import { getSuggestions } from "./actions";

describe("artifact suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("queries suggestions only for the authenticated user", async () => {
    const documentId = "00000000-0000-0000-0000-000000000001";
    const userId = "00000000-0000-0000-0000-000000000002";
    mocks.auth.mockResolvedValueOnce(null);

    await expect(getSuggestions({ documentId })).resolves.toEqual([]);
    expect(mocks.getSuggestionsByDocumentId).not.toHaveBeenCalled();

    mocks.auth.mockResolvedValueOnce({ user: { id: userId } });
    mocks.getSuggestionsByDocumentId.mockResolvedValueOnce([{ documentId }]);

    await expect(getSuggestions({ documentId })).resolves.toEqual([
      { documentId },
    ]);
    expect(mocks.getSuggestionsByDocumentId).toHaveBeenCalledWith({
      documentId,
      userId,
    });
  });
});
