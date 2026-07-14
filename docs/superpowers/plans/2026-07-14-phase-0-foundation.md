# Phase 0 — Foundation & Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repo safe to deploy and unblock all schema work — fail-closed
rate limiting and migrations, a collision-safe guest identity, private file
uploads, a regenerated Drizzle baseline, and a CI that actually builds.

**Architecture:** Nothing user-facing changes. Every fix converts a silent
failure into a loud one. The Drizzle baseline is regenerated from scratch rather
than patched — safe precisely because **no production database exists yet**
(verified: no Vercel project, nothing deployed). This is the last moment this is
free.

**Tech Stack:** Next 16.2.10 · drizzle-kit 0.31.10 · postgres.js · redis 6.1.0 ·
@vercel/blob 0.24.1 · next-auth 5.0.0-beta.25 · vitest (added here) · pnpm 10.32.1

**Master plan:** `2026-07-14-bizu-chat-launch.md`

## Global Constraints

Inherited from the master plan. Repeated here because they bite in this phase:

- **Package manager is `pnpm` (10.32.1).** Never `npm`/`yarn`.
- **Rate limiting and env validation must fail CLOSED**, never open.
- **`lib/db/schema.ts` is the only schema source.** Never hand-edit generated SQL.
- **Lint gate:** `pnpm check` must pass before every commit.
- **Directives first:** `"use client"` precedes all imports (this broke the build
  once already — `4f752cddf`).
- **Secrets never enter the repo or a client bundle.**

---

## Ordering (do not reorder)

Task 6 edits `lib/db/schema.ts`; Task 7 regenerates the migration baseline from
that schema. **Task 7 must run after Task 6** or the unique constraint won't be
in the baseline. Task 1 is first because everything else runs cleaner without the
debris.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `.gitignore` | Keep LibreChat debris and logs out of git | Modify |
| `vitest.config.ts` | Unit test runner + `@/` alias | Create |
| `lib/db/migrate.ts` | Fail closed when `POSTGRES_URL` is absent | Modify |
| `lib/ratelimit.ts` | Fail closed; await connect | Modify |
| `lib/blob-path.ts` | Pure, testable blob key builder | Create |
| `lib/blob-path.test.ts` | Its tests | Create |
| `app/(chat)/api/files/upload/route.ts` | Use the key builder; random suffix | Modify |
| `components/chat/multimodal-input.tsx` | `accept` on the file input | Modify |
| `lib/db/schema.ts` | Unique email | Modify |
| `lib/db/queries.ts` | Collision-safe guest creation | Modify |
| `lib/constants.ts` | Delete `guestRegex` | Modify |
| `proxy.ts` | Use `token.type` | Modify |
| `components/chat/sidebar-user-nav.tsx` | Use `session.user.type` | Modify |
| `lib/db/migrations/**` | Regenerated baseline | Replace |
| `.github/workflows/lint.yml` | Add typecheck + build | Modify |

---

## Task 0: Rotate leaked credentials (MANUAL — do this first)

**No code. Do it before anything else.**

The orphaned `.env` holds **live** secrets that no current code reads. They are
gitignored and were never committed, so nothing leaked publicly — but they are
live, unused, and unmonitored, which is the worst combination.

- [ ] **Step 1: Rotate the OpenRouter key**

Log into openrouter.ai → Keys → revoke the key in `.env` (`OPENROUTER_KEY`).
Do not reissue — the current stack uses Vercel AI Gateway, not OpenRouter.

- [ ] **Step 2: Rotate the SMTP credentials**

Rotate `EMAIL_USERNAME` / `EMAIL_PASSWORD` at your mail provider. Nothing in the
current tree sends email.

- [ ] **Step 3: Confirm `.env` was never committed**

```bash
git log --all --oneline -- .env | head
```

Expected: **empty output.** If it is NOT empty, the secrets are in git history
and rotation is mandatory rather than precautionary — say so before continuing.

- [ ] **Step 4: Delete the orphaned file**

```bash
rm -f .env
```

All 55 vars in it are LibreChat-era and unused. Local dev uses `.env.local`
(Task 2), which is what `drizzle.config.ts`, `lib/db/migrate.ts`, and
`playwright.config.ts` already load.

---

## Task 1: Purge LibreChat debris

**Files:**
- Delete: `api/`, `client/`, `data/`, `logs/`, `uploads/` (all untracked)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: nothing

These directories are untracked **and not gitignored** — a `git add -A` would
commit LibreChat server logs (which contain local filesystem paths and may
contain secrets) into the repo.

- [ ] **Step 1: Confirm they are untracked before deleting**

```bash
for d in api client data logs uploads; do
  echo "$d: $(git ls-files "$d" | wc -l | tr -d ' ') tracked files"
done
```

Expected: `0 tracked files` for every one. **If any is non-zero, stop** — that
directory is real code, not debris.

- [ ] **Step 2: Delete them**

```bash
rm -rf api client data logs uploads
```

- [ ] **Step 3: Add guards to `.gitignore`**

Append to `.gitignore`:

```gitignore

# LibreChat-era debris (pre-Vercel restart) — must never return
/api/
/client/
/data/
/logs/
/uploads/
```

- [ ] **Step 4: Verify a full add stages nothing unexpected**

```bash
git add -A --dry-run
```

Expected: only `.gitignore` (and any plan docs). No `logs/`, no `api/`.

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: purge LibreChat debris and gitignore it"
```

---

## Task 2: Add vitest + local env template

**Files:**
- Create: `vitest.config.ts`, `.env.local.example`
- Modify: `package.json`

**Interfaces:**
- Produces: `pnpm test:unit` runs vitest against `**/*.test.ts` outside `tests/`.
  Tasks 3–6 depend on this existing.

The repo has **no unit test runner** — only Playwright (`tests/e2e/*`). Phase 0's
fixes are pure logic and need unit tests, as will every later phase. Playwright's
`testDir` is `./tests`, so vitest must exclude that directory or the two runners
will collide.

- [ ] **Step 1: Install vitest**

```bash
pnpm add -D vitest@^3 vite-tsconfig-paths@^5
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // `tests/` belongs to Playwright (playwright.config.ts testDir: "./tests")
    exclude: ["**/node_modules/**", "**/.next/**", "tests/**"],
    include: ["**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 3: Add the script**

In `package.json` `scripts`, add after `"test"`:

```json
    "test:unit": "vitest run",
```

- [ ] **Step 4: Create `.env.local.example`**

The 5 vars the app actually needs. `.env.local` is what the tooling loads.

```bash
# Auth.js session signing — generate with: openssl rand -base64 32
AUTH_SECRET=

# Vercel AI Gateway. Optional on Vercel (OIDC is automatic); required locally.
AI_GATEWAY_API_KEY=

# Neon Postgres
POSTGRES_URL=

# Vercel Blob (attachments)
BLOB_READ_WRITE_TOKEN=

# Redis. Redis-protocol URL (redis://...), NOT Upstash REST/KV credentials.
# Required in production — rate limiting fails closed without it.
REDIS_URL=
```

- [ ] **Step 5: Verify vitest runs (zero tests is a pass)**

```bash
pnpm test:unit
```

Expected: exits 0, `No test files found` or similar. **Not** a crash.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts .env.local.example package.json pnpm-lock.yaml
git commit -m "chore: add vitest and local env template"
```

---

## Task 3: Make migrations fail closed

**Files:**
- Modify: `lib/db/migrate.ts:10-14`

**Interfaces:**
- Consumes: nothing
- Produces: nothing

`package.json` runs `"build": "tsx lib/db/migrate && next build"`. Today
`migrate.ts` calls **`process.exit(0)`** when `POSTGRES_URL` is unset — a
*success* exit. The build proceeds and **deploys green against no database**,
failing only at runtime in front of users.

This is a script, not importable logic, so it is verified by running it rather
than by a unit test.

- [ ] **Step 1: Verify the bug exists**

```bash
env -u POSTGRES_URL pnpm exec tsx lib/db/migrate.ts; echo "exit=$?"
```

Expected (the bug): `POSTGRES_URL not defined, skipping migrations` and
**`exit=0`**.

- [ ] **Step 2: Fix it**

In `lib/db/migrate.ts`, replace lines 11-14:

```ts
  if (!process.env.POSTGRES_URL) {
    console.log("POSTGRES_URL not defined, skipping migrations");
    process.exit(0);
  }
```

with:

```ts
  if (!process.env.POSTGRES_URL) {
    console.error(
      "POSTGRES_URL is not defined. Refusing to build without a database."
    );
    process.exit(1);
  }
```

- [ ] **Step 3: Verify it now fails closed**

```bash
env -u POSTGRES_URL pnpm exec tsx lib/db/migrate.ts; echo "exit=$?"
```

Expected: the refusal message and **`exit=1`**.

- [ ] **Step 4: Commit**

```bash
git add lib/db/migrate.ts
git commit -m "fix: fail the build when POSTGRES_URL is missing"
```

---

## Task 4: Make rate limiting fail closed

**Files:**
- Modify: `lib/ratelimit.ts`
- Test: `lib/ratelimit.test.ts` (create)

**Interfaces:**
- Consumes: `ChatbotError` from `@/lib/errors`, `isProductionEnvironment` from
  `@/lib/constants`
- Produces: `checkIpRateLimit(ip: string | undefined): Promise<void>` — throws
  `ChatbotError("rate_limit:chat")` when over limit **or when Redis is
  unavailable in production**. Unchanged signature; callers need no edit.

Three bugs in one 48-line file:
1. `if (!redis?.isReady) return;` (line 28-30) — **no `REDIS_URL` means no rate
   limiting at all.** `proxy.ts` auto-provisions guests, so this is an
   unauthenticated, unmetered `/api/chat` billed to your AI Gateway account.
2. `client.connect()` (line 15) is **not awaited** — even correctly configured,
   requests during the cold-start window bypass the limiter.
3. The `catch` (line 43-47) swallows every non-`ChatbotError`, so a Redis error
   mid-request silently allows it.

- [ ] **Step 1: Write the failing test**

Create `lib/ratelimit.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const connectMock = vi.fn();
const createClientMock = vi.fn();

vi.mock("redis", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

vi.mock("@/lib/constants", () => ({ isProductionEnvironment: true }));

async function loadModule() {
  vi.resetModules();
  return await import("./ratelimit");
}

describe("checkIpRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REDIS_URL = "";
  });

  it("throws when REDIS_URL is not configured in production", async () => {
    const { checkIpRateLimit } = await loadModule();
    await expect(checkIpRateLimit("1.2.3.4")).rejects.toThrow();
  });

  it("throws when the ip is unknown in production", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const { checkIpRateLimit } = await loadModule();
    await expect(checkIpRateLimit(undefined)).rejects.toThrow();
  });

  it("throws when redis fails to connect", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    connectMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    createClientMock.mockReturnValue({
      connect: connectMock,
      isReady: false,
      on: vi.fn(),
    });
    const { checkIpRateLimit } = await loadModule();
    await expect(checkIpRateLimit("1.2.3.4")).rejects.toThrow();
  });

  it("allows a request under the limit", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    connectMock.mockResolvedValueOnce(undefined);
    createClientMock.mockReturnValue({
      connect: connectMock,
      isReady: true,
      multi: () => ({
        incr: () => ({
          expire: () => ({ exec: async () => [1] }),
        }),
      }),
      on: vi.fn(),
    });
    const { checkIpRateLimit } = await loadModule();
    await expect(checkIpRateLimit("1.2.3.4")).resolves.toBeUndefined();
  });

  it("throws when over the limit", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    connectMock.mockResolvedValueOnce(undefined);
    createClientMock.mockReturnValue({
      connect: connectMock,
      isReady: true,
      multi: () => ({
        incr: () => ({
          expire: () => ({ exec: async () => [11] }),
        }),
      }),
      on: vi.fn(),
    });
    const { checkIpRateLimit } = await loadModule();
    await expect(checkIpRateLimit("1.2.3.4")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
pnpm test:unit lib/ratelimit.test.ts
```

Expected: FAIL. The first three tests resolve instead of throwing — that is
exactly the fail-open bug.

- [ ] **Step 3: Rewrite `lib/ratelimit.ts`**

Replace the whole file:

```ts
import { createClient } from "redis";

import { isProductionEnvironment } from "@/lib/constants";
import { ChatbotError } from "@/lib/errors";

const MAX_MESSAGES = 10;
const TTL_SECONDS = 60 * 60;

type RedisClient = ReturnType<typeof createClient>;

let clientPromise: Promise<RedisClient> | null = null;

function getClient(): Promise<RedisClient> | null {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!clientPromise) {
    const client = createClient({ url: process.env.REDIS_URL });
    client.on("error", () => undefined);
    clientPromise = client
      .connect()
      .then(() => client)
      .catch((error) => {
        // Allow a later request to retry the connection.
        clientPromise = null;
        throw error;
      });
  }

  return clientPromise;
}

/**
 * Per-IP abuse brake. Fails CLOSED: if Redis is unreachable in production we
 * reject rather than serve unmetered inference on the AI Gateway bill.
 */
export async function checkIpRateLimit(ip: string | undefined) {
  if (!isProductionEnvironment) {
    return;
  }

  if (!ip) {
    throw new ChatbotError("rate_limit:chat");
  }

  let redis: RedisClient;
  try {
    const pending = getClient();
    if (!pending) {
      throw new Error("REDIS_URL is not configured");
    }
    redis = await pending;
  } catch {
    throw new ChatbotError("rate_limit:chat");
  }

  let count: unknown;
  try {
    [count] = await redis
      .multi()
      .incr(`ip-rate-limit:${ip}`)
      .expire(`ip-rate-limit:${ip}`, TTL_SECONDS, "NX")
      .exec();
  } catch {
    throw new ChatbotError("rate_limit:chat");
  }

  // Fail closed on an unexpected reply shape too — `typeof count === "number"`
  // would silently ALLOW the request if redis ever returned a string/BigInt.
  if (typeof count !== "number" || count > MAX_MESSAGES) {
    throw new ChatbotError("rate_limit:chat");
  }
}
```

> **Note (2026-07-14):** the two snippets above are the corrected versions. As
> originally drafted this task used bare `catch {}` (which trips ultracite's
> `useErrorCause` rule) and the fail-open `typeof count === "number" &&` check.
> Both were caught in review. If you are reading this plan fresh, use the code
> exactly as shown here.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm test:unit lib/ratelimit.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/ratelimit.ts lib/ratelimit.test.ts
git commit -m "fix: fail closed when redis is unavailable"
```

> **Carry into Phase 5 — do not lose this.** `MAX_MESSAGES = 10` is **per IP**.
> Brazilian mobile carriers use CGNAT heavily, so many unrelated users share one
> public IP. At 10/hour this **will** block paying customers. Phase 5 must raise
> or bypass the IP brake for authenticated users and lean on the per-user
> entitlement instead. Do not raise it here — Phase 0 is about failing closed,
> and the fix belongs with the tier work.

---

## Task 5: Make blob uploads private and collision-safe

**Files:**
- Create: `lib/blob-path.ts`, `lib/blob-path.test.ts`
- Modify: `app/(chat)/api/files/upload/route.ts:47-55`
- Modify: `components/chat/multimodal-input.tsx:485-492`

**Interfaces:**
- Produces: `buildBlobKey(userId: string, filename: string): string` — returns
  `uploads/<userId>/<sanitized-filename>`.

Today: `put(\`${safeName}\`, ...)` with `access: "public"` and **no
`addRandomSuffix`**. Two users uploading `foto.png` produce the same key and one
**silently overwrites the other's image**. Every upload lands at a guessable
public URL. Under LGPD that is unauthorized exposure of personal data.

Namespacing by `userId` fixes collisions; `addRandomSuffix` makes URLs
unguessable. `@vercel/blob@0.24.1` does not support private blobs, so
unguessable-and-namespaced is the available mitigation — noted as a known
limitation rather than a complete fix.

- [ ] **Step 1: Write the failing test**

Create `lib/blob-path.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildBlobKey } from "./blob-path";

describe("buildBlobKey", () => {
  it("namespaces the key by user id", () => {
    expect(buildBlobKey("user-1", "foto.png")).toBe("uploads/user-1/foto.png");
  });

  it("gives different users different keys for the same filename", () => {
    expect(buildBlobKey("user-1", "foto.png")).not.toBe(
      buildBlobKey("user-2", "foto.png")
    );
  });

  it("sanitizes unsafe characters", () => {
    expect(buildBlobKey("user-1", "mi nha foto!.png")).toBe(
      "uploads/user-1/mi_nha_foto_.png"
    );
  });

  it("strips path traversal attempts", () => {
    expect(buildBlobKey("user-1", "../../etc/passwd")).toBe(
      "uploads/user-1/.._.._etc_passwd"
    );
  });

  it("falls back to a default name when the filename is empty", () => {
    expect(buildBlobKey("user-1", "")).toBe("uploads/user-1/upload");
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
pnpm test:unit lib/blob-path.test.ts
```

Expected: FAIL — `Cannot find module './blob-path'`.

- [ ] **Step 3: Create `lib/blob-path.ts`**

```ts
/**
 * Build a per-user namespaced blob key. Prevents one user's upload from
 * overwriting another's when filenames collide (e.g. "foto.png").
 */
export function buildBlobKey(userId: string, filename: string): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `uploads/${userId}/${sanitized || "upload"}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm test:unit lib/blob-path.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Use it in the upload route**

In `app/(chat)/api/files/upload/route.ts`, add to the imports:

```ts
import { buildBlobKey } from "@/lib/blob-path";
```

Then replace lines 47-55:

```ts
    const filename = (formData.get("file") as File).name;
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileBuffer = await file.arrayBuffer();

    try {
      const data = await put(`${safeName}`, fileBuffer, {
        access: "public",
      });
```

with:

```ts
    const filename = (formData.get("file") as File).name;
    const fileBuffer = await file.arrayBuffer();

    try {
      const data = await put(
        buildBlobKey(session.user.id, filename),
        fileBuffer,
        {
          access: "public",
          addRandomSuffix: true,
        }
      );
```

- [ ] **Step 6: Add `accept` to the file input**

The input has no `accept`, so users can pick a `.pdf`, wait for the upload, and
only then learn the server rejects it. In
`components/chat/multimodal-input.tsx`, add `accept` to the `<input>` at line
485:

```tsx
      <input
        accept="image/jpeg,image/png"
        className="pointer-events-none fixed -top-4 -left-4 size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />
```

- [ ] **Step 7: Verify types and lint pass**

```bash
pnpm exec tsc --noEmit && pnpm check
```

Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add lib/blob-path.ts lib/blob-path.test.ts \
  "app/(chat)/api/files/upload/route.ts" \
  components/chat/multimodal-input.tsx
git commit -m "fix: namespace blob uploads per user and randomize keys"
```

---

## Task 6: Fix guest identity (collisions + brittle regex)

**Files:**
- Modify: `lib/db/schema.ts:16`
- Modify: `lib/db/queries.ts:59-71`
- Modify: `lib/constants.ts:11`
- Modify: `proxy.ts:3,32`
- Modify: `components/chat/sidebar-user-nav.tsx:21,39`
- Test: `lib/guest.test.ts` (create)

**Interfaces:**
- Produces: `buildGuestEmail(): string` in `lib/db/utils.ts` — returns
  `guest-<uuid>@bizu.local`, collision-safe.
- Removes: `guestRegex` from `lib/constants.ts`. **Any later task importing it
  will fail to compile — that is intended.** Use `session.user.type === "guest"`
  (client) or `token.type === "guest"` (proxy) instead.

Two coupled bugs:
1. `createGuestUser` uses `email: \`guest-${Date.now()}\``. Two guests
   provisioned in the same millisecond collide, and **`User.email` has no unique
   constraint**, so this silently creates duplicate rows that `getUser`'s
   `[user] = users` destructuring resolves arbitrarily.
2. Guest-ness is inferred by regex (`/^guest-\d+$/`) against the email, even
   though **the JWT already carries `token.type`** (set in `auth.ts:44`). The
   regex is redundant and wrong — a real user registering `guest-123` is
   misidentified as a guest.

Fixing (1) alone **breaks** (2), because a UUID email no longer matches `\d+$`.
They must change together. That coupling is why this is one task.

- [ ] **Step 1: Write the failing test**

Create `lib/guest.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildGuestEmail } from "./db/utils";

describe("buildGuestEmail", () => {
  it("is unique across rapid successive calls", () => {
    const emails = new Set(
      Array.from({ length: 1000 }, () => buildGuestEmail())
    );
    expect(emails.size).toBe(1000);
  });

  it("is prefixed so guests are recognizable in the database", () => {
    expect(buildGuestEmail().startsWith("guest-")).toBe(true);
  });

  it("fits the varchar(64) email column", () => {
    expect(buildGuestEmail().length).toBeLessThanOrEqual(64);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
pnpm test:unit lib/guest.test.ts
```

Expected: FAIL — `buildGuestEmail` is not exported from `lib/db/utils`.

- [ ] **Step 3: Add `buildGuestEmail` to `lib/db/utils.ts`**

Append to `lib/db/utils.ts`:

```ts
/**
 * Collision-safe guest email. `Date.now()` collided when two guests were
 * provisioned in the same millisecond. Length: 6 + 36 + 11 = 53 <= varchar(64).
 */
export function buildGuestEmail() {
  return `guest-${crypto.randomUUID()}@bizu.local`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm test:unit lib/guest.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Add the unique constraint to the schema**

In `lib/db/schema.ts`, change line 16:

```ts
  email: varchar("email", { length: 64 }).notNull(),
```

to:

```ts
  email: varchar("email", { length: 64 }).notNull().unique(),
```

- [ ] **Step 6: Use it in `createGuestUser`, and set the dead `isAnonymous` flag**

In `lib/db/queries.ts`, replace lines 59-71:

```ts
export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      email: user.email,
      id: user.id,
    });
```

with:

```ts
export async function createGuestUser() {
  const email = buildGuestEmail();
  const password = generateHashedPassword(generateUUID());

  try {
    return await db
      .insert(user)
      .values({ email, isAnonymous: true, password })
      .returning({
        email: user.email,
        id: user.id,
      });
```

Add `buildGuestEmail` to the existing import from `./utils` in that file.
(`isAnonymous` exists in the schema and has **never** been written by any code
path — this is the first writer.)

- [ ] **Step 7: Delete `guestRegex`**

In `lib/constants.ts`, delete line 11:

```ts
export const guestRegex = /^guest-\d+$/;
```

- [ ] **Step 8: Use `token.type` in `proxy.ts`**

Change the import on line 3:

```ts
import { isDevelopmentEnvironment } from "./lib/constants";
```

and line 32:

```ts
  const isGuest = token.type === "guest";
```

- [ ] **Step 9: Use `session.user.type` in `sidebar-user-nav.tsx`**

Remove the `guestRegex` import (line 21) and change line 39:

```ts
  const isGuest = data?.user?.type === "guest";
```

- [ ] **Step 10: Verify nothing still imports the deleted regex**

```bash
grep -rn "guestRegex" --include="*.ts" --include="*.tsx" . --exclude-dir=node_modules; echo "exit=$?"
```

Expected: no output, `exit=1`.

- [ ] **Step 11: Verify types, lint, and unit tests**

```bash
pnpm exec tsc --noEmit && pnpm check && pnpm test:unit
```

Expected: all clean.

- [ ] **Step 12: Commit**

```bash
git add lib/db/schema.ts lib/db/queries.ts lib/db/utils.ts lib/constants.ts \
  proxy.ts components/chat/sidebar-user-nav.tsx lib/guest.test.ts
git commit -m "fix: collision-safe guest identity via token.type"
```

---

## Task 7: Regenerate the Drizzle baseline

**Files:**
- Replace: `lib/db/migrations/0000_initial.sql`, `lib/db/migrations/meta/_journal.json`
- Create: `lib/db/migrations/meta/0000_*_snapshot.json`

**Interfaces:**
- Produces: a migration baseline that `drizzle-kit generate` can diff against.
  **Every later phase's schema work depends on this.**

**This is the hard blocker on Phases 2–5.** `lib/db/migrations/meta/` contains
**only `_journal.json`** — there is no `0000_snapshot.json` (verified). Drizzle
diffs new migrations against the snapshot; with none present, the next
`drizzle-kit generate` believes the database is empty and emits a full
`CREATE TABLE` set that collides with the existing baseline.

The fork hand-wrote `0000_initial.sql` and a `_journal.json` with a placeholder
timestamp (`1710000000000`), squashing upstream's chain without producing a
snapshot.

**Regenerating from scratch is safe *right now* and only right now** — no
production database exists (no Vercel project, nothing deployed). Once you have
users, this becomes a migration-surgery problem. Do it before Task 8.

Run this **after Task 6** so the unique email constraint is captured in the
baseline.

- [ ] **Step 1: Confirm no snapshot exists and no deployed DB is at risk**

```bash
ls lib/db/migrations/meta/
```

Expected: `_journal.json` only. **If a `*_snapshot.json` is present, stop** — the
premise is wrong and this task is unnecessary.

Confirm nothing is deployed before destroying the baseline:

```bash
vercel projects ls 2>/dev/null | grep -i bizu || echo "no bizu project — safe to regenerate"
```

Expected: `no bizu project — safe to regenerate`. **If a project exists, stop and
reassess** — a live database means this needs migration surgery instead.

- [ ] **Step 2: Delete the hand-written baseline**

```bash
rm -rf lib/db/migrations
```

- [ ] **Step 3: Generate a real baseline from `lib/db/schema.ts`**

```bash
pnpm exec drizzle-kit generate --name=initial
```

- [ ] **Step 4: Verify the snapshot now exists and captures the unique constraint**

```bash
ls lib/db/migrations/meta/
grep -i "unique" lib/db/migrations/*.sql
```

Expected: `_journal.json` **and** `0000_snapshot.json`. The grep must show a
unique constraint on `User.email` (proves Task 6 landed before this).

- [ ] **Step 5: Prove the diff engine works — the whole point of this task**

```bash
pnpm exec drizzle-kit generate --name=noop_check
```

Expected: **"No schema changes, nothing to migrate"**. If it instead emits a
migration full of `CREATE TABLE`, the snapshot is not being read — stop and
investigate rather than continuing.

If a `0001_noop_check` file was somehow created, delete it:

```bash
rm -f lib/db/migrations/0001_noop_check.sql
```

- [ ] **Step 6: SKIPPED — applying deferred to Phase 6 (decided 2026-07-14)**

No database exists yet (no Neon project, no `.env.local`), so the baseline
cannot be applied here. **Do not attempt it.** Step 5 already proves the actual
blocker — that the diff engine reads the snapshot — which is what unblocks
Phases 2–5.

Phase 6 must run `pnpm exec tsx lib/db/migrate.ts` against the real Neon
database as its first migration step, and expect `Migrations completed in <n> ms`
with exit 0. **Until then this baseline is generated but unproven against a live
Postgres.**

- [ ] **Step 7: Commit**

```bash
git add lib/db/migrations
git commit -m "fix: regenerate drizzle baseline with a real snapshot"
```

---

## Task 8: Make CI catch what it currently misses

**Files:**
- Modify: `.github/workflows/lint.yml`

**Interfaces:**
- Consumes: `pnpm test:unit` (Task 2)
- Produces: nothing

CI runs only `pnpm check` (Biome lint). It **never typechecks and never builds**
— so on a stack running Next 16 with `cacheComponents`, `reactCompiler`, and five
experimental flags, build breakage surfaces first on Vercel. A `"use client"`
ordering bug already broke the production build once (`4f752cddf`).

`pnpm install` also runs without `--frozen-lockfile`, so CI can silently resolve
different versions than the lockfile pins.

- [ ] **Step 1: Rewrite `.github/workflows/lint.yml`**

```yaml
name: Lint
on:
  push:

jobs:
  build:
    runs-on: ubuntu-22.04
    strategy:
      matrix:
        node-version: [20]
    steps:
      - uses: actions/checkout@v4
      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.32.1
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: "pnpm"
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Run check
        run: pnpm check
      - name: Typecheck
        run: pnpm exec tsc --noEmit
      - name: Unit tests
        run: pnpm test:unit
      - name: Build
        run: pnpm exec next build
        env:
          # `pnpm build` would also run migrations, which needs a live database.
          # Build the app only — migrations are covered by the deploy pipeline.
          AUTH_SECRET: ci-placeholder-secret-not-used-at-runtime
```

Note the build step deliberately calls `next build` directly rather than
`pnpm build`, because `pnpm build` is `tsx lib/db/migrate && next build` and
Task 3 makes that **fail closed** without a database — correct in production,
wrong for a CI build job.

- [ ] **Step 2: Verify the full gate passes locally**

```bash
pnpm check && pnpm exec tsc --noEmit && pnpm test:unit && pnpm exec next build
```

Expected: all four pass. **If `next build` fails, fix it now** — that failure is
already live on `main` and would hit your first deploy.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/lint.yml
git commit -m "ci: typecheck, unit test, and build on every push"
```

---

## Definition of Done

- [ ] The live OpenRouter key and SMTP credentials are rotated; `.env` is gone
- [ ] `git add -A --dry-run` stages no `logs/`, `api/`, `client/`, `data/`
- [ ] `env -u POSTGRES_URL pnpm exec tsx lib/db/migrate.ts` exits **1**
- [ ] `pnpm test:unit` passes (13 tests across 3 files)
- [ ] `grep -rn guestRegex` returns nothing
- [ ] `lib/db/migrations/meta/0000_snapshot.json` exists, and a second
      `drizzle-kit generate` reports **no changes**
- [ ] `pnpm check && pnpm exec tsc --noEmit && pnpm exec next build` all pass
- [ ] CI runs lint + typecheck + unit tests + build

**Carried into later phases (do not lose):**
- **The regenerated baseline has never been applied to a real Postgres** (no DB
  existed at Phase 0). Phase 6 must run `pnpm exec tsx lib/db/migrate.ts`
  against Neon before anything else → Phase 6
- IP rate limit is 10/hr and **CGNAT will block real Brazilian users** → Phase 5
- `@vercel/blob@0.24.1` cannot make blobs private; unguessable keys are a
  mitigation, not a fix → revisit if attachments handle sensitive data
- Env validation still does not run at boot → Phase 6
