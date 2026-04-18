# YASS — Yet Another Simple Signup

Fair event signups for recurring community events. No bots, no refresh wars, no repeat attendees hogging spots.

---

## What is YASS?

YASS is a signup management service for organizers who run recurring events — hiking groups, dinner clubs, classes, workshops, anything with limited capacity and a regular crowd.

The core problem it solves: when spots are limited and demand is high, signups become stressful and unfair. Fast-clickers win. Regulars shut out newcomers. The same people get in every time.

YASS fixes this by letting organizers choose a **selection algorithm** for each event. Instead of a race, signups are collected during an open window and then the system picks attendees fairly based on the rules you set.

---

## How It Works

### For attendees

1. Browse open events and click **Sign Up**.
2. Verify your email with a 6-digit code — no account, no password required.
3. Fill out the signup form and submit.
4. Wait for the organizer to close and run selection.
5. Receive an email telling you if you're confirmed, waitlisted, or didn't make it.
6. Manage or cancel your signup anytime via the link in your email.

### For organizers

1. Create an **event series** (e.g. "Tuesday Night Hikes").
2. Add individual **events** to the series with a date, capacity, and signup deadline.
3. Publish the event — signups open immediately.
4. When the deadline passes, run **selection** to generate a proposed attendee list.
5. Review and optionally adjust the proposals, then **finalize** — confirmed and waitlisted attendees are notified by email.

Selection also runs automatically overnight, so events with passed deadlines are handled without manual intervention.

---

## Selection Algorithms

Organizers pick one of four algorithms per event:

| Algorithm | How it works |
|-----------|-------------|
| **First Come, First Served** | Signups are confirmed in the order received. Simple queue. |
| **Lottery** | Confirmed spots are drawn randomly from all submitted signups. Everyone has equal odds. |
| **Lottery with Preference** | Weighted lottery. Attendees who missed out on recent events in this series get higher odds. |
| **FCFS with Preference** | Queue ordering, but preference points let people who've been shut out recently move up the line. |

### Preference Points

Preference points make the preference algorithms work. They're tracked per-person per-series:

- You **earn** a point each time you're waitlisted or don't get selected.
- Your points are **spent** (reset to zero) when you're confirmed.

Over time, this creates a natural rotation — people who've been left out keep accumulating weight until they get in.

---

## Roles

**Attendees** — anyone with an email address. No account required.

**Organizers** — log in via Google to access the organizer dashboard. Can create and manage series, events, and forms, and run selection.

**Admins** — full access including the admin panel (all events across all organizers, user management).

---

## Signup Lifecycle

```
submitted → (selection runs) → confirmed
                             → waitlisted → (cancellation opens a spot) → confirmed
                             → cancelled (by attendee at any time)
```

Confirmed attendees who cancel automatically promote the next person on the waitlist.

---

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon recommended)
- Auth0 tenant
- Novu account (for workflow orchestration)
- An email delivery provider connected to Novu (e.g. [Brevo](https://brevo.com) — free tier, no domain verification required)

### Setup

```bash
git clone <repo>
cd yass
npm install
cp .env.local.example .env.local   # fill in your credentials
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```env
DATABASE_URL=postgresql://...

AUTH0_SECRET=<random 32-char string>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://<tenant>.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...

NOVU_SECRET_KEY=...              # from Novu dashboard → API Keys
SESSION_SECRET=<random 32-char string>  # used to seal attendee session cookies

NEXT_PUBLIC_POSTHOG_KEY=...          # optional
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

CRON_SECRET=<random string>
```

---

## Deployment

Deploy to Vercel. Connect the repo, add environment variables, and optionally provision Neon and Auth0 via the Vercel marketplace integrations.

### Novu + Resend configuration

YASS uses Novu for email workflow orchestration. Novu's built-in test provider can only send to the Novu account owner — you must connect a real email provider before emails will reach attendees.

1. Create a [Brevo](https://brevo.com) account (free tier supports 300 emails/day, no domain verification required).
2. In the Novu dashboard → **Integrations** → **Add provider** → select **Brevo** → paste your API key.
3. Set Brevo as the active provider for the Email channel and configure a from address.

Novu workflows are managed in the Novu dashboard. Create workflows with these exact identifiers:

| Workflow ID | Trigger |
|---|---|
| `otp` | OTP verification code sent to attendee |
| `signup_received` | Attendee submits a signup |
| `selection_confirmed` | Attendee is confirmed after selection runs |
| `selection_waitlisted` | Attendee is waitlisted after selection runs |
| `waitlist_promoted` | Waitlisted attendee is promoted when a confirmed attendee cancels |
| `cancellation_confirmed` | Attendee cancels their signup |
| `event_update` | Organizer sends a custom message to confirmed attendees |
| `organizer_selection_complete` | Organizer is notified after finalization |

Each workflow receives relevant payload variables (name, event_name, event_date, cancel_url, etc.) — check the corresponding API route for the exact payload shape.

### Auth0 configuration

Create a Regular Web App in Auth0 and add your callback and logout URLs. To give users organizer or admin access, assign roles in Auth0 and add a Post-Login Action that injects them into the token:

```js
exports.onExecutePostLogin = async (event, api) => {
  const roles = event.authorization?.roles ?? [];
  api.idToken.setCustomClaim('https://yass.app/roles', roles);
  api.accessToken.setCustomClaim('https://yass.app/roles', roles);
};
```

Then assign roles to your user in the Auth0 dashboard and use `/admin/users` to manage YASS-level roles after your first login.
