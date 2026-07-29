export const extractMessageAttachmentUrls = (
  attachments: unknown,
  parts: unknown
) =>
  [attachments, parts].flatMap((value) =>
    Array.isArray(value)
      ? value.flatMap((item) =>
          typeof item === "object" &&
          item !== null &&
          "url" in item &&
          typeof item.url === "string"
            ? [item.url]
            : []
        )
      : []
  );
