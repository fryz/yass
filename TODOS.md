# YASS TODOs

Captured during /plan-eng-review on 2026-03-20.

---

## ~~TODO: OTP Rate Limiting~~ DONE

> Implemented in `src/app/api/auth/email/send-otp/route.ts` — max 5 OTP sends per email per hour using a COUNT query on `email_verifications`.

## TODO: OTP Rate Limiting (archived)

**What:** Limit how many OTP requests a single email can make per hour (suggested: max 5 per hour per email).

**Why:** Without this, `POST /api/auth/email/send-otp` can be abused to spam any email address with verification codes.

**Pros:** Prevents email spam abuse. Cheap to implement using the existing `email_verifications` table — just count recent requests per email within the time window before inserting a new OTP row.

**Cons:** Adds a small amount of complexity. Could temporarily block a legitimate user who repeatedly mistyped their email (though they can wait out the window).

**Context:** The `email_verifications` table already has `created_at`. Query: `COUNT(*) WHERE email = ? AND created_at > NOW() - INTERVAL '1 hour'`. No Redis or external rate limiter needed.

**Depends on / blocked by:** Phase 2 OTP flow implementation (`/api/auth/email/send-otp`).

---

## TODO: Organizer Event Series Transfer

**What:** Allow an admin to transfer ownership of an event series from one organizer to another by updating `event_series.organizer_id`.

**Why:** If an organizer leaves a community, their event series becomes stranded — only they can manage it, but they're gone. An admin transfer path prevents data orphaning.

**Pros:** Operational resilience for long-running series (hiking clubs, leagues, etc.) that outlive individual organizers.

**Cons:** Low priority for a small side project. Probably not needed until you have multiple active organizers.

**Context:** The `event_series` table already has `organizer_id`. Implementation is a simple admin API: `PATCH /api/admin/event-series/[id]/transfer` with `{ new_organizer_id }`. Add to the Admin Flow (Phase 5) dashboard.

**Depends on / blocked by:** Phase 5 admin flow (user management + event series management).
