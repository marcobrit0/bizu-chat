import { describe, expect, test } from "vitest";
import { extractMessageAttachmentUrls } from "./message-attachments";

describe("message attachment URLs", () => {
  test("reads current file parts and legacy attachment records", () => {
    expect(
      extractMessageAttachmentUrls(
        [{ url: "https://blob.test/legacy.png" }],
        [
          { text: "hello", type: "text" },
          { type: "file", url: "https://blob.test/current.png" },
        ]
      )
    ).toEqual([
      "https://blob.test/legacy.png",
      "https://blob.test/current.png",
    ]);
  });
});
