# Phase 1 — De-Vercel Branding & Legal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every trace of Vercel/template branding from what users see, ship
the legal pages that currently 404 from the signup form, and close the PT-BR gaps
— so Bizu looks and reads like its own product.

**Architecture:** Brand imagery is **generated from code** via Next's
`ImageResponse` (`next/og`, confirmed available at `next@16.2.10`) rather than
committed as binaries — version-controlled, restyleable, no design handoff. All
user-facing copy continues to live in `lib/i18n/messages.ts`. Legal pages are
plain server components under `app/(legal)/`.

**Tech Stack:** Next 16.2.10 App Router · `next/og` ImageResponse · React 19.2.7 ·
Tailwind 4 · vitest · pnpm 10.32.1

**Master plan:** `2026-07-14-bizu-chat-launch.md` · **Depends on:** Phase 0 (merged, `0aa755078`)

## Global Constraints

- **Package manager is `pnpm` (10.32.1).** Never `npm`/`yarn`.
- **All user-facing copy is pt-BR and lives in `lib/i18n/messages.ts`** — never
  inline in a component.
- **No Vercel/Next.js/template branding may reach a user.** Task 8 enforces this
  with an automated test; it must stay green forever.
- **Never rename a model with a brand name.** Real model names only.
- **Directives first:** `"use client"` precedes all imports (this broke the build
  once — `4f752cddf`).
- **Lint gate:** `pnpm check` and `pnpm exec tsc --noEmit` pass before every commit.
- **`pnpm exec next build` must pass.** CI now runs it (Phase 0, Task 8).
- Do NOT touch `lib/ratelimit.ts`, `lib/db/*`, or auth — Phase 0 settled those.

---

## ⚠️ The legal text in Task 5 is NOT legal advice

The user chose "draft full text for review." Task 5 writes a complete, readable
PT-BR draft shaped around LGPD (Lei 13.709/2018) with the operator's identifying
details as explicit `[PLACEHOLDER]` markers. It is a **starting point for a
lawyer**, not a compliant policy. It must not ship as-is to paying users, and
**Phase 5 (paywall) must not go live until a qualified professional has reviewed
it.** Every placeholder is listed in Task 5's Definition of Done. Do not invent a
CNPJ, an address, or a company name.

---

## Ordering

**Run tasks strictly one at a time, in numeric order.** They are logically
independent, but **Tasks 1, 3, 5 and 7 all edit `lib/i18n/messages.ts`** — running
two implementers concurrently would conflict on that file. Task 2 also deletes
files under `app/` that Task 5 creates siblings of.

**Task 8 must run last** — it is the regression net that asserts Tasks 1–3
actually removed what they claimed, and it cannot pass before they land.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `components/chat/chat-header.tsx` | Chat header — **Vercel-free** | Modify |
| `app/(auth)/layout.tsx` | Auth split-screen — Vercel-free | Modify |
| `components/chat/icons.tsx` | Delete now-dead `VercelIcon` | Modify |
| `components/brand/bizu-mark.tsx` | The Bizu logo mark (SVG) | Create |
| `app/icon.tsx` | Favicon via ImageResponse | Create |
| `app/(chat)/opengraph-image.tsx` | OG card via ImageResponse | Create |
| `app/(chat)/twitter-image.tsx` | Twitter card via ImageResponse | Create |
| `app/(legal)/layout.tsx` | Shared legal page shell | Create |
| `app/(legal)/privacidade/page.tsx` | Privacy policy (LGPD draft) | Create |
| `app/(legal)/termos/page.tsx` | Terms of service (draft) | Create |
| `lib/i18n/messages.ts` | Copy: legal, errors, brand | Modify |
| `lib/constants.ts` | Brazilian starter prompts | Modify |
| `lib/ai/models.ts` | Correct `gatewayOrder` | Modify |
| `components/chat/shell.tsx` | Generic outage dialog | Modify |
| `app/(chat)/api/chat/route.ts` | PT-BR stream errors | Modify |
| `artifacts/*/client.tsx`, `components/chat/toolbar.tsx` | PT-BR | Modify |
| `lib/brand-guard.test.ts` | Automated no-leak test | Create |

---

## Task 1: Strip Vercel from the UI

**Files:**
- Modify: `components/chat/chat-header.tsx:8,37-44,53-65`
- Modify: `app/(auth)/layout.tsx:3,32-37`
- Modify: `components/chat/icons.tsx:53`
- Delete: `public/preview.png`, `public/images/demo-thumbnail.png`, `public/images/mouth of the seine, monet.jpg`

**Interfaces:**
- Consumes: nothing
- Produces: `VercelIcon` no longer exists. Any later import fails to compile — intended.

**This is the single most visible leak.** `chat-header.tsx` renders a black
**"Deploy with Vercel"** button on the main chat screen (it is rendered by
`shell.tsx:122`, so every user sees it), plus a mobile `VercelIcon` link. The auth
split-screen advertises the infrastructure vendor to end users. The three `public/`
images are template stock with **zero references** (verified by grep).

- [ ] **Step 1: Remove both Vercel links from `chat-header.tsx`**

Delete the `VercelIcon` import (line 8), the mobile `<Link>` block (lines 37-44),
and the entire "Deploy with Vercel" `<Button>` (lines 53-65). The file becomes:

```tsx
"use client";

import { PanelLeftIcon } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { state, toggleSidebar, isMobile } = useSidebar();

  if (state === "collapsed" && !isMobile) {
    return null;
  }

  return (
    <header className="sticky top-0 flex h-14 items-center gap-2 bg-sidebar px-3">
      <Button
        className="md:hidden"
        onClick={toggleSidebar}
        size="icon-sm"
        variant="ghost"
      >
        <PanelLeftIcon className="size-4" />
      </Button>

      {!isReadonly && (
        <VisibilitySelector
          chatId={chatId}
          selectedVisibilityType={selectedVisibilityType}
        />
      )}
    </header>
  );
}

export const ChatHeader = memo(
  PureChatHeader,
  (prevProps, nextProps) =>
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
);
```

Note `next/link` is no longer used here — remove that import too (the code above
already omits it). `pnpm check` will flag it if missed.

- [ ] **Step 2: De-Vercel the auth layout**

In `app/(auth)/layout.tsx`, change the import on line 3 to drop `VercelIcon`:

```tsx
import { SparklesIcon } from "@/components/chat/icons";
```

and replace the vendor line (lines 33-37) with the brand tagline:

```tsx
        <div className="flex items-center gap-1.5 pt-8 text-[13px] text-muted-foreground/50">
          {ui.brand.name} · {ui.brand.tagline}
        </div>
```

- [ ] **Step 3: Delete the now-dead `VercelIcon`**

In `components/chat/icons.tsx`, delete the entire `export const VercelIcon = ...`
declaration starting at line 53 (through its closing `);`).

- [ ] **Step 4: Delete unused template stock images**

All three are verified unreferenced.

```bash
rm -f public/preview.png "public/images/demo-thumbnail.png" "public/images/mouth of the seine, monet.jpg"
rmdir public/images 2>/dev/null || true
```

- [ ] **Step 5: Verify no Vercel references remain in user-facing chrome**

```bash
grep -rn "VercelIcon\|Deploy with Vercel\|vercel.com/templates" --include="*.tsx" --include="*.ts" . --exclude-dir=node_modules; echo "exit=$?"
```

Expected: no output, `exit=1`.

- [ ] **Step 6: Verify types, lint, build**

```bash
pnpm exec tsc --noEmit && pnpm check && pnpm exec next build
```

Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add components/chat/chat-header.tsx "app/(auth)/layout.tsx" components/chat/icons.tsx public
git commit -m "fix: remove Vercel branding from user-facing UI"
```

---

## Task 2: Bizu mark + code-generated brand imagery

**Files:**
- Create: `components/brand/bizu-mark.tsx`, `app/icon.tsx`, `app/(chat)/opengraph-image.tsx`, `app/(chat)/twitter-image.tsx`
- Modify: `components/chat/app-sidebar.tsx:98`
- Delete: `app/favicon.ico`, `app/(chat)/opengraph-image.png`, `app/(chat)/twitter-image.png`

**Interfaces:**
- Produces: `<BizuMark size={n} />` from `@/components/brand/bizu-mark`.

**Why:** `opengraph-image.png` is Vercel's stock art (black canvas, Vercel triangle,
the word "Chatbot"); `twitter-image.png` reads **"AI Chatbot Starter Template"**.
Every Bizu link shared to WhatsApp unfurls as Vercel's template. The sidebar logo
is a generic lucide `MessageSquareIcon`. Generating these with `ImageResponse`
means no binary assets and trivial restyling later.

**Design note:** this is a deliberately minimal typographic mark (a "B" in a
rounded square, brand green `#00A868`), chosen so it reads at 32px and needs no
design handoff. Swap it freely — nothing else depends on its appearance.

- [ ] **Step 1: Create the mark**

`components/brand/bizu-mark.tsx`:

```tsx
export function BizuMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 32 32"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#00A868" height="32" rx="8" width="32" />
      <path
        d="M11 8.5h6.2c2.9 0 4.6 1.4 4.6 3.7 0 1.5-.8 2.6-2.1 3.2 1.7.5 2.7 1.8 2.7 3.6 0 2.6-1.9 4.2-5.1 4.2H11V8.5Zm3.2 5.9h2.6c1.1 0 1.8-.6 1.8-1.5s-.7-1.4-1.8-1.4h-2.6v2.9Zm0 6.2h3c1.2 0 1.9-.6 1.9-1.6s-.7-1.6-1.9-1.6h-3v3.2Z"
        fill="white"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Use it in the sidebar**

In `components/chat/app-sidebar.tsx`, replace the `MessageSquareIcon` on line 98:

```tsx
                    <BizuMark size={16} />
```

Add `import { BizuMark } from "@/components/brand/bizu-mark";` and remove
`MessageSquareIcon` from the lucide import **only if nothing else in the file uses
it** — check first with a grep; `pnpm check` will flag an unused import.

- [ ] **Step 3: Delete Vercel's stock imagery**

```bash
rm -f app/favicon.ico "app/(chat)/opengraph-image.png" "app/(chat)/twitter-image.png"
```

- [ ] **Step 4: Generate the favicon**

`app/icon.tsx`:

```tsx
import { ImageResponse } from "next/og";

export const size = { height: 32, width: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#00A868",
        borderRadius: 7,
        color: "white",
        display: "flex",
        fontSize: 22,
        fontWeight: 700,
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      B
    </div>,
    size
  );
}
```

- [ ] **Step 5: Generate the OG card**

`app/(chat)/opengraph-image.tsx`:

```tsx
import { ImageResponse } from "next/og";
import { messages as ui } from "@/lib/i18n/messages";

export const size = { height: 630, width: 1200 };
export const contentType = "image/png";
export const alt = ui.brand.name;

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        background: "#0A0A0A",
        color: "white",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        padding: 80,
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          background: "#00A868",
          borderRadius: 24,
          color: "white",
          display: "flex",
          fontSize: 64,
          fontWeight: 700,
          height: 96,
          justifyContent: "center",
          marginBottom: 40,
          width: 96,
        }}
      >
        B
      </div>
      <div style={{ display: "flex", fontSize: 84, fontWeight: 700 }}>
        {ui.brand.name}
      </div>
      <div
        style={{
          color: "#A1A1A1",
          display: "flex",
          fontSize: 36,
          marginTop: 16,
        }}
      >
        {ui.brand.tagline}
      </div>
    </div>,
    size
  );
}
```

- [ ] **Step 6: Generate the Twitter card**

`app/(chat)/twitter-image.tsx` — re-export the OG image rather than duplicating it
(DRY; the sizes match):

```tsx
export { default, size, contentType, alt } from "./opengraph-image";
```

- [ ] **Step 7: Verify the images actually render**

```bash
pnpm exec next build
```

Expected: build passes. `ImageResponse` failures surface at build/render time, so
a passing build plus the route appearing in the output is the gate here.

Then confirm the routes exist and no stock PNG survives:

```bash
ls app/icon.tsx "app/(chat)/opengraph-image.tsx" "app/(chat)/twitter-image.tsx"
ls app/favicon.ico "app/(chat)/opengraph-image.png" 2>&1 | grep -c "No such file"
```

Expected: the three `.tsx` files listed; count of 2 for the missing PNGs.

- [ ] **Step 8: Commit**

Stage the deletions explicitly by path — do **not** use `git add -A app`, which
would sweep in unrelated work under `app/`:

```bash
git add components/brand app/icon.tsx "app/(chat)/opengraph-image.tsx" \
  "app/(chat)/twitter-image.tsx" components/chat/app-sidebar.tsx
git add -u app/favicon.ico "app/(chat)/opengraph-image.png" "app/(chat)/twitter-image.png"
git commit -m "feat: generate Bizu brand imagery from code"
```

---

## Task 3: Stop showing users Vercel's billing problems

**Files:**
- Modify: `lib/i18n/messages.ts` (`errors.activateGateway`, add `errors.unavailable`)
- Modify: `components/chat/shell.tsx:193-212`
- Modify: `app/(chat)/api/chat/route.ts:391-401`

**Interfaces:**
- Produces: `ui.errors.unavailable` — the generic user-facing outage string.

**The real bug is not translation.** `ui.errors.activateGateway` is *already*
PT-BR, but it tells a **paying Brazilian customer**: *"O AI Gateway exige um cartão
de crédito válido... Adicione um cartão em vercel.com..."* — and `shell.tsx` pops a
dialog titled **"Activate AI Gateway"** offering an "Activate" button. That message
is for **the owner**, not the user. A customer cannot and must not act on it, and
it leaks the vendor. Replace the whole user-facing path with a generic outage
message and log the real cause server-side where the owner will see it.

- [ ] **Step 1: Replace the copy**

In `lib/i18n/messages.ts`, replace the `activateGateway` entry and add
`unavailable` (keep keys alphabetical to match the file's existing style):

```ts
    generic: "Algo deu errado. Tente novamente mais tarde.",
    unavailable:
      "O Bizu está temporariamente indisponível. Já estamos trabalhando nisso — tente de novo em alguns minutos.",
```

Delete the `activateGateway` key entirely. `pnpm check`/`tsc` will point at every
reader.

- [ ] **Step 2: Make the stream error PT-BR and vendor-free**

In `app/(chat)/api/chat/route.ts`, replace the `onError` handler (lines 391-401):

```ts
      onError: (error) => {
        // The AI Gateway billing error is the owner's problem, not the user's —
        // surface it in logs, never in the UI.
        console.error("[chat] stream error", error);
        return ui.errors.unavailable;
      },
```

Ensure `import { messages as ui } from "@/lib/i18n/messages";` is present in that
file; add it if not.

- [ ] **Step 3: Replace the credit-card dialog**

In `components/chat/shell.tsx`, replace the `AlertDialog` block (lines 193-212)
with a generic, dismissible notice. The gateway-activation action is removed —
there is nothing a user can do:

```tsx
      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ui.errors.unavailableTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {ui.errors.unavailable}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleDismissAlert}>
              {ui.actions.ok}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

Add to `lib/i18n/messages.ts`: `errors.unavailableTitle: "Serviço indisponível"`
and, in the `actions` namespace, `ok: "Entendi"`.

Then in the same file, replace `handleActivateGateway` with:

```tsx
  const handleDismissAlert = useCallback(() => {
    setShowCreditCardAlert(false);
  }, [setShowCreditCardAlert]);
```

> **Note (2026-07-15):** this snippet originally had `[]` deps, which fails
> ultracite's `useExhaustiveDependencies` rule. Corrected above.
>
> **Also:** the brief's file list was incomplete. `lib/errors.ts` holds a
> dangling reference to `activateGateway`, and `app/(chat)/api/chat/route.ts`'s
> **outer catch** carries a second copy of the same vendor string via
> `ChatbotError("bad_request:activate_gateway")`. Both must go, or Step 4's grep
> cannot pass. Removing the outer-catch branch also fixes a silent failure: it
> `return`ed *before* `console.error`, so gateway billing errors were never
> logged at all.
>
> **Consequence:** once the stream stops returning the English gateway string,
> the `showCreditCardAlert` trigger in `hooks/use-active-chat.tsx` is dead and
> the dialog above becomes unreachable. The whole alert path is therefore
> deleted in a follow-up commit — the `else` branch's toast of
> `ui.errors.unavailable` is the live path and is sufficient. If you are
> implementing this fresh, skip the dialog rewrite and delete the path outright.

Delete `handleActivateGateway` and any now-unused imports it pulled in
(`AlertDialogCancel` may also become unused — `pnpm check` will tell you).

- [ ] **Step 4: Verify no vendor string can reach a user**

```bash
grep -rniE "activate ai gateway|credit card|vercel\.com/d\?to=|add-credit-card" --include="*.tsx" --include="*.ts" ./app ./components ./lib ./hooks; echo "exit=$?"
```

Expected: no output, `exit=1`.

> **Note (2026-07-15):** `./hooks` was missing from this grep originally, which
> gave false confidence — `hooks/use-active-chat.tsx` holds the English
> credit-card literal as a match condition. It is never rendered, so it is not a
> leak, but the scan must cover it.

- [ ] **Step 5: Verify types, lint, build**

```bash
pnpm exec tsc --noEmit && pnpm check && pnpm exec next build
```

- [ ] **Step 6: Commit**

```bash
git add lib/i18n/messages.ts components/chat/shell.tsx "app/(chat)/api/chat/route.ts"
git commit -m "fix: show users a generic outage, not Vercel's billing state"
```

---

## Task 4: Brazilian starter prompts

**Files:**
- Modify: `lib/constants.ts:13-18`

**Interfaces:**
- Consumes: nothing. `suggestions` is read by `components/chat/preview.tsx`.

The four starter prompts are PT-BR *translations of Vercel's template defaults* —
the content is still Vercel's. *"Quais as vantagens de usar Next.js?"* is a visible
tell that this is a template, and a Brazilian consumer opening a chat app is not
asking about Next.js. `"Me ajuda a escrever uma redação sobre o Vale do Silício"`
is equally off-audience.

Replace with prompts that show breadth for a general Brazilian consumer:

- [ ] **Step 1: Rewrite them**

In `lib/constants.ts`, replace the `suggestions` array:

```ts
export const suggestions = [
  "Escreva um e-mail profissional pedindo aumento de salário",
  "Explique o que é CDB e Tesouro Direto para quem nunca investiu",
  "Crie um plano de treino de 3 dias por semana para iniciantes",
  "Resuma este texto em 5 tópicos e me diga o que é mais importante",
];
```

- [ ] **Step 2: Verify no template content survives**

```bash
grep -rniE "next\.js|silicon valley|vale do silício|dijkstra" lib/constants.ts; echo "exit=$?"
```

Expected: no output, `exit=1`.

- [ ] **Step 3: Verify lint and types**

```bash
pnpm check && pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add lib/constants.ts
git commit -m "feat: starter prompts for a Brazilian consumer audience"
```

---

## Task 5: Legal pages — `/privacidade` and `/termos`

**Files:**
- Create: `app/(legal)/layout.tsx`, `app/(legal)/privacidade/page.tsx`, `app/(legal)/termos/page.tsx`

**Interfaces:**
- Consumes: `ui.brand` from `lib/i18n/messages.ts`
- Produces: the routes `/privacidade` and `/termos`, which
  `lib/i18n/messages.ts:39,41` already point at from the login and register pages.

**Both links currently 404 from your signup form.** `ui.brand.privacyUrl` and
`termsUrl` are rendered on `app/(auth)/login/page.tsx:70-84` and
`register/page.tsx:71-84`; neither route exists.

> **⚠️ NOT LEGAL ADVICE.** The text below is a structured PT-BR draft shaped around
> LGPD (Lei 13.709/2018) to give a lawyer something concrete to correct. It is
> **not** a compliant policy. Every `[PLACEHOLDER]` must be filled with real
> details, and a qualified professional must review it **before Phase 5 takes
> money**. Do not invent a CNPJ, company name, or address.

**Note on the copy's location:** these two documents are long-form prose, not UI
strings, so they live in the page components rather than
`lib/i18n/messages.ts`. That is a deliberate exception to the global constraint —
the catalog is for interface copy, and inlining 200 lines of policy would make it
unusable. Page titles and nav labels still come from the catalog.

- [ ] **Step 1: Create the shared legal shell**

`app/(legal)/layout.tsx`:

```tsx
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { messages as ui } from "@/lib/i18n/messages";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link
          className="mb-10 flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          href="/"
        >
          <ArrowLeftIcon className="size-3.5" />
          {ui.actions.back}
        </Link>
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          {children}
        </article>
      </div>
    </div>
  );
}
```

Add `back: "Voltar"` to the `actions` namespace in `lib/i18n/messages.ts` if it is
not already there (the auth layout currently hardcodes "Voltar" — if you add the
key, update `app/(auth)/layout.tsx:20` to use `ui.actions.back` too).

- [ ] **Step 2: Create the privacy policy**

`app/(legal)/privacidade/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade · Bizu",
};

export default function PrivacidadePage() {
  return (
    <>
      <h1>Política de Privacidade</h1>
      <p>
        <em>Última atualização: [DATA_DE_VIGÊNCIA]</em>
      </p>

      <h2>1. Quem somos</h2>
      <p>
        O Bizu é operado por [RAZÃO_SOCIAL], inscrita no CNPJ sob o nº
        [CNPJ], com sede em [ENDEREÇO_COMPLETO]. Para os fins da Lei Geral de
        Proteção de Dados (Lei nº 13.709/2018), somos o <strong>controlador</strong>{" "}
        dos seus dados pessoais.
      </p>

      <h2>2. Quais dados coletamos</h2>
      <ul>
        <li>
          <strong>Dados de cadastro:</strong> seu endereço de e-mail e uma senha
          criptografada.
        </li>
        <li>
          <strong>Conteúdo das conversas:</strong> as mensagens que você envia e as
          respostas geradas, para que seu histórico funcione.
        </li>
        <li>
          <strong>Arquivos enviados:</strong> imagens que você anexa às conversas.
        </li>
        <li>
          <strong>Dados de uso:</strong> endereço IP e registros de acesso, mantidos
          por 6 (seis) meses conforme o art. 15 do Marco Civil da Internet
          (Lei nº 12.965/2014).
        </li>
        <li>
          <strong>Dados de pagamento:</strong> processados pela Stripe. Não
          armazenamos os dados do seu cartão.
        </li>
      </ul>

      <h2>3. Por que tratamos seus dados</h2>
      <p>
        Tratamos seus dados para executar o contrato de prestação do serviço
        (art. 7º, V da LGPD), para cumprir obrigações legais (art. 7º, II) e, quando
        aplicável, mediante o seu consentimento (art. 7º, I).
      </p>

      <h2>4. Com quem compartilhamos</h2>
      <p>
        Para gerar as respostas, o conteúdo das suas conversas é enviado a
        provedores de modelos de inteligência artificial, que podem estar
        localizados fora do Brasil. Isso caracteriza transferência internacional de
        dados nos termos do art. 33 da LGPD. Também utilizamos provedores de
        infraestrutura e de pagamento. [REVISAR_COM_ADVOGADO: listar os provedores
        e a base legal da transferência internacional.]
      </p>

      <h2>5. Por quanto tempo guardamos</h2>
      <p>
        Mantemos seus dados enquanto sua conta existir. Ao excluir sua conta,
        removemos seus dados pessoais, ressalvados os registros de acesso, que a lei
        exige que sejam mantidos por 6 (seis) meses.
      </p>

      <h2>6. Seus direitos</h2>
      <p>
        Nos termos do art. 18 da LGPD, você pode solicitar a confirmação de
        tratamento, o acesso, a correção, a anonimização, a portabilidade e a
        exclusão dos seus dados, bem como revogar o consentimento. Para exercer
        qualquer um desses direitos, escreva para{" "}
        <a href="mailto:[EMAIL_DE_PRIVACIDADE]">[EMAIL_DE_PRIVACIDADE]</a>.
        Responderemos no prazo legal.
      </p>

      <h2>7. Encarregado (DPO)</h2>
      <p>
        Encarregado pelo tratamento de dados pessoais: [NOME_DO_ENCARREGADO] —{" "}
        <a href="mailto:[EMAIL_DO_ENCARREGADO]">[EMAIL_DO_ENCARREGADO]</a>.
      </p>

      <h2>8. Segurança</h2>
      <p>
        Adotamos medidas técnicas e administrativas para proteger seus dados. Nenhum
        sistema é totalmente seguro; em caso de incidente relevante, comunicaremos
        você e a ANPD conforme o art. 48 da LGPD.
      </p>

      <h2>9. Alterações</h2>
      <p>
        Podemos atualizar esta política. Mudanças relevantes serão comunicadas por
        e-mail ou dentro do próprio serviço.
      </p>
    </>
  );
}
```

- [ ] **Step 3: Create the terms of service**

`app/(legal)/termos/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso · Bizu",
};

export default function TermosPage() {
  return (
    <>
      <h1>Termos de Uso</h1>
      <p>
        <em>Última atualização: [DATA_DE_VIGÊNCIA]</em>
      </p>

      <h2>1. Aceitação</h2>
      <p>
        Ao criar uma conta ou usar o Bizu, você concorda com estes Termos. Se não
        concordar, não utilize o serviço.
      </p>

      <h2>2. O que é o Bizu</h2>
      <p>
        O Bizu é um assistente de conversa baseado em modelos de inteligência
        artificial. O serviço é fornecido por [RAZÃO_SOCIAL], CNPJ [CNPJ].
      </p>

      <h2>3. Sua conta</h2>
      <p>
        Você deve ter ao menos 18 anos, ou 13 anos com consentimento dos
        responsáveis. Você é responsável por manter sua senha em sigilo e por toda
        atividade realizada na sua conta.
      </p>

      <h2>4. Uso aceitável</h2>
      <p>Você concorda em não utilizar o Bizu para:</p>
      <ul>
        <li>praticar atos ilícitos ou violar direitos de terceiros;</li>
        <li>gerar conteúdo que explore ou coloque em risco menores de idade;</li>
        <li>produzir desinformação, spam ou conteúdo fraudulento;</li>
        <li>
          tentar contornar limites de uso, medidas de segurança ou realizar
          engenharia reversa do serviço.
        </li>
      </ul>

      <h2>5. Conteúdo gerado por IA</h2>
      <p>
        As respostas são geradas automaticamente e{" "}
        <strong>podem conter erros, imprecisões ou informações desatualizadas</strong>.
        Elas não constituem aconselhamento médico, jurídico ou financeiro. Confira
        informações importantes antes de agir com base nelas.
      </p>

      <h2>6. Planos e pagamento</h2>
      <p>
        O plano gratuito possui limites de uso. O plano pago é cobrado
        mensalmente em reais (R$), com renovação automática até o cancelamento. Você
        pode cancelar a qualquer momento e manterá o acesso até o fim do período já
        pago. [REVISAR_COM_ADVOGADO: direito de arrependimento de 7 dias — art. 49
        do Código de Defesa do Consumidor — e política de reembolso.]
      </p>

      <h2>7. Encerramento</h2>
      <p>
        Você pode excluir sua conta quando quiser. Podemos suspender contas que
        violem estes Termos.
      </p>

      <h2>8. Limitação de responsabilidade</h2>
      <p>
        [REVISAR_COM_ADVOGADO: cláusula de limitação de responsabilidade. O Código
        de Defesa do Consumidor restringe fortemente limitações em relações de
        consumo no Brasil — esta seção não deve ser copiada de modelos
        norte-americanos.]
      </p>

      <h2>9. Lei aplicável</h2>
      <p>
        Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro do
        domicílio do consumidor para dirimir controvérsias, nos termos do Código de
        Defesa do Consumidor.
      </p>

      <h2>10. Contato</h2>
      <p>
        Dúvidas: <a href="mailto:[EMAIL_DE_CONTATO]">[EMAIL_DE_CONTATO]</a>.
      </p>
    </>
  );
}
```

- [ ] **Step 4: Verify the routes resolve (they must stop 404ing)**

```bash
pnpm exec next build 2>&1 | grep -E "privacidade|termos"
```

Expected: both routes appear in the build's route table.

- [ ] **Step 5: Verify the auth pages' links now land**

```bash
grep -n "privacyUrl\|termsUrl" lib/i18n/messages.ts
```

Confirm they are `https://bizu.chat/privacidade` and `https://bizu.chat/termos` —
matching the new route paths. **If the app is not yet served at `bizu.chat`, these
absolute URLs will still fail locally**; note that in your report. Changing them to
relative paths (`/privacidade`, `/termos`) would fix local and preview
environments — flag it as a question rather than deciding unilaterally, since the
terms may need absolute URLs when referenced from e-mail later.

- [ ] **Step 6: Commit**

```bash
git add "app/(legal)" lib/i18n/messages.ts
git commit -m "feat: add /privacidade and /termos (LGPD draft, needs legal review)"
```

**Definition of Done for this task — every placeholder must be listed in the report:**
`[DATA_DE_VIGÊNCIA]`, `[RAZÃO_SOCIAL]`, `[CNPJ]`, `[ENDEREÇO_COMPLETO]`,
`[EMAIL_DE_PRIVACIDADE]`, `[NOME_DO_ENCARREGADO]`, `[EMAIL_DO_ENCARREGADO]`,
`[EMAIL_DE_CONTATO]`, and three `[REVISAR_COM_ADVOGADO]` markers.

---

## Task 6: Fix `gatewayOrder` — re-verify against the live catalog

**Files:**
- Modify: `lib/ai/models.ts` (the `gatewayOrder` arrays)

**Interfaces:**
- Consumes: nothing
- Produces: nothing

An audit found `gatewayOrder` names providers that **do not serve the model** on 3
of 5 entries — including `bedrock` listed **first on `deepseek/deepseek-v4-flash`**,
which is both the default chat model and the title model. It falls through to a
valid provider, so it works, but every default chat carries a dead first-choice
route and the stated preference is fiction.

**Do not trust the audit's provider lists — they are a snapshot and drift.**
Re-verify live.

- [ ] **Step 1: Fetch the real provider list, pricing and latency for each model**

**This endpoint is public — no `AI_GATEWAY_API_KEY` required** (verified
2026-07-15, returns HTTP 200 unauthenticated). It also returns per-provider
pricing, p50/p95 latency and uptime, so ordering can be a decision from data
rather than a guess.

```bash
for m in deepseek/deepseek-v4-flash alibaba/qwen3.5-flash deepseek/deepseek-v3.2 moonshotai/kimi-k2.5 alibaba/qwen3.6-plus; do
  echo "=== $m ==="
  curl -s "https://ai-gateway.vercel.sh/v1/models/$m/endpoints" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]; [print(f"  {e[\"provider_name\"]:12s} in=${e[\"pricing\"][\"prompt\"]} out=${e[\"pricing\"][\"completion\"]} p50={e[\"latency_last_1h\"][\"p50\"]}ms up1d={e[\"uptime_last_1d\"]}") for e in d["endpoints"]]'
done
```

**Record the full actual output in your report.** If a model returns a non-200 or
an empty endpoint list, **STOP and report BLOCKED** — do not guess provider names.

For reference, the default model's real providers as of 2026-07-15 were `azure,
deepinfra, deepseek, fireworks, novita` — **`bedrock`, currently listed first in
the code, does not serve it.** Confirm this yourself rather than trusting this
line; the data drifts.

- [ ] **Step 2: Correct each `gatewayOrder` from the data you just fetched**

Edit `lib/ai/models.ts` so every `gatewayOrder` names only providers that appeared
in Step 1's output for that model. If a model has only one real provider, the array
holds just that one.

**Ordering policy — Bizu's economics are the whole point of the product, so order
by cost first, then reliability:** put the cheapest provider first, unless its
`uptime_last_1d` is below ~99.5% or its p50 latency is more than ~2× the fastest,
in which case prefer the next cheapest that is healthy. State your reasoning per
model in the report — this is a judgement call on real numbers, not a lookup.

- [ ] **Step 3: Remove the dead `reasoningEffort` plumbing**

`ChatModel.reasoningEffort` is declared in `lib/ai/models.ts:27` but **no model sets
it**, so the `openai: { reasoningEffort }` branch at
`app/(chat)/api/chat/route.ts:301-303` never fires — and it is keyed under the
`openai` provider namespace, which would not apply to any of these Chinese models
even if set. Delete the field from the type and the dead branch from the route.

- [ ] **Step 4: Verify**

```bash
pnpm exec tsc --noEmit && pnpm check && pnpm test:unit && pnpm exec next build
```

Expected: all clean, 20/20 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/models.ts "app/(chat)/api/chat/route.ts"
git commit -m "fix: point gatewayOrder at providers that actually serve each model"
```

---

## Task 7: Translate the artifacts layer

**Files:**
- Modify: `artifacts/text/client.tsx`, `artifacts/code/client.tsx`, `artifacts/sheet/client.tsx`
- Modify: `components/chat/toolbar.tsx` (`READING_LEVELS` lines 46-52, "Fix error" line 308)
- Modify: `components/ai-elements/reasoning.tsx:158-165`
- Modify: `components/chat/multimodal-input.tsx:462`, `components/chat/version-footer.tsx:138,152`
- Modify: `lib/i18n/messages.ts`
- Delete: `artifacts/image/`

**The whole artifacts layer was never translated** — every toolbar label and,
worse, **every prompt string sent to the model** (e.g.
`artifacts/text/client.tsx:158` instructs the model in English: *"Please add final
polish and check for grammar…"*). `reasoning.tsx` shows **"Thinking..."** on 4 of 5
models. These are all user-visible in a pt-BR product.

- [ ] **Step 1: Delete the dead image artifact**

`artifacts/image/` has `client.tsx` but **no `server.ts`**;
`lib/artifacts/server.ts:89-95` excludes `"image"` from `artifactKinds`, so an
image document has no handler and `lib/ai/tools/create-document.ts:58` would throw
`No document handler found for kind: image`. The DB enum and the document route's
zod schema still accept it.

```bash
rm -rf artifacts/image
```

Then remove `"image"` from the document route's zod schema so it can no longer be
persisted. Find it:

```bash
grep -rn '"image"' "app/(chat)/api/document/route.ts" lib/db/schema.ts
```

**Leave `lib/db/schema.ts` alone** — changing the DB enum needs a migration and
belongs with a schema phase. Only tighten the zod schema at the route.

- [ ] **Step 2: Add the artifact copy to the catalog**

Add a `artifacts` namespace to `lib/i18n/messages.ts` covering every string you
find in Step 3. Include the **prompt bodies**, which must also be pt-BR so the
model is instructed in the user's language:

```ts
  artifacts: {
    addComments: "Adicionar comentários",
    addLogs: "Adicionar logs",
    addPolish: "Dar um acabamento final",
    addPolishPrompt:
      "Dê um acabamento final ao texto: revise a gramática, melhore a clareza e a estrutura. Responda em português do Brasil.",
    analyzeData: "Analisar e visualizar dados",
    copiedToClipboard: "Copiado!",
    copyToClipboard: "Copiar",
    executeCode: "Executar código",
    fixError: "Corrigir erro",
    formatData: "Formatar e limpar dados",
    requestSuggestions: "Pedir sugestões",
    restore: "Restaurar",
    showChanges: "Ver alterações",
    viewChanges: "Ver alterações",
  },
```

Extend this to cover every string Step 3 turns up — the list above is the shape,
not necessarily exhaustive.

- [ ] **Step 3: Find every English string in the artifacts layer**

```bash
grep -rnE '"[A-Z][a-z]+ [a-z]+[^"]*"' artifacts/ components/chat/toolbar.tsx components/chat/version-footer.tsx components/ai-elements/reasoning.tsx | grep -vE "className|import|from " | head -40
```

Work through the results. Every user-visible string and every prompt body sent to
the model must come from `ui.artifacts.*`. Do not translate variable names, CSS
classes, or `aria-label` keys used as test selectors — check
`tests/` before changing any `aria-label` or visible text that a Playwright spec
asserts on:

```bash
grep -rn "getByRole\|getByText\|getByLabel" tests/ | head -20
```

- [ ] **Step 4: Translate `READING_LEVELS` and reasoning labels**

`components/chat/toolbar.tsx:46-52` has "Elementary", "Middle School", "Keep
current level", "High School", "College", "Graduate". Brazilian schooling has no
1:1 mapping — use the local ladder rather than a literal translation:

```ts
const READING_LEVELS = [
  "Ensino fundamental I",
  "Ensino fundamental II",
  "Manter o nível atual",
  "Ensino médio",
  "Graduação",
  "Pós-graduação",
];
```

`components/ai-elements/reasoning.tsx:158-165`: "Thinking..." → `"Pensando..."`,
"Thought for {n} seconds" → `"Pensou por {n} segundos"`. Note the catalog has no
interpolation — build the string in the component from a catalog prefix/suffix, or
add a small formatter. Say which you chose in your report.

- [ ] **Step 5: Verify no English user-facing copy survives in these files**

```bash
grep -rniE '"(view|copy|add|execute|format|analyze|fix|restore|show|thinking|thought|previous|next|upload|editing) ' artifacts/ components/chat/toolbar.tsx components/chat/version-footer.tsx components/ai-elements/reasoning.tsx components/chat/multimodal-input.tsx; echo "exit=$?"
```

Expected: no output, `exit=1`.

- [ ] **Step 6: Verify**

```bash
pnpm exec tsc --noEmit && pnpm check && pnpm exec next build
```

- [ ] **Step 7: Commit**

```bash
git add artifacts components lib/i18n/messages.ts "app/(chat)/api/document/route.ts"
git commit -m "feat: translate the artifacts layer to pt-BR"
```

---

## Task 8: Automated brand-leak guard (RUN LAST)

**Files:**
- Create: `lib/brand-guard.test.ts`

**Interfaces:**
- Consumes: the results of Tasks 1–7.

Tasks 1–7 remove the leaks once. This makes them **stay** removed. Without it, the
next `git merge upstream` or a copy-pasted component silently reintroduces
"Deploy with Vercel". This is the only Phase 1 task with a real test, and it is
what makes the phase durable.

- [ ] **Step 1: Write the failing test**

Create `lib/brand-guard.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app", "components", "lib", "artifacts"];
const EXTENSIONS = [".ts", ".tsx"];

// Strings that must never reach a Bizu user.
const FORBIDDEN = [
  "Deploy with Vercel",
  "VercelIcon",
  "vercel.com/templates",
  "AI Chatbot Starter Template",
  "Activate AI Gateway",
  "add-credit-card",
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (EXTENSIONS.some((e) => full.endsWith(e))) {
      // This guard file necessarily contains the forbidden strings.
      if (!full.endsWith("brand-guard.test.ts")) {
        out.push(full);
      }
    }
  }
  return out;
}

describe("brand guard", () => {
  const files = ROOTS.flatMap((r) => sourceFiles(r));

  it("scans a non-trivial number of files", () => {
    // Guards against a broken walker silently passing.
    expect(files.length).toBeGreaterThan(50);
  });

  for (const forbidden of FORBIDDEN) {
    it(`never ships "${forbidden}"`, () => {
      const offenders = files.filter((f) =>
        readFileSync(f, "utf8").includes(forbidden)
      );
      expect(offenders).toEqual([]);
    });
  }
});
```

- [ ] **Step 2: Run it**

```bash
pnpm test:unit lib/brand-guard.test.ts
```

Expected: **PASS** — Tasks 1, 2 and 3 already removed every forbidden string. If
any test FAILS, that task missed something: fix the source, not the test.

- [ ] **Step 3: Prove the guard is not vacuous**

A guard that cannot fail is worthless. Verify it catches a real leak:

```bash
printf '\nexport const LEAK = "Deploy with Vercel";\n' >> lib/constants.ts
pnpm test:unit lib/brand-guard.test.ts
```

Expected: **FAIL**, naming `lib/constants.ts`. Now revert:

```bash
git checkout lib/constants.ts
pnpm test:unit lib/brand-guard.test.ts
```

Expected: PASS again. **Report both outputs** — if the guard did not fail in the
middle step, it is broken and this task is not done.

- [ ] **Step 4: Verify the full suite**

```bash
pnpm test:unit && pnpm check && pnpm exec tsc --noEmit && pnpm exec next build
```

Expected: all pass (20 Phase 0 tests + the new guard tests).

- [ ] **Step 5: Commit**

```bash
git add lib/brand-guard.test.ts
git commit -m "test: guard against Vercel branding regressions"
```

---

## Definition of Done

- [ ] No "Deploy with Vercel" button; no `VercelIcon` anywhere
- [ ] `app/icon.tsx`, `opengraph-image.tsx`, `twitter-image.tsx` render; all three
      stock PNGs and the three unused `public/` images are gone
- [ ] `/privacidade` and `/termos` resolve — the signup links no longer 404
- [ ] Users see a generic PT-BR outage message, never Vercel's billing state
- [ ] Starter prompts are Brazilian-consumer, not Vercel's
- [ ] Artifacts layer is pt-BR, **including the prompts sent to the model**
- [ ] `gatewayOrder` verified against the live catalog
- [ ] `pnpm test:unit`, `pnpm check`, `tsc --noEmit`, `next build` all pass
- [ ] The brand guard is proven non-vacuous

**Carried forward:**
- **The legal text is an unreviewed draft with 8 placeholders + 3
  `[REVISAR_COM_ADVOGADO]` markers. Phase 5 must not take money until a lawyer has
  signed off.** → Phase 5 gate
- Chat pages are a client-only SPA shell (`page.tsx` returns `null`), so **shared
  chat links still have no per-chat OG tags** — the Task 2 image is site-wide only.
  Fixing that means undoing the shell. → deferred
- `lib/db/schema.ts` still accepts `kind: "image"` though the handler is gone; the
  zod route schema now rejects it. Removing the enum value needs a migration.
  → a later schema phase
