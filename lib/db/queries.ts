import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { extractMessageAttachmentUrls } from "@/lib/message-attachments";
import { ChatbotError } from "../errors";
import { generateUUID } from "../utils";
import {
  blobDeletion,
  type Chat,
  chat,
  type DBMessage,
  document,
  documentOwner,
  message,
  type Suggestion,
  stream,
  suggestion,
  type User,
  user,
  vote,
} from "./schema";
import { buildGuestEmail, generateHashedPassword } from "./utils";

const client = postgres(process.env.POSTGRES_URL ?? "", {
  connect_timeout: 10,
  idle_timeout: 20,
  max: 1,
  max_lifetime: 60 * 30,
});
const db = drizzle(client);
const DATA_ERASURE_BATCH_SIZE = 100;
const DATA_ERASURE_RETRY_MS = 15 * 60 * 1000;
const MAX_UNRESOLVED_BLOB_ATTEMPTS = 3;
const userBlobPrefix = (userId: string) => `uploads/${userId}/`;

const isPendingBlobUrl = ({
  identifier,
  url,
  userId,
}: {
  identifier: string;
  url: string;
  userId: string;
}) =>
  identifier === url ||
  (identifier === userBlobPrefix(userId) &&
    URL.canParse(url) &&
    new URL(url).pathname.startsWith(`/${identifier}`));

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getUserById({ id }: { id: string }) {
  try {
    const [selectedUser] = await db
      .select({
        chatDeletionGeneration: user.chatDeletionGeneration,
        chatsDeletingAt: user.chatsDeletingAt,
        deletingAt: user.deletingAt,
        id: user.id,
      })
      .from(user)
      .where(eq(user.id, id));

    return selectedUser;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getPendingDataErasures() {
  try {
    const now = new Date();

    return await db
      .select({
        chatDeletionGeneration: user.chatDeletionGeneration,
        chatsDeletingAt: user.chatsDeletingAt,
        deletingAt: user.deletingAt,
        id: user.id,
      })
      .from(user)
      .where(
        or(
          and(isNotNull(user.deletingAt), lte(user.deletingAt, now)),
          and(
            isNull(user.deletingAt),
            isNotNull(user.chatsDeletingAt),
            lte(user.chatsDeletingAt, now)
          )
        )
      )
      .orderBy(asc(sql`COALESCE(${user.deletingAt}, ${user.chatsDeletingAt})`))
      .limit(100);
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getPendingChatErasures() {
  try {
    return await db
      .select({
        deletingAt: chat.deletingAt,
        id: chat.id,
        userId: chat.userId,
      })
      .from(chat)
      .innerJoin(user, eq(chat.userId, user.id))
      .where(
        and(
          isNotNull(chat.deletingAt),
          lte(chat.deletingAt, new Date()),
          isNull(user.chatsDeletingAt),
          isNull(user.deletingAt)
        )
      )
      .orderBy(asc(chat.deletingAt))
      .limit(100);
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function deferPendingDataErasure({
  accountDeletion,
  id,
}: {
  accountDeletion: boolean;
  id: string;
}) {
  try {
    const retryAt = new Date(Date.now() + DATA_ERASURE_RETRY_MS);

    if (accountDeletion) {
      return await db
        .update(user)
        .set({ deletingAt: retryAt })
        .where(and(eq(user.id, id), isNotNull(user.deletingAt)));
    }

    return await db
      .update(user)
      .set({ chatsDeletingAt: retryAt })
      .where(
        and(
          eq(user.id, id),
          isNull(user.deletingAt),
          isNotNull(user.chatsDeletingAt)
        )
      );
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function deferPendingChatErasure({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  try {
    return await db
      .update(chat)
      .set({ deletingAt: new Date(Date.now() + DATA_ERASURE_RETRY_MS) })
      .where(
        and(
          eq(chat.id, id),
          eq(chat.userId, userId),
          isNotNull(chat.deletingAt)
        )
      );
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (error) {
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function createGuestUser() {
  const email = buildGuestEmail();
  const password = generateHashedPassword(generateUUID());

  try {
    return await db
      .insert(user)
      .values({ email, isAnonymous: true, password })
      .returning({
        email: user.email,
        id: user.id,
      });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 0))`
      );
      const [writableUser] = await transaction
        .select({ id: user.id })
        .from(user)
        .where(
          and(
            eq(user.id, userId),
            isNull(user.deletingAt),
            isNull(user.chatsDeletingAt)
          )
        );

      if (writableUser) {
        return await transaction.insert(chat).values({
          createdAt: new Date(),
          id,
          title,
          userId,
          visibility,
        });
      }

      throw new ChatbotError("forbidden:chat");
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function deleteChatById({
  blobUrls,
  id,
  userId,
}: {
  blobUrls: string[];
  id: string;
  userId: string;
}) {
  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 0))`
      );
      const otherRows = await transaction
        .select({
          attachments: message.attachments,
          parts: message.parts,
        })
        .from(message)
        .innerJoin(chat, eq(message.chatId, chat.id))
        .where(and(eq(chat.userId, userId), ne(chat.id, id)));
      const referencedElsewhere = new Set(
        otherRows.flatMap(({ attachments, parts }) =>
          extractMessageAttachmentUrls(attachments, parts)
        )
      );
      const unsharedBlobUrls = blobUrls.filter(
        (url) => !referencedElsewhere.has(url)
      );
      const [deletedChat] = await transaction
        .delete(chat)
        .where(and(eq(chat.id, id), eq(chat.userId, userId)))
        .returning();

      if (deletedChat && unsharedBlobUrls.length > 0) {
        await transaction
          .insert(blobDeletion)
          .values({ urls: unsharedBlobUrls, userId });
      }

      return deletedChat;
    });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function deleteAllChatsByUserId({
  chatDeletionGeneration,
  userId,
}: {
  chatDeletionGeneration: number;
  userId: string;
}) {
  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 0))`
      );
      const [activeDeletion] = await transaction
        .select({ id: user.id })
        .from(user)
        .where(
          and(
            eq(user.id, userId),
            eq(user.chatDeletionGeneration, chatDeletionGeneration),
            isNotNull(user.chatsDeletingAt),
            isNull(user.deletingAt)
          )
        );

      if (activeDeletion) {
        const messageRows = await transaction
          .select({
            attachments: message.attachments,
            id: message.id,
            parts: message.parts,
          })
          .from(message)
          .innerJoin(chat, eq(message.chatId, chat.id))
          .where(and(eq(chat.userId, userId), isNotNull(chat.deletingAt)))
          .orderBy(asc(message.createdAt), asc(message.id))
          .limit(DATA_ERASURE_BATCH_SIZE);
        const messageIds = messageRows.map(({ id }) => id);
        const blobUrls = [
          ...new Set(
            messageRows.flatMap(({ attachments, parts }) =>
              extractMessageAttachmentUrls(attachments, parts)
            )
          ),
        ];

        if (messageIds.length > 0) {
          await transaction
            .delete(message)
            .where(inArray(message.id, messageIds));
        }

        if (blobUrls.length > 0) {
          await transaction
            .insert(blobDeletion)
            .values({ urls: blobUrls, userId });
        }

        if (messageIds.length === DATA_ERASURE_BATCH_SIZE) {
          return { complete: false, deletedCount: 0 };
        }

        const selectedStreams = await transaction
          .select({ id: stream.id })
          .from(stream)
          .innerJoin(chat, eq(stream.chatId, chat.id))
          .where(and(eq(chat.userId, userId), isNotNull(chat.deletingAt)))
          .orderBy(asc(stream.createdAt), asc(stream.id))
          .limit(DATA_ERASURE_BATCH_SIZE);
        const streamIds = selectedStreams.map(({ id }) => id);

        if (streamIds.length > 0) {
          await transaction.delete(stream).where(inArray(stream.id, streamIds));
        }

        if (streamIds.length === DATA_ERASURE_BATCH_SIZE) {
          return { complete: false, deletedCount: 0 };
        }

        const selectedChats = await transaction
          .select({ id: chat.id })
          .from(chat)
          .where(and(eq(chat.userId, userId), isNotNull(chat.deletingAt)))
          .orderBy(asc(chat.createdAt), asc(chat.id))
          .limit(DATA_ERASURE_BATCH_SIZE);
        const chatIds = selectedChats.map(({ id }) => id);
        const deletedChats = await transaction
          .delete(chat)
          .where(inArray(chat.id, chatIds))
          .returning();

        const [remainingChat] = await transaction
          .select({ id: chat.id })
          .from(chat)
          .where(and(eq(chat.userId, userId), isNotNull(chat.deletingAt)))
          .limit(1);

        if (!remainingChat) {
          await transaction
            .update(user)
            .set({ chatsDeletingAt: null })
            .where(
              and(
                eq(user.id, userId),
                eq(user.chatDeletionGeneration, chatDeletionGeneration)
              )
            );
        }

        return {
          complete: !remainingChat,
          deletedCount: deletedChats.length,
        };
      }

      return { complete: true, deletedCount: 0 };
    });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<unknown>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt), desc(chat.id))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(and(eq(chat.id, startingAfter), eq(chat.userId, id)))
        .limit(1);

      if (selectedChat) {
        filteredChats = await query(
          or(
            gt(chat.createdAt, selectedChat.createdAt),
            and(
              eq(chat.createdAt, selectedChat.createdAt),
              gt(chat.id, selectedChat.id)
            )
          )
        );
      } else {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(and(eq(chat.id, endingBefore), eq(chat.userId, id)))
        .limit(1);

      if (selectedChat) {
        filteredChats = await query(
          or(
            lt(chat.createdAt, selectedChat.createdAt),
            and(
              eq(chat.createdAt, selectedChat.createdAt),
              lt(chat.id, selectedChat.id)
            )
          )
        );
      } else {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (error) {
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function assertChatWritable({
  chatId,
  userId,
}: {
  chatId: string;
  userId: string;
}) {
  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 0))`
      );
      const [writableChat] = await transaction
        .select({ id: chat.id })
        .from(chat)
        .innerJoin(user, eq(chat.userId, user.id))
        .where(
          and(
            eq(chat.id, chatId),
            eq(chat.userId, userId),
            isNull(chat.deletingAt),
            isNull(user.deletingAt),
            isNull(user.chatsDeletingAt)
          )
        );

      if (writableChat) {
        return writableChat;
      }

      throw new ChatbotError("forbidden:chat");
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function saveMessages({
  messages,
  userId,
  validateBlobUrls,
}: {
  messages: DBMessage[];
  userId: string;
  validateBlobUrls: (userId: string, urls: string[]) => Promise<boolean>;
}) {
  const attachmentUrls = messages.flatMap(({ attachments, parts }) =>
    extractMessageAttachmentUrls(attachments, parts)
  );
  const blobsAvailable = await validateBlobUrls(userId, attachmentUrls);

  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`
          SELECT pg_advisory_xact_lock(
            hashtextextended("userId"::text, 0)
          )
          FROM "Chat"
          WHERE "id" = ${messages[0]?.chatId}
        `
      );
      const [writableChat] = await transaction
        .select({ id: chat.id })
        .from(chat)
        .innerJoin(user, eq(chat.userId, user.id))
        .where(
          and(
            eq(chat.id, messages[0]?.chatId ?? ""),
            eq(chat.userId, userId),
            isNull(chat.deletingAt),
            isNull(user.deletingAt),
            isNull(user.chatsDeletingAt)
          )
        );
      const pendingRows = await transaction
        .select({ urls: blobDeletion.urls })
        .from(blobDeletion)
        .where(
          and(
            eq(blobDeletion.userId, userId),
            isNotNull(blobDeletion.claimedAt)
          )
        );
      const pendingIdentifiers = pendingRows.flatMap(({ urls }) => urls);
      const referencesPendingBlob = attachmentUrls.some((url) =>
        pendingIdentifiers.some((identifier) =>
          isPendingBlobUrl({ identifier, url, userId })
        )
      );

      if (writableChat && blobsAvailable && !referencesPendingBlob) {
        return await transaction.insert(message).values(messages);
      }

      throw new ChatbotError("forbidden:chat");
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function updateMessage({
  chatId,
  id,
  parts,
  userId,
  validateBlobUrls,
}: {
  chatId: string;
  id: string;
  parts: DBMessage["parts"];
  userId: string;
  validateBlobUrls: (userId: string, urls: string[]) => Promise<boolean>;
}) {
  const attachmentUrls = extractMessageAttachmentUrls([], parts);
  const blobsAvailable = await validateBlobUrls(userId, attachmentUrls);

  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 0))`
      );
      const [writableMessage] = await transaction
        .select({ id: message.id })
        .from(message)
        .innerJoin(chat, eq(message.chatId, chat.id))
        .innerJoin(user, eq(chat.userId, user.id))
        .where(
          and(
            eq(message.id, id),
            eq(message.chatId, chatId),
            eq(chat.userId, userId),
            isNull(chat.deletingAt),
            isNull(user.deletingAt),
            isNull(user.chatsDeletingAt)
          )
        );
      const pendingRows = await transaction
        .select({ urls: blobDeletion.urls })
        .from(blobDeletion)
        .where(
          and(
            eq(blobDeletion.userId, userId),
            isNotNull(blobDeletion.claimedAt)
          )
        );
      const pendingIdentifiers = pendingRows.flatMap(({ urls }) => urls);
      const referencesPendingBlob = attachmentUrls.some((url) =>
        pendingIdentifiers.some((identifier) =>
          isPendingBlobUrl({ identifier, url, userId })
        )
      );

      if (writableMessage && blobsAvailable && !referencesPendingBlob) {
        return await transaction
          .update(message)
          .set({ parts })
          .where(and(eq(message.id, id), eq(message.chatId, chatId)));
      }

      throw new ChatbotError("forbidden:chat");
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    return await db
      .insert(vote)
      .values({
        chatId,
        isUpvoted: type === "up",
        messageId,
      })
      .onConflictDoUpdate({
        set: { isUpvoted: type === "up" },
        target: [vote.chatId, vote.messageId],
      });
  } catch (error) {
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 0))`
      );
      const [writableUser] = await transaction
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.id, userId), isNull(user.deletingAt)));

      if (writableUser) {
        await transaction
          .insert(documentOwner)
          .values({ id, userId })
          .onConflictDoNothing();

        return await transaction
          .insert(document)
          .values({
            content,
            createdAt: new Date(),
            id,
            kind,
            title,
            userId,
          })
          .returning();
      }

      throw new ChatbotError("forbidden:document");
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function updateDocumentContent({
  id,
  content,
  userId,
}: {
  id: string;
  content: string;
  userId: string;
}) {
  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 0))`
      );
      const [latest] = await transaction
        .select({ createdAt: document.createdAt })
        .from(document)
        .innerJoin(user, eq(document.userId, user.id))
        .where(
          and(
            eq(document.id, id),
            eq(document.userId, userId),
            isNull(user.deletingAt)
          )
        )
        .orderBy(desc(document.createdAt))
        .limit(1);

      if (latest) {
        return await transaction
          .update(document)
          .set({ content })
          .where(
            and(
              eq(document.id, id),
              eq(document.createdAt, latest.createdAt),
              eq(document.userId, userId)
            )
          )
          .returning();
      }

      throw new ChatbotError("forbidden:document");
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    throw new ChatbotError("bad_request:database", {
      cause: error,
    });
  }
}

export async function getDocumentsById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(and(eq(document.id, id), eq(document.userId, userId)))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getDocumentById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(and(eq(document.id, id), eq(document.userId, userId)))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
  userId,
}: {
  id: string;
  timestamp: Date;
  userId: string;
}) {
  try {
    return await db
      .delete(document)
      .where(
        and(
          eq(document.id, id),
          eq(document.userId, userId),
          gt(document.createdAt, timestamp)
        )
      )
      .returning();
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
  userId,
}: {
  documentId: string;
  userId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(
        and(
          eq(suggestion.documentId, documentId),
          eq(suggestion.userId, userId)
        )
      );
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getAttachmentUrlsByChatId({
  chatId,
}: {
  chatId: string;
}) {
  try {
    const rows = await db
      .select({
        attachments: message.attachments,
        parts: message.parts,
      })
      .from(message)
      .where(eq(message.chatId, chatId));

    return rows.flatMap(({ attachments, parts }) =>
      extractMessageAttachmentUrls(attachments, parts)
    );
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function markChatForDeletion({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 0))`
      );
      const [markedChat] = await transaction
        .update(chat)
        .set({ deletingAt: new Date() })
        .where(
          and(eq(chat.id, id), eq(chat.userId, userId), isNull(chat.deletingAt))
        )
        .returning({ id: chat.id });

      return markedChat;
    });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function markAllChatsForDeletion({ userId }: { userId: string }) {
  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 0))`
      );
      await transaction
        .update(user)
        .set({
          chatDeletionGeneration: sql`${user.chatDeletionGeneration} + 1`,
          chatsDeletingAt: new Date(),
        })
        .where(
          and(
            eq(user.id, userId),
            isNull(user.chatsDeletingAt),
            isNull(user.deletingAt)
          )
        );

      const [activeDeletion] = await transaction
        .select({
          chatDeletionGeneration: user.chatDeletionGeneration,
        })
        .from(user)
        .where(
          and(
            eq(user.id, userId),
            isNotNull(user.chatsDeletingAt),
            isNull(user.deletingAt)
          )
        );

      if (activeDeletion) {
        await transaction
          .update(chat)
          .set({ deletingAt: new Date() })
          .where(and(eq(chat.userId, userId), isNull(chat.deletingAt)));

        return activeDeletion.chatDeletionGeneration;
      }

      return null;
    });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`
          SELECT pg_advisory_xact_lock(
            hashtextextended("userId"::text, 0)
          )
          FROM "Chat"
          WHERE "id" = ${chatId}
        `
      );

      return await transaction
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
        );
    });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function deleteUserById({
  blobUrls,
  id,
}: {
  blobUrls: string[];
  id: string;
}) {
  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${id}::text, 0))`
      );
      const [activeDeletion] = await transaction
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.id, id), isNotNull(user.deletingAt)));

      if (activeDeletion) {
        const messageRows = await transaction
          .select({
            attachments: message.attachments,
            id: message.id,
            parts: message.parts,
          })
          .from(message)
          .innerJoin(chat, eq(message.chatId, chat.id))
          .where(eq(chat.userId, id))
          .orderBy(asc(message.createdAt), asc(message.id))
          .limit(DATA_ERASURE_BATCH_SIZE);
        const messageIds = messageRows.map(({ id: messageId }) => messageId);
        const attachmentUrls = [
          ...new Set(
            messageRows.flatMap(({ attachments, parts }) =>
              extractMessageAttachmentUrls(attachments, parts)
            )
          ),
        ];

        if (messageIds.length > 0) {
          await transaction
            .delete(message)
            .where(inArray(message.id, messageIds));
        }

        if (attachmentUrls.length > 0) {
          await transaction
            .insert(blobDeletion)
            .values({ urls: attachmentUrls, userId: id });
        }

        if (messageIds.length === DATA_ERASURE_BATCH_SIZE) {
          return { complete: false };
        }

        const selectedStreams = await transaction
          .select({ id: stream.id })
          .from(stream)
          .innerJoin(chat, eq(stream.chatId, chat.id))
          .where(eq(chat.userId, id))
          .orderBy(asc(stream.createdAt), asc(stream.id))
          .limit(DATA_ERASURE_BATCH_SIZE);
        const streamIds = selectedStreams.map(({ id: streamId }) => streamId);

        if (streamIds.length > 0) {
          await transaction.delete(stream).where(inArray(stream.id, streamIds));
        }

        if (streamIds.length === DATA_ERASURE_BATCH_SIZE) {
          return { complete: false };
        }

        const selectedChats = await transaction
          .select({ id: chat.id })
          .from(chat)
          .where(eq(chat.userId, id))
          .orderBy(asc(chat.createdAt), asc(chat.id))
          .limit(DATA_ERASURE_BATCH_SIZE);
        const chatIds = selectedChats.map(({ id: chatId }) => chatId);

        if (chatIds.length > 0) {
          await transaction.delete(chat).where(inArray(chat.id, chatIds));
        }

        const selectedDocumentOwners = await transaction
          .select({ id: documentOwner.id })
          .from(documentOwner)
          .where(eq(documentOwner.userId, id))
          .orderBy(asc(documentOwner.id))
          .limit(DATA_ERASURE_BATCH_SIZE);
        const documentIds = selectedDocumentOwners.map(
          ({ id: documentId }) => documentId
        );

        if (documentIds.length > 0) {
          await transaction
            .delete(documentOwner)
            .where(inArray(documentOwner.id, documentIds));
        }

        const [remainingChat] = await transaction
          .select({ id: chat.id })
          .from(chat)
          .where(eq(chat.userId, id))
          .limit(1);
        const [remainingDocumentOwner] = await transaction
          .select({ id: documentOwner.id })
          .from(documentOwner)
          .where(eq(documentOwner.userId, id))
          .limit(1);

        if (!(remainingChat || remainingDocumentOwner)) {
          const [deletedUser] = await transaction
            .delete(user)
            .where(and(eq(user.id, id), isNotNull(user.deletingAt)))
            .returning({ id: user.id });

          if (deletedUser && blobUrls.length > 0) {
            await transaction
              .insert(blobDeletion)
              .values({ urls: blobUrls, userId: id });
          }

          return { complete: Boolean(deletedUser) };
        }

        return { complete: false };
      }

      return { complete: true };
    });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function markUserForDeletion({ id }: { id: string }) {
  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${id}::text, 0))`
      );
      const [markedUser] = await transaction
        .update(user)
        .set({ deletingAt: new Date() })
        .where(and(eq(user.id, id), isNull(user.deletingAt)))
        .returning({ id: user.id });

      return markedUser;
    });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function queueBlobDeletion({
  readyAt,
  urls,
  userId,
}: {
  readyAt?: Date;
  urls: string[];
  userId: string;
}) {
  try {
    return await db
      .insert(blobDeletion)
      .values({ readyAt, urls, userId })
      .returning({ id: blobDeletion.id });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function completeBlobUpload({
  chatDeletionGeneration,
  expectedReadyAt,
  id,
  url,
  userId,
}: {
  chatDeletionGeneration: number;
  expectedReadyAt: Date;
  id: string;
  url: string;
  userId: string;
}) {
  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 0))`
      );
      const [updatedIntent] = await transaction
        .update(blobDeletion)
        .set({ readyAt: new Date(), urls: [url] })
        .where(
          and(
            eq(blobDeletion.id, id),
            eq(blobDeletion.userId, userId),
            eq(blobDeletion.readyAt, expectedReadyAt),
            isNull(blobDeletion.claimedAt)
          )
        )
        .returning({ id: blobDeletion.id });
      const [writableUser] = updatedIntent
        ? await transaction
            .select({ id: user.id })
            .from(user)
            .where(
              and(
                eq(user.id, userId),
                eq(user.chatDeletionGeneration, chatDeletionGeneration),
                isNull(user.deletingAt),
                isNull(user.chatsDeletingAt)
              )
            )
        : [];

      if (writableUser) {
        await transaction
          .delete(blobDeletion)
          .where(eq(blobDeletion.id, updatedIntent.id));
      }

      return Boolean(writableUser);
    });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getPendingBlobDeletions({
  userId,
}: {
  userId?: string;
} = {}) {
  try {
    const ready = lte(blobDeletion.readyAt, new Date());

    return await db
      .select()
      .from(blobDeletion)
      .where(userId ? and(eq(blobDeletion.userId, userId), ready) : ready)
      .orderBy(asc(blobDeletion.createdAt))
      .limit(100);
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function deferPendingBlobDeletion({
  claimToken,
  id,
  userId,
}: {
  claimToken: string | null;
  id: string;
  userId: string;
}) {
  try {
    return await db
      .update(blobDeletion)
      .set({ readyAt: new Date(Date.now() + DATA_ERASURE_RETRY_MS) })
      .where(
        and(
          eq(blobDeletion.id, id),
          eq(blobDeletion.userId, userId),
          claimToken
            ? eq(blobDeletion.claimToken, claimToken)
            : and(
                isNull(blobDeletion.claimToken),
                lte(blobDeletion.readyAt, new Date())
              )
        )
      );
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

const BLOB_DELETION_LEASE_MS = 5 * 60 * 1000;
const UNRESOLVED_BLOB_RETRY_MS = 15 * 60 * 1000;

export async function claimPendingBlobDeletion({
  id,
  remainingIdentifiers = [],
  resolvedIdentifiers,
  userId,
}: {
  id: string;
  remainingIdentifiers?: string[];
  resolvedIdentifiers: {
    continuation: boolean;
    identifier: string;
    url: string | null;
  }[];
  userId: string;
}) {
  try {
    const claimToken = generateUUID();

    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 0))`
      );
      const [pendingDeletion] = await transaction
        .select({ id: blobDeletion.id })
        .from(blobDeletion)
        .where(
          and(
            eq(blobDeletion.id, id),
            eq(blobDeletion.userId, userId),
            lte(blobDeletion.readyAt, new Date())
          )
        );

      if (pendingDeletion) {
        const messageRows = await transaction
          .select({
            attachments: message.attachments,
            parts: message.parts,
          })
          .from(message)
          .innerJoin(chat, eq(message.chatId, chat.id))
          .where(eq(chat.userId, userId));
        const referencedUrls = new Set(
          messageRows.flatMap(({ attachments, parts }) =>
            extractMessageAttachmentUrls(attachments, parts)
          )
        );
        const deletableUrls = resolvedIdentifiers.flatMap(({ url }) =>
          url && !referencedUrls.has(url) ? [url] : []
        );
        const deletableIdentifiers = resolvedIdentifiers.flatMap(
          ({ identifier, url }) =>
            url && !referencedUrls.has(url) ? [identifier] : []
        );
        const unresolvedIdentifiers = resolvedIdentifiers.flatMap(
          ({ continuation, identifier, url }) =>
            url || continuation ? [] : [identifier]
        );
        const continuationIdentifiers = resolvedIdentifiers.flatMap(
          ({ continuation, identifier }) => (continuation ? [identifier] : [])
        );
        const claimedIdentifiers = [
          ...new Set([
            ...deletableIdentifiers,
            ...unresolvedIdentifiers,
            ...continuationIdentifiers,
            ...remainingIdentifiers,
          ]),
        ];

        if (claimedIdentifiers.length > 0) {
          await transaction
            .update(blobDeletion)
            .set({
              claimedAt: new Date(),
              claimToken,
              readyAt: new Date(Date.now() + BLOB_DELETION_LEASE_MS),
              urls: claimedIdentifiers,
            })
            .where(
              and(
                eq(blobDeletion.id, id),
                eq(blobDeletion.userId, userId),
                lte(blobDeletion.readyAt, new Date())
              )
            );
        } else {
          await transaction
            .delete(blobDeletion)
            .where(
              and(
                eq(blobDeletion.id, id),
                eq(blobDeletion.userId, userId),
                lte(blobDeletion.readyAt, new Date())
              )
            );
        }

        return {
          claimToken: claimedIdentifiers.length > 0 ? claimToken : null,
          continuationIdentifiers,
          deletableUrls,
          unresolvedIdentifiers,
        };
      }

      return null;
    });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function completePendingBlobDeletion({
  claimToken,
  continuationCursor = null,
  continuationIdentifiers,
  id,
  remainingIdentifiers = [],
  unresolvedIdentifiers,
  userId,
}: {
  claimToken: string;
  continuationCursor?: string | null;
  continuationIdentifiers: string[];
  id: string;
  remainingIdentifiers?: string[];
  unresolvedIdentifiers: string[];
  userId: string;
}) {
  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 0))`
      );
      const [pendingDeletion] = await transaction
        .select({ attempts: blobDeletion.attempts })
        .from(blobDeletion)
        .where(
          and(
            eq(blobDeletion.id, id),
            eq(blobDeletion.userId, userId),
            eq(blobDeletion.claimToken, claimToken)
          )
        );

      if (pendingDeletion) {
        const attempts =
          unresolvedIdentifiers.length > 0 ? pendingDeletion.attempts + 1 : 0;
        const exhausted = attempts >= MAX_UNRESOLVED_BLOB_ATTEMPTS;
        const persistedIdentifiers = exhausted
          ? [...continuationIdentifiers, ...remainingIdentifiers]
          : [
              ...continuationIdentifiers,
              ...remainingIdentifiers,
              ...unresolvedIdentifiers,
            ];

        if (persistedIdentifiers.length > 0) {
          return await transaction
            .update(blobDeletion)
            .set({
              attempts: exhausted ? 0 : attempts,
              claimedAt: null,
              claimToken: null,
              cursor:
                continuationIdentifiers.length > 0 ? continuationCursor : null,
              readyAt: new Date(Date.now() + UNRESOLVED_BLOB_RETRY_MS),
              urls: persistedIdentifiers,
            })
            .where(
              and(
                eq(blobDeletion.id, id),
                eq(blobDeletion.userId, userId),
                eq(blobDeletion.claimToken, claimToken)
              )
            );
        }

        return await transaction
          .delete(blobDeletion)
          .where(
            and(
              eq(blobDeletion.id, id),
              eq(blobDeletion.userId, userId),
              eq(blobDeletion.claimToken, claimToken)
            )
          );
      }

      return [];
    });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function deletePendingBlobDeletion({ id }: { id: string }) {
  try {
    return await db.delete(blobDeletion).where(eq(blobDeletion.id, id));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function updateChatVisibilityById({
  chatId,
  userId,
  visibility,
}: {
  chatId: string;
  userId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}::text, 0))`
      );
      const [writableUser] = await transaction
        .select({ id: user.id })
        .from(user)
        .where(
          and(
            eq(user.id, userId),
            isNull(user.deletingAt),
            isNull(user.chatsDeletingAt)
          )
        );

      if (writableUser) {
        return await transaction
          .update(chat)
          .set({ visibility })
          .where(
            and(
              eq(chat.id, chatId),
              eq(chat.userId, userId),
              isNull(chat.deletingAt)
            )
          )
          .returning({ id: chat.id });
      }

      return [];
    });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
  } catch {
    // Best effort title update.
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const cutoffTime = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, cutoffTime),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ chatId, createdAt: new Date(), id: streamId });
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}
