# Production Deployment Runbook

This runbook explains the minimum steps required to deploy this application safely for a first public launch.

## 1. Choose the deployment shape

- Use a single Linux VM with Docker Compose for the first production deployment.
- Put TLS at a reverse proxy or load balancer in front of the app.
- Use managed MongoDB if possible. If self-hosting MongoDB, require authentication.

## 2. Prepare required configuration

Create a real `.env` file from `.env.example` and set production values for every required secret.

### Required secrets

Generate these values before starting the app:

- `CREDS_KEY` using `openssl rand -hex 32`
- `CREDS_IV` using `openssl rand -hex 16`
- `JWT_SECRET` using `openssl rand -hex 32`
- `JWT_REFRESH_SECRET` using `openssl rand -hex 32`
- `MEILI_MASTER_KEY` using `openssl rand -hex 32` when `SEARCH=true`

### Required URLs

Set the public URLs that users and browsers will use:

- `DOMAIN_CLIENT=https://your-chat-domain.example`
- `DOMAIN_SERVER=https://your-chat-domain.example`

### Browser access control

Set `CORS_ALLOWED_ORIGINS` to the exact browser origins allowed to call the API.

Example:

```env
CORS_ALLOWED_ORIGINS=https://your-chat-domain.example
```

### Migration enforcement

Set this to block production startup if permission migrations are still pending:

```env
REQUIRE_PERMISSION_MIGRATIONS=true
```

## 3. Configure data services safely

### MongoDB

- Do not run MongoDB with `--noauth` in production.
- Use a MongoDB URI with credentials.
- If you use the included Compose stack, set:
  - `MONGO_ROOT_USERNAME`
  - `MONGO_ROOT_PASSWORD`
  - `MONGO_URI=mongodb://<user>:<password>@mongodb:27017/LibreChat?authSource=admin`
- Store backups outside the VM.

### Meilisearch

- Only enable search if you intend to operate Meilisearch.
- Set a strong `MEILI_MASTER_KEY`.
- Do not expose Meilisearch publicly unless you intend to manage that separately.

### RAG / pgvector

- Only enable the RAG API if you need file and retrieval features.
- Set strong values for `RAG_POSTGRES_DB`, `RAG_POSTGRES_USER`, and `RAG_POSTGRES_PASSWORD`.
- Back up the pgvector volume if RAG features are part of the product launch.

### Redis

- Optional for a single-instance launch.
- Required if you intend to rely on shared stream state across multiple instances.

## 4. Build and deploy images

- Build your own application image from this repository.
- Push the image to your own container registry.
- Update deployment manifests to reference your image.

If using the included Compose deployment:

- Review `deploy-compose.yml`
- Confirm all env substitutions resolve to production values
- Confirm mounted volumes exist and are persisted

## 5. Run required migrations

Before putting the app behind public traffic, run:

```bash
npm run migrate:agent-permissions
npm run migrate:prompt-permissions
```

If `REQUIRE_PERMISSION_MIGRATIONS=true`, production startup will fail until these migrations are complete.

## 6. Start the stack

Start the deployed stack:

```bash
npm run start:deployed
```

## 7. Verify health before exposing traffic

Check the structured health endpoint:

```bash
curl http://localhost:3080/health
```

Expected behavior:

- HTTP `200` only when all required dependencies are healthy
- HTTP `503` when a required dependency is unhealthy
- Response body includes dependency-level status for:
  - MongoDB
  - Meilisearch
  - RAG API
  - Redis

## 8. Smoke test critical flows

Verify these flows before launch:

- User login
- User registration if enabled
- Sending a message
- Search if enabled
- File upload if enabled
- Any configured OAuth provider

## 9. Rollback basics

Before each deploy:

- Keep the previous image tag available
- Back up MongoDB
- Back up Meilisearch data if search matters for launch
- Back up uploads and pgvector volumes if those features are enabled

If a deploy fails:

- Roll back to the previous application image
- Restore the previous env file if secrets or URLs changed
- Restore database snapshots only if a data migration changed state in a non-reversible way

## 10. Operator notes

- Production startup now fails if critical secrets are missing or still set to known defaults.
- Production startup can fail if required permission migrations are still pending.
- CORS now defaults to `DOMAIN_CLIENT` when `CORS_ALLOWED_ORIGINS` is not explicitly set.
- Local development still allows localhost-style origins when not running in production.
