# Bizu Chat: Migration from Fork to Vanilla LibreChat + Customizations

## Current State Summary

The current fork has:
- **`@bizu/` package renames** across ~200+ files (biggest merge pain source)
- **`bizu.example.yaml`** — full LibreChat YAML config (models, UI toggles, balance, terms)
- **`planModels.js` / `planModels.ts`** — free/premium/pro model gating (4 files)
- **`validateModel.js`** — modified to check plan-based access
- **Branding** — favicon/logo assets, APP_TITLE, custom `.env.example`
- **UI tweaks** — removed endpoint icons, quotes from chat list, etc.
- **No Stripe yet** — plan field exists in middleware but no payment flow

---

## Phase 0: Checkpoint (Before Anything)

1. Tag current state: `git tag v0.8.1-fork-checkpoint`
2. Push tag: `git push origin v0.8.1-fork-checkpoint`
3. This preserves the entire fork so you can always come back

---

## Phase 1: Fresh Vanilla Setup

1. Clone latest LibreChat release into a new repo (or reset `main` to upstream)
2. Verify it runs out of the box with `npm install && npm run backend`
3. Set up `.env` with your existing values:
   - `MONGO_URI`, `OPENROUTER_KEY`, `CREDS_KEY`, `CREDS_IV`
   - `APP_TITLE=Bizu`
   - `CUSTOM_FOOTER=Bizu Chat`

---

## Phase 2: Configuration (Zero Code Changes)

1. Copy `bizu.example.yaml` → `librechat.yaml` (LibreChat's native config file)
   - All your model specs, endpoint config, balance settings, UI toggles, terms/privacy — this all works natively in vanilla LibreChat via `librechat.yaml`
   - The `interface` block disabling agents, presets, prompts, bookmarks, etc. is a **built-in LibreChat feature** — no fork needed
2. Replace logo/favicon files in `client/public/assets/`
3. Set default language to PT-BR — one line change in the i18n config file

**Files touched: ~4 (config + assets). No package renames. No import changes.**

---

## Phase 3: Plan-Based Model Gating (New Files Only)

These are your custom Bizu files that don't exist in upstream LibreChat:

1. **`api/server/services/Config/planModels.js`** — copy as-is (new file)
2. **`client/src/utils/planModels.ts`** — copy as-is (new file)
3. **`api/server/middleware/validateModel.js`** — the only upstream file that needs modification: add 6 lines for plan check at the bottom of the existing function
4. **`client/src/components/Chat/Menus/Endpoints/selection.ts`** — minor edit to filter models by plan on the frontend

**Total upstream files modified: 2 (small additions). New files: 2.**

---

## Phase 4: Stripe Integration (All New Files)

This is the payment system. Everything here is additive:

### Backend (new files)
1. **`api/server/routes/stripe.js`** — webhook endpoint + checkout session creation
2. **`api/server/services/Stripe/`** — Stripe service logic (create customer, handle webhook events, update user plan)
3. **User model extension** — add `plan`, `stripeCustomerId`, `subscriptionId` fields to the User schema (small addition to existing schema file)
4. **Register route** — one line in `api/server/routes/index.js`

### Frontend (new files)
5. **`client/src/components/Billing/`** — pricing page, plan selection, checkout redirect
6. **`client/src/components/Billing/UpgradePrompt.tsx`** — shown when user tries to access premium model on free plan
7. **Route registration** — add billing page route in the React router config

### Config
8. **`.env` additions** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PREMIUM`

**Upstream files modified: ~3 (one-liners). New files: ~6-8.**

---

## Phase 5: Deploy & Test

1. Set up Stripe account + products/prices for Brazilian Real (BRL)
2. Configure webhook endpoint URL in Stripe dashboard
3. Test full flow: register → free models work → try premium model → upgrade prompt → Stripe checkout → plan upgraded → premium models work
4. Deploy to production

---

## Ongoing Maintenance

### Pulling upstream updates
```bash
git remote add upstream https://github.com/danny-avila/LibreChat.git
git fetch upstream
git merge upstream/main
```

**Expected conflicts: near-zero.** Your changes are:
- `librechat.yaml` — upstream doesn't ship one, no conflict
- `planModels.js`, `planModels.ts` — new files, no conflict
- `validateModel.js` — 6 added lines at end of function, rarely conflicts
- `stripe.js`, `Billing/` — new files, no conflict
- Asset files (logo/favicon) — upstream won't change your custom assets
- One i18n line — trivial if it ever conflicts

Compare this to the current fork which touches **200+ files** with the `@bizu/` rename alone.

---

## What You Lose (Nothing Important)

- The `@bizu/` package branding in `node_modules` — users never see this
- A few UI micro-tweaks (endpoint icon removal, quote removal from chat list) — these can be done via CSS overrides or `librechat.yaml` config if needed

## What You Gain

- Free upstream updates (new models, bug fixes, security patches, features)
- Dramatically simpler codebase to maintain
- Clear separation: LibreChat = platform, Bizu = config + payments
