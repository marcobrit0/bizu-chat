import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, describe, expect, test } from "vitest";

const testDatabaseUrl = process.env.TEST_POSTGRES_URL;
const sql = postgres(
  testDatabaseUrl ?? "postgres://integration-test-disabled",
  {
    max: 1,
  }
);

describe.skipIf(!testDatabaseUrl)("database security invariants", () => {
  afterAll(async () => {
    await sql.end();
  });

  test("rejects cross-tenant relations and cascades erased data", async () => {
    const ownerId = randomUUID();
    const otherUserId = randomUUID();
    const ownerChatId = randomUUID();
    const otherChatId = randomUUID();
    const ownerMessageId = randomUUID();
    const otherMessageId = randomUUID();
    const documentId = randomUUID();
    const now = new Date();

    await sql`
      INSERT INTO "User" ("id", "email")
      VALUES
        (${ownerId}, ${`owner-${ownerId}@example.test`}),
        (${otherUserId}, ${`other-${otherUserId}@example.test`})
    `;
    await sql`
      INSERT INTO "Chat" ("id", "createdAt", "title", "userId")
      VALUES
        (${ownerChatId}, ${now}, 'Owner chat', ${ownerId}),
        (${otherChatId}, ${now}, 'Other chat', ${otherUserId})
    `;
    await sql`
      INSERT INTO "Message_v2"
        ("id", "chatId", "createdAt", "role", "parts", "attachments")
      VALUES
        (${ownerMessageId}, ${ownerChatId}, ${now}, 'assistant', '[]', '[]'),
        (${otherMessageId}, ${otherChatId}, ${now}, 'assistant', '[]', '[]')
    `;

    await expect(
      sql`
        INSERT INTO "Vote_v2" ("chatId", "messageId", "isUpvoted")
        VALUES (${otherChatId}, ${ownerMessageId}, true)
      `
    ).rejects.toMatchObject({ code: "23503" });

    await sql`
      INSERT INTO "Vote_v2" ("chatId", "messageId", "isUpvoted")
      VALUES (${ownerChatId}, ${ownerMessageId}, true)
    `;
    await sql`
      INSERT INTO "Stream" ("id", "chatId", "createdAt")
      VALUES (${randomUUID()}, ${ownerChatId}, ${now})
    `;
    await sql`
      INSERT INTO "Document"
        ("id", "createdAt", "text", "title", "userId")
      VALUES (${documentId}, ${now}, 'text', 'Owner document', ${ownerId})
    `;

    await expect(
      sql`
        INSERT INTO "Suggestion"
          (
            "id",
            "createdAt",
            "documentCreatedAt",
            "documentId",
            "originalText",
            "suggestedText",
            "userId"
          )
        VALUES
          (
            ${randomUUID()},
            ${now},
            ${now},
            ${documentId},
            'before',
            'after',
            ${otherUserId}
          )
      `
    ).rejects.toMatchObject({ code: "23503" });

    await sql`
      INSERT INTO "Suggestion"
        (
          "id",
          "createdAt",
          "documentCreatedAt",
          "documentId",
          "originalText",
          "suggestedText",
          "userId"
        )
      VALUES
        (
          ${randomUUID()},
          ${now},
          ${now},
          ${documentId},
          'before',
          'after',
          ${ownerId}
        )
    `;

    await sql`DELETE FROM "Chat" WHERE "id" = ${ownerChatId}`;

    const [chatChildren] = await sql`
      SELECT
        (SELECT count(*) FROM "Message_v2" WHERE "chatId" = ${ownerChatId})
          AS messages,
        (SELECT count(*) FROM "Vote_v2" WHERE "chatId" = ${ownerChatId})
          AS votes,
        (SELECT count(*) FROM "Stream" WHERE "chatId" = ${ownerChatId})
          AS streams
    `;
    expect(chatChildren).toMatchObject({
      messages: "0",
      streams: "0",
      votes: "0",
    });

    const blobDeletionId = randomUUID();
    await sql`
      INSERT INTO "BlobDeletion" ("id", "urls", "userId")
      VALUES (
        ${blobDeletionId},
        ${sql.json(["https://example.test/pending-blob"])},
        ${ownerId}
      )
    `;
    await sql`DELETE FROM "User" WHERE "id" = ${ownerId}`;

    const [accountChildren] = await sql`
      SELECT
        (SELECT count(*) FROM "Document" WHERE "userId" = ${ownerId})
          AS documents,
        (SELECT count(*) FROM "Suggestion" WHERE "userId" = ${ownerId})
          AS suggestions,
        (SELECT count(*) FROM "BlobDeletion" WHERE "userId" = ${ownerId})
          AS pending_blob_deletions
    `;
    expect(accountChildren).toMatchObject({
      documents: "0",
      pending_blob_deletions: "1",
      suggestions: "0",
    });

    await sql`DELETE FROM "BlobDeletion" WHERE "id" = ${blobDeletionId}`;
    await sql`DELETE FROM "User" WHERE "id" = ${otherUserId}`;
  });
});
