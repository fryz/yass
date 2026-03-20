# YASS — Yet Another Simple Signup

Fair event signups without the cognitive overhead. No bots, no refresh wars, no repeat attendees hogging spots.

---

## What Is This?

YASS is a Next.js web app for managing signups to recurring community events. The key idea: organizers configure a **selection algorithm** for each event, and the system runs it automatically at signup close time. Attendees don't need accounts — email OTP verification is the only identity anchor.

**Selection algorithms:**
- **FCFS** — First Come, First Served. Simple queue by signup time.
- **Lottery** — Random draw from all submitted signups.
- **Lottery with Preference** — Weighted lottery; attendees who missed out on recent events get higher weight via *preference points*.
- **FCFS with Preference** — FCFS ordering, but preference points let people who missed out "cut in line."

**Preference points** accumulate per-user per-series when someone is waitlisted or doesn't get in, and are consumed when they are selected. This creates a fair rotation over time.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| UI | ShadCN UI + Tailwind CSS |
| Database | PostgreSQL via Neon (serverless) |
| ORM | Drizzle ORM |
| Auth | Auth0 (Google OAuth) for organizers/admins; email OTP for attendees |
| Email | Novu |
| Analytics | PostHog |
| Hosting | Vercel |

---

## Local Development

### Prerequisites

- Node.js 18+
- A Neon (or any Postgres) database
- Auth0 tenant
- Novu account

### 1. Clone and install

```bash
git clone <repo>
cd yass
npm install
```

### 2. Set up environment variables

Copy `.env.local` and fill in the values:

```bash
cp .env.local.example .env.local  # or edit .env.local directly
```

Required variables:

```env
# Neon PostgreSQL
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require

# Auth0
AUTH0_SECRET=<32-char random string>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://<your-tenant>.auth0.com
AUTH0_CLIENT_ID=<your-client-id>
AUTH0_CLIENT_SECRET=<your-client-secret>

# Novu
NOVU_API_KEY=<your-novu-api-key>
NOVU_APP_ID=<your-novu-app-id>

# PostHog (optional in dev)
NEXT_PUBLIC_POSTHOG_KEY=<your-posthog-key>
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Cron security
CRON_SECRET=<random secret for cron endpoint>
```

### 3. Run database migrations

```bash
npm run db:generate
npm run db:migrate
```

### 4. Seed initial data

```bash
npm run db:seed
```

This creates a "Basic" form template (name, email, attendees fields).

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Key Concepts

### Selection Algorithms

When signup closes, the `/api/cron/run-selection` endpoint is called (or an organizer triggers it manually). It:

1. Fetches all `submitted` signups for the event.
2. Applies the configured algorithm to produce a list of `confirmed` and `waitlisted` signups.
3. Writes `signup_proposals` with the proposed outcomes.
4. Organizers can review and adjust proposals before finalizing.
5. On finalize, `signups.status` is updated and Novu notifications are sent.

### Preference Points

- Stored in `preference_points` (userId + seriesId + points).
- Incremented when a user is waitlisted after selection.
- Decremented (or reset) when a user is selected.
- Used as weights in `lottery_preference` and as queue-position adjustments in `fcfs_preference`.

### Attendee Identity

Attendees are identified by email only. On signup they get an OTP to verify their email. No password or OAuth is required. Their signup status page is accessible via a tokenized link (`/my-signup/:cancelToken`) emailed to them.

---

## Deployment

### Vercel

1. Connect the repo to Vercel.
2. Add all environment variables in the Vercel dashboard.
3. The Neon database can be provisioned directly through the Vercel Neon integration.

### Cron Job

Set up a daily cron (e.g. Vercel Cron) to call:

```
GET /api/cron/run-selection
Authorization: Bearer <CRON_SECRET>
```

This auto-closes and runs selection for events whose `signup_closes_at` has passed.

### Auth0 Setup

1. Create an Auth0 application (Regular Web App).
2. Add `http://localhost:3000/auth/callback` (dev) and your production URL to Allowed Callback URLs.
3. Add `http://localhost:3000` to Allowed Logout URLs.
4. To assign roles, use the Admin panel at `/admin/users` after setting up your first admin via Auth0 Actions or the Management API.

Custom claims for roles should be injected in an Auth0 Action (Post-Login trigger):

```js
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://yass.app';
  const roles = event.authorization?.roles ?? [];
  api.idToken.setCustomClaim(`${namespace}/roles`, roles);
  api.accessToken.setCustomClaim(`${namespace}/roles`, roles);
};
```

---

## Project Structure

```
src/
  app/
    admin/          # Admin-only pages (all events, user management)
    organizer/      # Organizer pages (events, series, forms, attendees)
    events/         # Public event browsing + signup flow
    my-signup/      # Attendee status page (tokenized)
    api/            # API routes
  components/       # Shared UI components
  db/               # Drizzle schema, client, and seed
  lib/
    auth0.ts        # Auth0 client
    novu.ts         # Novu client
    schemas/        # Zod schemas (form fields, responses)
    selection/      # Selection algorithm implementations + tests
```
