ALTER TABLE "Suggestion" DROP CONSTRAINT "Suggestion_documentId_documentCreatedAt_Document_id_createdAt_fk";
--> statement-breakpoint
ALTER TABLE "Vote_v2" DROP CONSTRAINT "Vote_v2_chatId_Chat_id_fk";
--> statement-breakpoint
ALTER TABLE "Vote_v2" DROP CONSTRAINT "Vote_v2_messageId_Message_v2_id_fk";
--> statement-breakpoint
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_documentId_documentCreatedAt_userId_Document_id_createdAt_userId_fk" FOREIGN KEY ("documentId","documentCreatedAt","userId") REFERENCES "public"."Document"("id","createdAt","userId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_messageId_chatId_Message_v2_id_chatId_fk" FOREIGN KEY ("messageId","chatId") REFERENCES "public"."Message_v2"("id","chatId") ON DELETE cascade ON UPDATE no action;