# Bizu Chat — Master Launch Plan

> **For agentic workers:** This is a MASTER plan. It defines sequencing, shared
> contracts, and global constraints. It does NOT contain task-level steps —
> each phase links to its own detailed plan. Generate and execute those
> individually via `superpowers:subagent-driven-development`.

**Goal:** Take Bizu from a rebranded Vercel AI Chatbot template to LIVE at
bizu.chat — ChatGPT text parity (folders, memory, search, history), Chinese
models via Vercel AI Gateway, and a Stripe card paywall billing in BRL.

**Architecture:** Next.js 16 App Router on Vercel. Neon Postgres via Drizzle.
Auth.js v5 with JWT sessions and auto-provisioned guest users. All inference
through Vercel AI Gateway (`gateway.languageModel(id)`), zero markup, five
Chinese models. Stripe Checkout (hosted) for subscriptions; a webhook is the
single source of truth for plan state, written to `user.plan`. Entitlements
are enforced server-side in `app/(chat)/api/chat/route.ts` — never trusted
from the client.

**Tech Stack:** Next 16.2.10 · React 19.2.7 · AI SDK 7.0.15 · next-auth
5.0.0-beta.25 · drizzle-orm 0.45.2 · postgres.js · Vercel Blob · Redis ·
Stripe · Tailwind 4 · Biome/ultracite · Playwright · pnpm 10.32.1

---

## Decisions (locked 2026-07-14)

| Decision | Choice |
|---|---|
| Launch scope | **Full parity, then launch.** Folders + memory + search + settings ship before going live. |
| Billing entity | **Brazilian CNPJ/CPF.** Charge BRL directly via Stripe Brazil. |
| Paywall unlocks | **Premium models + higher limits.** |
| Checkout | **Card-only via Stripe Checkout.** Pix deferred to post-launch. |

**Why Pix is deferred:** Pix Automático forces a mandatory 3-day pre-debit
notification before every recurring charge (PaymentIntent sits in `processing`
3–7 days), start dates must be ≥3 days out, and Stripe documents no Checkout
support — it needs custom PaymentIntents. Card gives instant activation for a
fraction of the work. Revisit once paid conversion is proven; Pix is the single
biggest Brazilian conversion unlock and this is a *sequencing* call, not a
rejection.

---

## Global Constraints

Every task in every sub-plan inherits these.

- **Package manager is `pnpm` (10.32.1).** Never `npm` or `yarn`.
- **All user-facing copy is pt-BR**, and must live in `lib/i18n/messages.ts` —
  never inline in a component. This is the single source of truth; the catalog
  is a flat `as const` object with no locale routing.
- **Never rename a model with a brand name.** Display the real model name
  (e.g. "DeepSeek V4 Flash"). Users must know exactly which model they use.
- **No Vercel/Next.js/template branding may reach a user** — no `VercelIcon`
  in user-facing chrome, no template art, no "Deploy with Vercel".
- **Entitlements are enforced server-side only.** The client may *reflect*
  plan state for UI, never *decide* it.
- **Rate limiting and env validation must fail CLOSED**, never open.
- **`lib/db/schema.ts` is the only schema source.** Every change ships with a
  generated migration; never hand-edit generated SQL.
- **Lint gate:** `pnpm check` (ultracite) must pass before every commit.
- **Directives first:** `"use client"` must precede all imports. A directive
  after an import is a build-breaking error (this already broke the build once
  — commit `4f752cddf`).
- **Money is integer cents in BRL.** Never floats.
- **Secrets never enter the repo or a client bundle.** Only `NEXT_PUBLIC_*` is
  client-visible.

---

## Verified Baseline (as of `035a0c8d7`, 2026-07-14)

Established by direct inspection — do not re-litigate:

**Works:** chat history (list/delete, cursor-paginated), sharing + visibility
(403-enforced in `api/messages/route.ts`), voting, message editing, artifacts
(text/code/sheet).

**Absent entirely (greenfield — zero grep hits):** folders, memory, search,
settings page.

**Broken / notable:**
- `lib/ai/entitlements.ts` — `guest: 10` and `regular: 10`. Registering earns
  zero extra quota. Upstream ships 20/100.
- `/rename` slash command toasts *"Renomear está disponível no menu do chat na
  barra lateral"* — that menu item **does not exist**. Backend
  `updateChatTitleById` (`lib/db/queries.ts:517`) exists; only the AI
  auto-titler calls it.
- Regenerate has no UI. `regenerate` is threaded into `components/chat/message.tsx:92`
  but destructured as `regenerate: _regenerate` — deliberately unused.
- `lib/ratelimit.ts:28-30` **fails open** — no `REDIS_URL` means no rate
  limiting at all. `proxy.ts` auto-provisions guests → unauthenticated,
  unmetered `/api/chat` on your AI Gateway bill. `client.connect()` (line 15)
  is not awaited, leaking requests even when configured.
- `lib/db/migrate.ts:11-14` — `process.exit(0)` when `POSTGRES_URL` is unset.
  `pnpm build` deploys **green with no database**.
- `app/(chat)/api/files/upload/route.ts` — `access: "public"` with no
  `addRandomSuffix`. Two users uploading `foto.png` collide; one silently
  overwrites the other. Every upload sits at a guessable public URL. **LGPD
  exposure.**
- `createGuestUser` (`lib/db/queries.ts:59`) uses `email: guest-${Date.now()}`
  — not collision-safe, and `User.email` has no unique constraint.
- `components/chat/chat-header.tsx:53-65` — **"Deploy with Vercel" button, live
  on the main chat screen** via `shell.tsx:122`.
- `app/(chat)/opengraph-image.png` + `twitter-image.png` — Vercel stock art
  reading "AI Chatbot Starter Template".
- `ui.brand.privacyUrl` / `termsUrl` → `/privacidade`, `/termos`. **Neither
  route exists.** Both 404 from the signup page.
- `lib/constants.ts:15-20` — starter prompts are Vercel's ("Quais as vantagens
  de usar Next.js?").
- `lib/ai/models.ts` — `gatewayOrder` names non-serving providers on 3 of 5
  models. `bedrock` is listed **first on the default model** and does not serve
  it. Falls through to a valid route, so it works, but the preference is fiction.
- `app/(chat)/api/chat/route.ts:398,401` + `components/chat/shell.tsx:199-210`
  — English error strings, despite `ui.errors.activateGateway` and
  `ui.errors.generic` already existing and being translated.
- Artifacts layer (`artifacts/*/client.tsx`, `components/chat/toolbar.tsx`) is
  fully untranslated — including prompt bodies sent to the model.
- `artifacts/image/` has `client.tsx` but **no `server.ts`**. The DB enum and
  document route still accept `kind: "image"`, which would throw at runtime.
- **Migration baseline has no `meta/0000_snapshot.json`** — only `_journal.json`.
  `drizzle-kit generate` will not diff correctly. **This blocks all schema work.**
- `.env` is 100% orphaned LibreChat vars (55 of them, zero used by current
  code) and is missing all 5 the app needs. Holds **live** OpenRouter + SMTP +
  JWT secrets.
- Untracked, **un-gitignored** LibreChat debris on disk: `api/`, `client/`,
  `data/`, `logs/`. A `git add -A` would commit server logs.
- `app/(chat)/page.tsx` and `chat/[id]/page.tsx` both `return null` —
  intentional client-side SPA shell. Consequence: **no SSR and no OG tags on
  chat pages**, so share links unfurl blank.

---

## Shared Contract: Schema Additions

Locked here so sub-plans agree on names and types. All go in
`lib/db/schema.ts`. **Phase 0 must regenerate the snapshot first.**

```ts
// user — extend existing table
plan:                 varchar("plan", { enum: ["free", "premium"] }).notNull().default("free"),
stripeCustomerId:     text("stripeCustomerId"),
stripeSubscriptionId: text("stripeSubscriptionId"),
subscriptionStatus:   varchar("subscriptionStatus", {
                        enum: ["active","past_due","canceled","incomplete","trialing"],
                      }),
currentPeriodEnd:     timestamp("currentPeriodEnd"),

// folder — new
id:        uuid("id").primaryKey().defaultRandom(),
userId:    uuid("userId").notNull().references(() => user.id),
name:      text("name").notNull(),
position:  integer("position").notNull().default(0),
createdAt: timestamp("createdAt").notNull().defaultNow(),

// chat — extend existing table
folderId:  uuid("folderId").references(() => folder.id, { onDelete: "set null" }),
updatedAt: timestamp("updatedAt").notNull().defaultNow(),

// memory — new
id:        uuid("id").primaryKey().defaultRandom(),
userId:    uuid("userId").notNull().references(() => user.id),
content:   text("content").notNull(),
sourceChatId: uuid("sourceChatId").references(() => chat.id, { onDelete: "set null" }),
createdAt: timestamp("createdAt").notNull().defaultNow(),
updatedAt: timestamp("updatedAt").notNull().defaultNow(),

// userSettings — new (1:1 with user)
userId:         uuid("userId").primaryKey().references(() => user.id),
memoryEnabled:  boolean("memoryEnabled").notNull().default(true),
customInstructions: text("customInstructions"),
updatedAt:      timestamp("updatedAt").notNull().defaultNow(),
```

**Also required, and easy to miss:**
- `user.email` needs a **unique constraint** (guest collision bug).
- `message.parts` is `json`, which **cannot be GIN-indexed**. Search (Phase 4)
  requires migrating it to `jsonb`. Plan for a backfill on existing rows.
- Deleting a folder must **not** delete its chats — `onDelete: "set null"`.

---

## Plan Ladder (locked)

| | Free | Premium |
|---|---|---|
| Price | R$0 | **R$20/mês (BRL, 2000 cents)** |
| Models | DeepSeek V4 Flash, Qwen 3.5 Flash | **all five** (+ DeepSeek V3.2, Kimi K2.5, Qwen 3.6 Plus) |
| Messages/hour | 20 | 200 |
| Folders / memory / search | yes | yes |

Guests stay at 10/hour. **Fixing `regular` from 10 → 20 is what makes signup
mean anything**, and the free→premium gap is what makes the paywall mean
anything. Both numbers live in `lib/ai/entitlements.ts`.

Margin sanity: DeepSeek V3.2 runs ~$0.14–0.28 per 1M input tokens and AI
Gateway takes **zero markup**. R$20 ≈ $3.60. A premium user would need
~10M+ output tokens/month to threaten margin — far beyond 200 msg/hour of
realistic chat. **The unit economics hold.**

---

## Phases

Strictly ordered. Each produces working, testable software. **Do not start a
phase before its predecessor is green.**

### Phase 0 — Foundation & Hygiene → `2026-07-14-phase-0-foundation.md`
**Blocks literally everything.**
- Regenerate `meta/0000_snapshot.json` so `drizzle-kit generate` diffs. *(Hard
  blocker on Phases 2–5.)*
- Delete untracked `api/`, `client/`, `data/`, `logs/`; add to `.gitignore`.
- **Rotate the live OpenRouter key and SMTP credentials** in the orphaned
  `.env`, then delete the file. Adopt `vercel env pull`.
- Fix `lib/ratelimit.ts` to **fail closed**; await `connect()`.
- Fix `lib/db/migrate.ts` to `exit(1)` when `POSTGRES_URL` is unset.
- Fix blob upload: `addRandomSuffix: true`, namespace per user, add `accept`
  to the file input.
- Add unique constraint on `user.email`; make `createGuestUser` collision-safe
  (UUID, not `Date.now()`).
- Add `tsc --noEmit` + `next build` to CI (neither runs today).

### Phase 1 — De-Vercel Branding & Legal → `2026-07-14-phase-1-branding.md`
**Everything here is visible to users or is a legal surface.**
- Remove the "Deploy with Vercel" button and both `VercelIcon` usages from
  `chat-header.tsx`; remove `VercelIcon` from `(auth)/layout.tsx`.
- Replace `opengraph-image.png`, `twitter-image.png`, `favicon.ico`,
  `public/preview.png`. Add a Bizu logo (`app-sidebar.tsx:98` is a generic
  lucide icon).
- **Build `/privacidade` and `/termos` routes** — currently 404 from signup.
  LGPD-compliant, pt-BR.
- Rewrite starter prompts in `lib/constants.ts` for a Brazilian consumer
  audience.
- Route English strings in `api/chat/route.ts:398,401` and `shell.tsx:199-210`
  through the existing `ui.errors.*` catalog entries.
- Translate the artifacts layer + `toolbar.tsx`, **including the prompt bodies
  sent to the model** (they currently instruct in English).
- Fix `gatewayOrder` on the 3 models naming non-serving providers.
- Delete dead `artifacts/image/` or implement its `server.ts`; drop `"image"`
  from the document route's zod schema either way.

### Phase 2 — Parity: Cheap Wins & Settings → `2026-07-14-phase-2-settings.md`
- **Rename**: add `PATCH /api/chat/[id]`, wire a sidebar menu item, make
  `/rename` stop lying.
- **Regenerate**: un-disable `_regenerate`, add the button.
- **Settings page** + `userSettings` table. Home for memory/instructions
  toggles; prerequisite for Phase 3.

### Phase 3 — Parity: Memory → `2026-07-14-phase-3-memory.md`
- `memory` table, CRUD, retrieval, injection into `lib/ai/prompts.ts` (today
  fully static).
- A tool for the model to write memories; settings UI to view/delete/disable.
- **LGPD: memory is personal data.** Users must be able to see and erase all
  of it.

### Phase 4 — Parity: Folders & Search → `2026-07-14-phase-4-folders-search.md`
- `folder` table + `chat.folderId`; sidebar tree; move/create/rename/delete.
  Deleting a folder must not delete chats.
- Search: migrate `message.parts` **`json` → `jsonb`** + GIN index, backfill,
  search endpoint, sidebar UI.

### Phase 5 — Paywall → `2026-07-14-phase-5-paywall.md`
- Plan fields on `user`; real tiers in `entitlements.ts` (fix 10/10).
- Per-model gating server-side in `api/chat/route.ts`; upgrade prompt UI.
- Stripe Checkout (BRL), webhook as **single source of truth** for plan state.
- Webhook must verify the signature against the **raw body** and be
  **idempotent** (Stripe retries; duplicate events must not double-grant).
- Billing page; cancel/manage via Stripe Customer Portal.
- Handle `past_due` / `canceled` → downgrade to free.

### Phase 6 — Launch → `2026-07-14-phase-6-launch.md`
- Re-implement env validation **fail-closed at boot** (the ~750-line PR #24
  audit was wiped by PR #25; recoverable only from tag
  `archive/librechat-pre-vercel-restart`).
- Provision Neon + Redis + Blob. **Note:** `vercel-template.json` provisions
  Upstash **KV**, but the code needs a Redis-protocol `REDIS_URL` — not the
  REST/KV credentials.
- Create the Vercel project (none exists), attach `bizu.chat`, verify Actions
  secrets aren't stale LibreChat values.
- Stripe live mode + webhook endpoint + BRL product.
- End-to-end smoke: register → free limits → hit paywall → checkout → premium
  unlocked → cancel → downgrade.

---

## Risks

1. **Brazilian entity verification is the long pole and is not code.** Stripe
   BRL payouts need a CNPJ/CPF whose tax ID **matches the bank account**, plus
   UBO verification. A mismatch fails payouts silently. **Start this on day 1,
   in parallel** — Phases 0–4 don't depend on it; only Phase 5's live mode does.
2. **Fail-open rate limiting is a live cost exposure.** Until Phase 0 lands,
   any deploy without `REDIS_URL` is an open, unmetered `/api/chat` on your
   Gateway bill. Do not deploy publicly before Phase 0.
3. **Bleeding-edge Next 16.** `cacheComponents` + `reactCompiler` + 5
   experimental flags, and CI never runs `next build` — breakage surfaces first
   on Vercel. Phase 0 adds the build to CI.
4. **The SPA shell blocks OG tags on chat pages.** Share links unfurl blank and
   `generateMetadata` can't be added without undoing the shell. Accepted for
   launch; revisit if sharing drives growth.
5. **`json` → `jsonb` migration touches every message row.** Needs a backfill
   and a maintenance window once there's real data. Cheapest **now**, while the
   table is empty — a reason not to defer Phase 4.
6. **Model IDs drift.** All five verified live today, but `README.md:16-24`
   already disagrees with `lib/ai/models.ts`. Keep one source of truth.

---

## Sub-Plan Index

| Phase | File | Depends on |
|---|---|---|
| 0 | `2026-07-14-phase-0-foundation.md` | — |
| 1 | `2026-07-14-phase-1-branding.md` | 0 |
| 2 | `2026-07-14-phase-2-settings.md` | 0 |
| 3 | `2026-07-14-phase-3-memory.md` | 0, 2 |
| 4 | `2026-07-14-phase-4-folders-search.md` | 0 |
| 5 | `2026-07-14-phase-5-paywall.md` | 0, 2 |
| 6 | `2026-07-14-phase-6-launch.md` | all |

Phases 1, 2, and 4 are mutually independent once 0 is green and can run in
parallel. Phase 5's *code* only needs 0 and 2; its *go-live* needs the entity.
