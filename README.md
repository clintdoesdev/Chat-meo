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

Connecting a bot to WhatsApp (the "WhatsApp" tab in a bot's settings) uses Meta's Embedded
Signup flow and needs four environment variables. Without them, the tab shows a "not configured"
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

Add all four to `.env` (see `.env.example`) and restart the dev server.
