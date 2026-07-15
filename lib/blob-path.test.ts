import { describe, expect, it } from "vitest";

import { buildBlobKey } from "./blob-path";

describe("buildBlobKey", () => {
  it("namespaces the key by user id", () => {
    expect(buildBlobKey("user-1", "foto.png")).toBe("uploads/user-1/foto.png");
  });

  it("gives different users different keys for the same filename", () => {
    expect(buildBlobKey("user-1", "foto.png")).not.toBe(
      buildBlobKey("user-2", "foto.png")
    );
  });

  it("sanitizes unsafe characters", () => {
    expect(buildBlobKey("user-1", "mi nha foto!.png")).toBe(
      "uploads/user-1/mi_nha_foto_.png"
    );
  });

  it("strips path traversal attempts", () => {
    expect(buildBlobKey("user-1", "../../etc/passwd")).toBe(
      "uploads/user-1/.._.._etc_passwd"
    );
  });

  it("falls back to a default name when the filename is empty", () => {
    expect(buildBlobKey("user-1", "")).toBe("uploads/user-1/upload");
  });
});
