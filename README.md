# Chatmeo

Visual chatbot-builder SaaS.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- Prisma ORM + PostgreSQL (Railway)
- NextAuth v5 (credentials + Google)
- Deploy target: Vercel

## Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — ESLint

## WhatsApp Business setup

Connecting a bot to WhatsApp (the "WhatsApp" card in a bot's Deploy & channels tab) uses Meta's
Embedded Signup flow, driven as a **full-page redirect** rather than the Facebook JS SDK's popup
— the popup depends on a live `window.opener` reference back to the tab that opened it, which
mobile browsers frequently break silently (the signup completes on Meta's side, but the
originating tab never hears about it). A redirect has no such dependency: clicking "Connect
WhatsApp" navigates to `/api/whatsapp/connect/start`, which sends the browser to Meta, and Meta
sends it straight back to `/api/whatsapp/connect/callback` when done — see
`src/lib/whatsapp/meta-graph.ts`'s `buildEmbeddedSignupUrl`.

This needs four environment variables. Without them, the WhatsApp card shows a "not configured"
message instead of a connect button.

1. Create (or open) an app at the [Meta App Dashboard](https://developers.facebook.com/apps) and
   add the **WhatsApp** product.
2. **`META_APP_ID`** — App Dashboard → Settings → Basic → *App ID*.
3. **`META_APP_SECRET`** — same page, *App Secret* (click "Show"). Server-only — never sent to
   the browser.
4. **`META_CONFIG_ID`** — App Dashboard → WhatsApp → Embedded Signup → Configurations → create a
   configuration (Coexistence is the recommended default so sellers keep their existing WhatsApp
   Business App and chat history) → copy its configuration ID.
5. **`WHATSAPP_TOKEN_ENCRYPTION_KEY`** — encrypts the long-lived access token Meta issues before
   it's stored (`src/lib/crypto.ts`). Generate one locally:
   ```bash
   openssl rand -base64 33
   ```
6. **Register the redirect URI** — under **Facebook Login for Business → Settings → Client
   OAuth settings**, add `https://<your-domain>/api/whatsapp/connect/callback` to **Valid OAuth
   Redirect URIs**, then Save. This must match exactly (scheme, host, path) or Meta rejects the
   redirect outright. ("Login with the JavaScript SDK" and its allowed-domains field are *not*
   needed for this flow — they're only relevant if something else in the app used the JS SDK's
   popup login, which nothing does.)

Add all four env vars to `.env` (see `.env.example`) and restart the dev server.

### Inbound webhook

Once a bot is connected, `src/app/api/webhooks/whatsapp/route.ts` is the single endpoint that
receives messages for *every* connected bot — Meta routes each delivery to the right bot itself
via `phone_number_id`, so there's nothing per-bot to configure here beyond the one-time webhook
setup below.

1. **`WHATSAPP_WEBHOOK_VERIFY_TOKEN`** — a string you make up yourself (not from Meta). Generate
   one locally:
   ```bash
   openssl rand -hex 24
   ```
2. In the App Dashboard → WhatsApp → Configuration → Webhook, set the callback URL to
   `https://<your-domain>/api/webhooks/whatsapp` and paste the same token into "Verify token".
   Meta immediately calls the URL with `hub.mode=subscribe`; the route echoes `hub.challenge`
   back only if the token matches, which confirms the subscription.
3. Under "Webhook fields", subscribe to **messages** (required) and **account_update**
   (optional but recommended — it's what lets the app detect a WABA ban and email you; see
   below). No other field is read.

### Ban alert email

If **account_update** is subscribed above, `processAccountEvent` in the webhook route watches
for Meta disabling a connected WABA and, when it sees one, marks that bot's connection
`BANNED` (pausing it automatically) and emails the bot owner via the existing Resend setup
(`RESEND_API_KEY`/`EMAIL_FROM` in `.env.example` — already used for verification/2FA/security
emails, nothing extra to configure here). It emails again, and un-pauses the bot, if Meta
later reinstates the WABA. This is best-effort: Meta doesn't publish a machine-checkable schema
for `account_update`, so the parser (`extractAccountEvents` in
`src/lib/whatsapp/webhook-payload.ts`) only acts on the two states documented with reasonable
confidence (`banned_info.waba_ban_state: "DISABLE"`/`"REINSTATE"`, or a bare `event: "DISABLED"`)
rather than guessing at the rest — it has not been verified against a live delivery.

This is a local-network-only deployment, so Meta can't reach `localhost` directly for either the
verification handshake or live delivery; testing the inbound flow end-to-end requires a real
public HTTPS URL (e.g. a Vercel deploy, or a tunnel like ngrok pointed at your dev server).
