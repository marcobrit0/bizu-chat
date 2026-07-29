SET lock_timeout = '5s';
SET statement_timeout = '30s';
SET TIME ZONE 'UTC';

DELETE FROM "Vote_v2" AS vote
WHERE NOT EXISTS (
  SELECT 1
  FROM "Message_v2" AS message
  WHERE message."id" = vote."messageId"
    AND message."chatId" = vote."chatId"
);

DELETE FROM "Suggestion" AS suggestion
WHERE NOT EXISTS (
  SELECT 1
  FROM "Document" AS document
  WHERE document."id" = suggestion."documentId"
    AND document."createdAt" = suggestion."documentCreatedAt"
    AND document."userId" = suggestion."userId"
);
