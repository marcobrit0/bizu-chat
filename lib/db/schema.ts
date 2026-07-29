import { type InferSelectModel, sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  chatDeletionGeneration: integer("chatDeletionGeneration")
    .notNull()
    .default(0),
  chatsDeletingAt: timestamp("chatsDeletingAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletingAt: timestamp("deletingAt", { withTimezone: true }),
  email: varchar("email", { length: 64 }).notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  image: text("image"),
  isAnonymous: boolean("isAnonymous").notNull().default(false),
  name: text("name"),
  password: varchar("password", { length: 64 }),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = InferSelectModel<typeof user>;

export const blobDeletion = pgTable(
  "BlobDeletion",
  {
    createdAt: timestamp("createdAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    readyAt: timestamp("readyAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
    urls: json("urls").$type<string[]>().notNull(),
    userId: uuid("userId").notNull(),
  },
  (table) => ({
    readyCreatedAtIdx: index("BlobDeletion_readyAt_createdAt_idx").on(
      table.readyAt,
      table.createdAt
    ),
    userCreatedAtIdx: index("BlobDeletion_userId_createdAt_idx").on(
      table.userId,
      table.createdAt
    ),
  })
);

export type BlobDeletion = InferSelectModel<typeof blobDeletion>;

export const chat = pgTable(
  "Chat",
  {
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
    deletingAt: timestamp("deletingAt", { withTimezone: true }),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    title: text("title").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    visibility: varchar("visibility", { enum: ["public", "private"] })
      .notNull()
      .default("private"),
  },
  (table) => ({
    historyIdx: index("Chat_userId_createdAt_id_idx").on(
      table.userId,
      table.createdAt.desc(),
      table.id.desc()
    ),
    visibilityCheck: check(
      "Chat_visibility_check",
      sql`${table.visibility} IN ('public', 'private')`
    ),
  })
);

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable(
  "Message_v2",
  {
    attachments: json("attachments").notNull(),
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    parts: json("parts").notNull(),
    role: varchar("role").notNull(),
  },
  (table) => ({
    chatCreatedAtIdx: index("Message_v2_chatId_createdAt_idx").on(
      table.chatId,
      table.createdAt
    ),
    chatMessageUnique: unique("Message_v2_id_chatId_unique").on(
      table.id,
      table.chatId
    ),
    roleCheck: check(
      "Message_v2_role_check",
      sql`${table.role} IN ('user', 'assistant', 'system')`
    ),
  })
);

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId").notNull(),
    isUpvoted: boolean("isUpvoted").notNull(),
    messageId: uuid("messageId").notNull(),
  },
  (table) => ({
    messageRef: foreignKey({
      columns: [table.messageId, table.chatId],
      foreignColumns: [message.id, message.chatId],
    }).onDelete("cascade"),
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    content: text("content"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
    id: uuid("id").notNull().defaultRandom(),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    title: text("title").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => ({
    kindCheck: check(
      "Document_kind_check",
      sql`${table.kind} IN ('text', 'code', 'image', 'sheet')`
    ),
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
    userDocumentUnique: unique("Document_id_createdAt_userId_unique").on(
      table.id,
      table.createdAt,
      table.userId
    ),
    userIdx: index("Document_userId_idx").on(table.userId),
  })
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
    description: text("description"),
    documentCreatedAt: timestamp("documentCreatedAt", {
      withTimezone: true,
    }).notNull(),
    documentId: uuid("documentId").notNull(),
    id: uuid("id").notNull().defaultRandom(),
    isResolved: boolean("isResolved").notNull().default(false),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => ({
    documentIdx: index("Suggestion_documentId_documentCreatedAt_userId_idx").on(
      table.documentId,
      table.documentCreatedAt,
      table.userId
    ),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt, table.userId],
      foreignColumns: [document.id, document.createdAt, document.userId],
    }).onDelete("cascade"),
    pk: primaryKey({ columns: [table.id] }),
    userIdx: index("Suggestion_userId_idx").on(table.userId),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
    id: uuid("id").notNull().defaultRandom(),
  },
  (table) => ({
    chatCreatedAtIdx: index("Stream_chatId_createdAt_idx").on(
      table.chatId,
      table.createdAt
    ),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }).onDelete("cascade"),
    pk: primaryKey({ columns: [table.id] }),
  })
);

export type Stream = InferSelectModel<typeof stream>;
