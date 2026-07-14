import { describe, expect, it } from "vitest";

import { buildGuestEmail } from "./db/utils";

describe("buildGuestEmail", () => {
  it("is unique across rapid successive calls", () => {
    const emails = new Set(
      Array.from({ length: 1000 }, () => buildGuestEmail())
    );
    expect(emails.size).toBe(1000);
  });

  it("is prefixed so guests are recognizable in the database", () => {
    expect(buildGuestEmail().startsWith("guest-")).toBe(true);
  });

  it("fits the varchar(64) email column", () => {
    expect(buildGuestEmail().length).toBeLessThanOrEqual(64);
  });
});
