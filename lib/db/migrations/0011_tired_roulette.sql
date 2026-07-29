SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
SET LOCAL statement_timeout = '30s';
--> statement-breakpoint
CREATE TABLE "DocumentOwner" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	CONSTRAINT "DocumentOwner_id_userId_unique" UNIQUE("id","userId")
);
--> statement-breakpoint
ALTER TABLE "BlobDeletion" ADD COLUMN "claimedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "DocumentOwner" ADD CONSTRAINT "DocumentOwner_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
LOCK TABLE "Document" IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
CREATE FUNCTION "public"."ensure_document_owner"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
	INSERT INTO "public"."DocumentOwner" ("id", "userId")
	VALUES (NEW."id", NEW."userId")
	ON CONFLICT ("id") DO NOTHING;

	RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER "Document_ensure_owner"
BEFORE INSERT ON "Document"
FOR EACH ROW
EXECUTE FUNCTION "public"."ensure_document_owner"();
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "Document"
		GROUP BY "id"
		HAVING count(DISTINCT "userId") > 1
	) THEN
		RAISE EXCEPTION 'Document ids with multiple owners require manual reconciliation';
	END IF;
END
$$;
--> statement-breakpoint
INSERT INTO "DocumentOwner" ("id", "userId")
SELECT DISTINCT ON ("id") "id", "userId"
FROM "Document"
ORDER BY "id", "createdAt";
--> statement-breakpoint
CREATE INDEX "DocumentOwner_userId_idx" ON "DocumentOwner" USING btree ("userId");--> statement-breakpoint
ALTER TABLE "Document" ADD CONSTRAINT "Document_id_userId_DocumentOwner_id_userId_fk" FOREIGN KEY ("id","userId") REFERENCES "public"."DocumentOwner"("id","userId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Vote_v2_messageId_chatId_idx" ON "Vote_v2" USING btree ("messageId","chatId");
