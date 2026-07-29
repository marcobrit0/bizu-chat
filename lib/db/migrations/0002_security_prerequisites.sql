ALTER TABLE "Chat" DROP CONSTRAINT "Chat_userId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Document" DROP CONSTRAINT "Document_userId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Message_v2" DROP CONSTRAINT "Message_v2_chatId_Chat_id_fk";
--> statement-breakpoint
ALTER TABLE "Stream" DROP CONSTRAINT "Stream_chatId_Chat_id_fk";
--> statement-breakpoint
ALTER TABLE "Suggestion" DROP CONSTRAINT "Suggestion_userId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Suggestion" DROP CONSTRAINT "Suggestion_documentId_documentCreatedAt_Document_id_createdAt_fk";
--> statement-breakpoint
ALTER TABLE "Vote_v2" DROP CONSTRAINT "Vote_v2_chatId_Chat_id_fk";
--> statement-breakpoint
ALTER TABLE "Vote_v2" DROP CONSTRAINT "Vote_v2_messageId_Message_v2_id_fk";
--> statement-breakpoint
SET statement_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "Chat" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Document" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Message_v2" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Stream" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Suggestion" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Suggestion" ALTER COLUMN "documentCreatedAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "createdAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
SET statement_timeout = DEFAULT;
--> statement-breakpoint
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_documentId_documentCreatedAt_Document_id_createdAt_fk" FOREIGN KEY ("documentId","documentCreatedAt") REFERENCES "public"."Document"("id","createdAt") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_messageId_Message_v2_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message_v2"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Chat_userId_createdAt_id_idx" ON "Chat" USING btree ("userId","createdAt" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "Document_userId_idx" ON "Document" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Message_v2_chatId_createdAt_idx" ON "Message_v2" USING btree ("chatId","createdAt");--> statement-breakpoint
CREATE INDEX "Stream_chatId_createdAt_idx" ON "Stream" USING btree ("chatId","createdAt");--> statement-breakpoint
CREATE INDEX "Suggestion_documentId_documentCreatedAt_userId_idx" ON "Suggestion" USING btree ("documentId","documentCreatedAt","userId");--> statement-breakpoint
ALTER TABLE "Document" ADD CONSTRAINT "Document_id_createdAt_userId_unique" UNIQUE("id","createdAt","userId");--> statement-breakpoint
ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_id_chatId_unique" UNIQUE("id","chatId");--> statement-breakpoint
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_visibility_check" CHECK ("Chat"."visibility" IN ('public', 'private'));--> statement-breakpoint
ALTER TABLE "Document" ADD CONSTRAINT "Document_kind_check" CHECK ("Document"."text" IN ('text', 'code', 'image', 'sheet'));--> statement-breakpoint
ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_role_check" CHECK ("Message_v2"."role" IN ('user', 'assistant', 'system'));
