# Bizu

Chat GPT-style assistant for Brazil. Built on the [Vercel chatbot](https://github.com/vercel/chatbot) template, with a **Chinese-first** model catalog via [Vercel AI Gateway](https://vercel.com/ai-gateway) to keep inference cheap, and a full **Portuguese (pt-BR)** UI.

## Stack

- Next.js App Router + AI SDK
- Auth.js (email/password + guest)
- Neon Postgres (Drizzle)
- Vercel Blob (attachments)
- Redis (resumable streams)
- Vercel AI Gateway (models)

## Models (default picker)

| Model | ID | Role |
|-------|-----|------|
| DeepSeek V4 Flash | `deepseek/deepseek-v4-flash` | **Default** — daily driver |
| Qwen 3.5 Flash | `alibaba/qwen3.5-flash` | Fast alternate |
| DeepSeek V3.2 | `deepseek/deepseek-v3.2` | Mid-tier quality |
| Kimi K2.5 | `moonshotai/kimi-k2.5` | Long context |
| Qwen 3.6 Plus | `alibaba/qwen3.6-plus` | Stronger tasks |

Edit the list in [`lib/ai/models.ts`](lib/ai/models.ts). Any Gateway `creator/model` id works.

## Environment variables

Copy [`.env.example`](.env.example):

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | NextAuth secret (`openssl rand -base64 32`) |
| `AI_GATEWAY_API_KEY` | Required **off** Vercel; on Vercel, OIDC is automatic |
| `POSTGRES_URL` | Pooled Neon / Postgres runtime connection string |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob |
| `REDIS_URL` | Redis for resumable streams (optional locally) |

## Local setup

```bash
# Install deps
pnpm install

# Link Vercel project and pull env (recommended)
npm i -g vercel
vercel link
vercel env pull

# Migrate DB, then run
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Import this GitHub repo into a Vercel project.
2. Add Marketplace resources (Neon + Blob + Redis/Upstash) — see `vercel-template.json`.
3. Ensure AI Gateway is enabled for the team (add a card if prompted for free credits).
4. Deploy. Migrations run on `pnpm build`.

## Branding & locale

- Product name and copy live in [`lib/i18n/messages.ts`](lib/i18n/messages.ts)
- Assistant prompts (PT-BR) in [`lib/ai/prompts.ts`](lib/ai/prompts.ts)
- Privacy / terms: https://bizu.chat/privacidade · https://bizu.chat/termos

## Archive note

Previous LibreChat tree is tagged `archive/librechat-pre-vercel-restart` on this repo.
