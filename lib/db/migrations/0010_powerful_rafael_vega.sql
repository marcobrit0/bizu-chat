SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
SET LOCAL statement_timeout = '30s';
--> statement-breakpoint
CREATE INDEX "Suggestion_userId_idx" ON "Suggestion" USING btree ("userId");
