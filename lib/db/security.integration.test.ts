import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, describe, expect, test, vi } from "vitest";
import { extractMessageAttachmentUrls } from "@/lib/message-attachments";

vi.mock("server-only", () => ({}));

const testDatabaseUrl = process.env.TEST_POSTGRES_URL;
const integrationDatabaseUrl =
  testDatabaseUrl ?? "postgres://integration-test-disabled";
const sql = postgres(integrationDatabaseUrl, {
  max: 1,
});

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
      INSERT INTO "DocumentOwner" ("id", "userId")
      VALUES (${documentId}, ${ownerId})
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

  test("serialises concurrent deletion of chats sharing one blob", async () => {
    const firstSql = postgres(integrationDatabaseUrl, { max: 1 });
    const secondSql = postgres(integrationDatabaseUrl, { max: 1 });
    const userId = randomUUID();
    const firstChatId = randomUUID();
    const secondChatId = randomUUID();
    const sharedUrl = `https://blob.test/uploads/${userId}/shared.png`;
    const now = new Date();
    let releaseFirst: () => void = () => undefined;
    let signalFirstLocked: () => void = () => undefined;
    let signalSecondStarted: () => void = () => undefined;
    const holdFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstLocked = new Promise<void>((resolve) => {
      signalFirstLocked = resolve;
    });
    const secondStarted = new Promise<void>((resolve) => {
      signalSecondStarted = resolve;
    });

    await sql`
      INSERT INTO "User" ("id", "email")
      VALUES (${userId}, ${`shared-${userId}@example.test`})
    `;
    await sql`
      INSERT INTO "Chat" ("id", "createdAt", "title", "userId")
      VALUES
        (${firstChatId}, ${now}, 'First chat', ${userId}),
        (${secondChatId}, ${now}, 'Second chat', ${userId})
    `;
    await sql`
      INSERT INTO "Message_v2"
        ("id", "chatId", "createdAt", "role", "parts", "attachments")
      VALUES
        (
          ${randomUUID()},
          ${firstChatId},
          ${now},
          'user',
          ${sql.json([{ type: "file", url: sharedUrl }])},
          '[]'
        ),
        (
          ${randomUUID()},
          ${secondChatId},
          ${now},
          'user',
          ${sql.json([{ type: "file", url: sharedUrl }])},
          '[]'
        )
    `;

    const deleteChat = async (
      transaction: postgres.TransactionSql,
      chatId: string
    ) => {
      await transaction`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${userId}::text, 0)
        )
      `;
      const otherRows = await transaction`
        SELECT "attachments", "parts"
        FROM "Message_v2"
        INNER JOIN "Chat" ON "Message_v2"."chatId" = "Chat"."id"
        WHERE "Chat"."userId" = ${userId}
          AND "Chat"."id" <> ${chatId}
      `;
      const referencedElsewhere = otherRows.some(({ attachments, parts }) =>
        extractMessageAttachmentUrls(attachments, parts).includes(sharedUrl)
      );

      if (!referencedElsewhere) {
        await transaction`
          INSERT INTO "BlobDeletion" ("urls", "userId")
          VALUES (${transaction.json([sharedUrl])}, ${userId})
        `;
      }

      await transaction`DELETE FROM "Chat" WHERE "id" = ${chatId}`;
    };

    const firstDeletion = firstSql.begin(async (transaction) => {
      await transaction`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${userId}::text, 0)
        )
      `;
      signalFirstLocked();
      await holdFirst;

      await deleteChat(transaction, firstChatId);
    });
    await firstLocked;
    const secondDeletion = secondSql.begin(async (transaction) => {
      signalSecondStarted();
      await deleteChat(transaction, secondChatId);
    });
    await secondStarted;
    releaseFirst();
    await Promise.all([firstDeletion, secondDeletion]);

    const deletionRows = await sql`
      SELECT "urls"
      FROM "BlobDeletion"
      WHERE "userId" = ${userId}
    `;
    expect(deletionRows).toHaveLength(1);
    expect(deletionRows[0]?.urls).toEqual([sharedUrl]);

    await sql`DELETE FROM "BlobDeletion" WHERE "userId" = ${userId}`;
    await sql`DELETE FROM "User" WHERE "id" = ${userId}`;
    await Promise.all([firstSql.end(), secondSql.end()]);
  });

  test("a stale history-deletion retry preserves newly created chats", async () => {
    process.env.POSTGRES_URL = integrationDatabaseUrl;
    const { deleteAllChatsByUserId, markAllChatsForDeletion, saveChat } =
      await import("./queries");
    const userId = randomUUID();
    const oldChatId = randomUUID();
    const newChatId = randomUUID();
    const oldBlobUrl = `https://blob.test/uploads/${userId}/old.png`;
    const now = new Date();

    await sql`
      INSERT INTO "User" ("id", "email")
      VALUES (${userId}, ${`history-${userId}@example.test`})
    `;
    await sql`
      INSERT INTO "Chat" ("id", "createdAt", "title", "userId")
      VALUES (${oldChatId}, ${now}, 'Old chat', ${userId})
    `;
    await sql`
      INSERT INTO "Message_v2"
        ("id", "chatId", "createdAt", "role", "parts", "attachments")
      VALUES (
        ${randomUUID()},
        ${oldChatId},
        ${now},
        'user',
        ${sql.json([{ type: "file", url: oldBlobUrl }])},
        '[]'
      )
    `;

    const chatDeletionGeneration = await markAllChatsForDeletion({ userId });
    await deleteAllChatsByUserId({
      chatDeletionGeneration: chatDeletionGeneration ?? 0,
      userId,
    });
    await saveChat({
      id: newChatId,
      title: "New chat",
      userId,
      visibility: "private",
    });
    await deleteAllChatsByUserId({
      chatDeletionGeneration: chatDeletionGeneration ?? 0,
      userId,
    });

    const remainingChats = await sql`
      SELECT "id"
      FROM "Chat"
      WHERE "userId" = ${userId}
    `;
    const deletionRows = await sql`
      SELECT "urls"
      FROM "BlobDeletion"
      WHERE "userId" = ${userId}
    `;
    expect(remainingChats).toEqual([{ id: newChatId }]);
    expect(deletionRows).toEqual([{ urls: [oldBlobUrl] }]);

    await sql`DELETE FROM "User" WHERE "id" = ${userId}`;
  });

  test("history erasure clears its marker only after bounded batches finish", async () => {
    process.env.POSTGRES_URL = integrationDatabaseUrl;
    const { deleteAllChatsByUserId, markAllChatsForDeletion } = await import(
      "./queries"
    );
    const userId = randomUUID();

    await sql`
      INSERT INTO "User" ("id", "email")
      VALUES (${userId}, ${`history-batch-${userId}@example.test`})
    `;
    await sql`
      INSERT INTO "Chat" ("id", "createdAt", "title", "userId")
      SELECT
        md5(${`history-chat-${userId}-`} || batch_number::text)::uuid,
        now(),
        'Batched history chat',
        ${userId}
      FROM generate_series(1, 101) AS batch_number
    `;

    const chatDeletionGeneration = await markAllChatsForDeletion({ userId });
    await expect(
      deleteAllChatsByUserId({
        chatDeletionGeneration: chatDeletionGeneration ?? 0,
        userId,
      })
    ).resolves.toEqual({ complete: false, deletedCount: 100 });

    const [pendingUser] = await sql`
      SELECT "chatsDeletingAt"
      FROM "User"
      WHERE "id" = ${userId}
    `;
    const [remainingAfterFirstBatch] = await sql`
      SELECT count(*)::integer AS "count"
      FROM "Chat"
      WHERE "userId" = ${userId}
    `;
    expect(pendingUser?.chatsDeletingAt).toBeInstanceOf(Date);
    expect(remainingAfterFirstBatch?.count).toBe(1);

    await expect(
      deleteAllChatsByUserId({
        chatDeletionGeneration: chatDeletionGeneration ?? 0,
        userId,
      })
    ).resolves.toEqual({ complete: true, deletedCount: 1 });

    const [completedUser] = await sql`
      SELECT "chatsDeletingAt"
      FROM "User"
      WHERE "id" = ${userId}
    `;
    expect(completedUser?.chatsDeletingAt).toBeNull();

    await sql`DELETE FROM "User" WHERE "id" = ${userId}`;
  });

  test("a blob re-referenced before drain is preserved", async () => {
    process.env.POSTGRES_URL = integrationDatabaseUrl;
    const { claimPendingBlobDeletion, deleteChatById, saveMessages } =
      await import("./queries");
    const userId = randomUUID();
    const deletedChatId = randomUUID();
    const preservedChatId = randomUUID();
    const blobUrl = `https://blob.test/uploads/${userId}/shared.png`;
    const now = new Date();

    await sql`
      INSERT INTO "User" ("id", "email")
      VALUES (${userId}, ${`re-reference-${userId}@example.test`})
    `;
    await sql`
      INSERT INTO "Chat" ("id", "createdAt", "title", "userId")
      VALUES
        (${deletedChatId}, ${now}, 'Deleted chat', ${userId}),
        (${preservedChatId}, ${now}, 'Preserved chat', ${userId})
    `;
    await sql`
      INSERT INTO "Message_v2"
        ("id", "chatId", "createdAt", "role", "parts", "attachments")
      VALUES (
        ${randomUUID()},
        ${deletedChatId},
        ${now},
        'user',
        ${sql.json([{ type: "file", url: blobUrl }])},
        '[]'
      )
    `;

    await deleteChatById({
      blobUrls: [blobUrl],
      id: deletedChatId,
      userId,
    });
    await saveMessages({
      messages: [
        {
          attachments: [],
          chatId: preservedChatId,
          createdAt: new Date(),
          id: randomUUID(),
          parts: [{ type: "file", url: blobUrl }],
          role: "user",
        },
      ],
      userId,
      validateBlobUrls: async () => true,
    });
    const [pendingDeletion] = await sql`
      SELECT "id"
      FROM "BlobDeletion"
      WHERE "userId" = ${userId}
    `;

    const claim = await claimPendingBlobDeletion({
      id: pendingDeletion?.id,
      resolvedIdentifiers: [
        { continuation: false, identifier: blobUrl, url: blobUrl },
      ],
      userId,
    });

    expect(claim).toEqual({
      claimToken: null,
      continuationIdentifiers: [],
      deletableUrls: [],
      unresolvedIdentifiers: [],
    });
    const remainingDeletions = await sql`
      SELECT "id"
      FROM "BlobDeletion"
      WHERE "userId" = ${userId}
    `;
    expect(remainingDeletions).toHaveLength(0);

    await sql`DELETE FROM "User" WHERE "id" = ${userId}`;
  });

  test("an unclaimed upload intent completes atomically", async () => {
    process.env.POSTGRES_URL = integrationDatabaseUrl;
    const { completeBlobUpload, queueBlobDeletion } = await import("./queries");
    const userId = randomUUID();
    const readyAt = new Date(Date.now() + 15 * 60 * 1000);
    const pathname = `uploads/${userId}/image.png`;
    const url = `https://blob.test/${pathname}`;

    await sql`
      INSERT INTO "User" ("id", "email")
      VALUES (${userId}, ${`upload-${userId}@example.test`})
    `;
    const [intent] = await queueBlobDeletion({
      readyAt,
      urls: [pathname],
      userId,
    });

    await expect(
      completeBlobUpload({
        chatDeletionGeneration: 0,
        expectedReadyAt: readyAt,
        id: intent.id,
        url,
        userId,
      })
    ).resolves.toBe(true);
    const pendingIntents = await sql`
      SELECT "id"
      FROM "BlobDeletion"
      WHERE "userId" = ${userId}
    `;
    expect(pendingIntents).toHaveLength(0);

    await sql`DELETE FROM "User" WHERE "id" = ${userId}`;
  });

  test("a document id has one database-enforced owner", async () => {
    process.env.POSTGRES_URL = integrationDatabaseUrl;
    const {
      deleteDocumentsByIdAfterTimestamp,
      getDocumentsById,
      getSuggestionsByDocumentId,
      saveDocument,
    } = await import("./queries");
    const ownerId = randomUUID();
    const otherUserId = randomUUID();
    const documentId = randomUUID();

    await sql`
      INSERT INTO "User" ("id", "email")
      VALUES
        (${ownerId}, ${`document-owner-${ownerId}@example.test`}),
        (${otherUserId}, ${`document-other-${otherUserId}@example.test`})
    `;
    const [ownerDocument] = await saveDocument({
      content: "owner content",
      id: documentId,
      kind: "text",
      title: "Owner document",
      userId: ownerId,
    });
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
      VALUES (
        ${randomUUID()},
        now(),
        ${ownerDocument.createdAt},
        ${documentId},
        'private original',
        'private suggestion',
        ${ownerId}
      )
    `;

    await expect(
      saveDocument({
        content: "other content",
        id: documentId,
        kind: "text",
        title: "Other document",
        userId: otherUserId,
      })
    ).rejects.toThrow();
    await expect(
      getDocumentsById({ id: documentId, userId: otherUserId })
    ).resolves.toEqual([]);
    await expect(
      getSuggestionsByDocumentId({ documentId, userId: otherUserId })
    ).resolves.toEqual([]);
    await expect(
      getSuggestionsByDocumentId({ documentId, userId: ownerId })
    ).resolves.toHaveLength(1);
    await expect(
      deleteDocumentsByIdAfterTimestamp({
        id: documentId,
        timestamp: new Date(0),
        userId: otherUserId,
      })
    ).resolves.toEqual([]);

    await sql`DELETE FROM "User" WHERE "id" IN (${ownerId}, ${otherUserId})`;
  });

  test("account erasure makes bounded forward progress before final deletion", async () => {
    process.env.POSTGRES_URL = integrationDatabaseUrl;
    const { deleteUserById, markUserForDeletion } = await import("./queries");
    const userId = randomUUID();
    const blobPrefix = `uploads/${userId}/`;

    await sql`
      INSERT INTO "User" ("id", "email")
      VALUES (${userId}, ${`batched-${userId}@example.test`})
    `;
    await sql`
      INSERT INTO "Chat" ("id", "createdAt", "title", "userId")
      SELECT
        md5(${`chat-${userId}-`} || batch_number::text)::uuid,
        now(),
        'Batched account chat',
        ${userId}
      FROM generate_series(1, 101) AS batch_number
    `;
    await sql`
      INSERT INTO "Message_v2"
        ("id", "chatId", "createdAt", "role", "parts", "attachments")
      SELECT
        md5("id"::text || '-message')::uuid,
        "id",
        now(),
        'user',
        json_build_array(
          json_build_object(
            'type',
            'file',
            'url',
            ${`https://blob.test/uploads/${userId}/`} || "id"::text
          )
        ),
        '[]'
      FROM "Chat"
      WHERE "userId" = ${userId}
    `;

    await markUserForDeletion({ id: userId });
    await expect(
      deleteUserById({ blobUrls: [blobPrefix], id: userId })
    ).resolves.toEqual({ complete: false });

    const [pendingUser] = await sql`
      SELECT "deletingAt"
      FROM "User"
      WHERE "id" = ${userId}
    `;
    const [remainingAfterFirstBatch] = await sql`
      SELECT count(*)::integer AS "count"
      FROM "Chat"
      WHERE "userId" = ${userId}
    `;
    const [firstOutbox] = await sql`
      SELECT json_array_length("urls") AS "urlCount"
      FROM "BlobDeletion"
      WHERE "userId" = ${userId}
    `;
    expect(pendingUser?.deletingAt).toBeInstanceOf(Date);
    expect(remainingAfterFirstBatch?.count).toBe(1);
    expect(firstOutbox?.urlCount).toBe(100);

    await expect(
      deleteUserById({ blobUrls: [blobPrefix], id: userId })
    ).resolves.toEqual({ complete: true });

    const [deletedUser] = await sql`
      SELECT "id"
      FROM "User"
      WHERE "id" = ${userId}
    `;
    const [prefixOutbox] = await sql`
      SELECT "id"
      FROM "BlobDeletion"
      WHERE
        "userId" = ${userId}
        AND "urls"::jsonb @> jsonb_build_array(${blobPrefix}::text)
    `;
    expect(deletedUser).toBeUndefined();
    expect(prefixOutbox?.id).toBeDefined();

    await sql`DELETE FROM "BlobDeletion" WHERE "userId" = ${userId}`;
  });

  test("an expired prefix deletion lease blocks child URL reattachment", async () => {
    process.env.POSTGRES_URL = integrationDatabaseUrl;
    const {
      claimPendingBlobDeletion,
      completePendingBlobDeletion,
      saveMessages,
    } = await import("./queries");
    const userId = randomUUID();
    const chatId = randomUUID();
    const blobPrefix = `uploads/${userId}/`;
    const blobUrl = `https://blob.test/uploads/${userId}/claimed.png`;
    const deletionId = randomUUID();
    const now = new Date();

    await sql`
      INSERT INTO "User" ("id", "email")
      VALUES (${userId}, ${`claimed-${userId}@example.test`})
    `;
    await sql`
      INSERT INTO "Chat" ("id", "createdAt", "title", "userId")
      VALUES (${chatId}, ${now}, 'Claimed blob chat', ${userId})
    `;
    await sql`
      INSERT INTO "BlobDeletion" ("id", "readyAt", "urls", "userId")
      VALUES (${deletionId}, ${now}, ${sql.json([blobPrefix])}, ${userId})
    `;

    const firstClaim = await claimPendingBlobDeletion({
      id: deletionId,
      resolvedIdentifiers: [
        { continuation: false, identifier: blobPrefix, url: blobUrl },
      ],
      userId,
    });
    expect(firstClaim).toEqual({
      claimToken: expect.any(String),
      continuationIdentifiers: [],
      deletableUrls: [blobUrl],
      unresolvedIdentifiers: [],
    });
    await sql`
      UPDATE "BlobDeletion"
      SET "readyAt" = now() - interval '1 minute'
      WHERE "id" = ${deletionId}
    `;
    const secondClaim = await claimPendingBlobDeletion({
      id: deletionId,
      resolvedIdentifiers: [
        { continuation: false, identifier: blobPrefix, url: blobUrl },
      ],
      userId,
    });
    expect(secondClaim).toEqual({
      claimToken: expect.any(String),
      continuationIdentifiers: [],
      deletableUrls: [blobUrl],
      unresolvedIdentifiers: [],
    });
    expect(secondClaim?.claimToken).not.toBe(firstClaim?.claimToken);

    await expect(
      saveMessages({
        messages: [
          {
            attachments: [],
            chatId,
            createdAt: new Date(),
            id: randomUUID(),
            parts: [{ type: "file", url: blobUrl }],
            role: "user",
          },
        ],
        userId,
        validateBlobUrls: async () => true,
      })
    ).rejects.toThrow();

    await completePendingBlobDeletion({
      claimToken: firstClaim?.claimToken ?? "",
      continuationIdentifiers: [],
      id: deletionId,
      unresolvedIdentifiers: [],
      userId,
    });
    const [fencedDeletion] = await sql`
      SELECT "claimToken"
      FROM "BlobDeletion"
      WHERE "id" = ${deletionId}
    `;
    expect(fencedDeletion?.claimToken).toBe(secondClaim?.claimToken);

    await completePendingBlobDeletion({
      claimToken: secondClaim?.claimToken ?? "",
      continuationIdentifiers: [],
      id: deletionId,
      unresolvedIdentifiers: [],
      userId,
    });
    await sql`DELETE FROM "User" WHERE "id" = ${userId}`;
  });

  test("an unresolved upload intent is discarded after bounded attempts", async () => {
    process.env.POSTGRES_URL = integrationDatabaseUrl;
    const {
      claimPendingBlobDeletion,
      completePendingBlobDeletion,
      queueBlobDeletion,
    } = await import("./queries");
    const userId = randomUUID();
    const pathname = `uploads/${userId}/missing.png`;

    await sql`
      INSERT INTO "User" ("id", "email")
      VALUES (${userId}, ${`missing-${userId}@example.test`})
    `;
    const [intent] = await queueBlobDeletion({
      readyAt: new Date(Date.now() - 1000),
      urls: [pathname],
      userId,
    });

    const exhaustIntent = async (expectedAttempt: number): Promise<void> => {
      const claim = await claimPendingBlobDeletion({
        id: intent.id,
        resolvedIdentifiers: [
          { continuation: false, identifier: pathname, url: null },
        ],
        userId,
      });
      await completePendingBlobDeletion({
        claimToken: claim?.claimToken ?? "",
        continuationIdentifiers: [],
        id: intent.id,
        unresolvedIdentifiers: [pathname],
        userId,
      });
      const [pendingIntent] = await sql`
        SELECT "attempts"
        FROM "BlobDeletion"
        WHERE "id" = ${intent.id}
      `;

      if (expectedAttempt < 3) {
        expect(pendingIntent?.attempts).toBe(expectedAttempt);
        await sql`
          UPDATE "BlobDeletion"
          SET "readyAt" = now() - interval '1 second'
          WHERE "id" = ${intent.id}
        `;
        await exhaustIntent(expectedAttempt + 1);
      } else {
        expect(pendingIntent).toBeUndefined();
      }
    };

    await exhaustIntent(1);
    await sql`DELETE FROM "User" WHERE "id" = ${userId}`;
  });
});
