CREATE TABLE "BlobDeletion" (
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"urls" json NOT NULL,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
CREATE INDEX "BlobDeletion_userId_createdAt_idx" ON "BlobDeletion" USING btree ("userId","createdAt");