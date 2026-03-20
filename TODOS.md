# YASS TODOs

Captured during /plan-eng-review on 2026-03-20.

---

## ~~TODO: OTP Rate Limiting~~ ✅ DONE

**Completed:** 2026-03-20

Implemented in `src/app/api/auth/email/send-otp/route.ts` — max 5 OTP sends per email per hour using a COUNT query on `email_verifications`.

---

## TODO: Organizer Event Series Transfer

**What:** Allow an admin to transfer ownership of an event series from one organizer to another by updating `event_series.organizer_id`.

**Why:** If an organizer leaves a community, their event series becomes stranded — only they can manage it, but they're gone. An admin transfer path prevents data orphaning.

**Pros:** Operational resilience for long-running series (hiking clubs, leagues, etc.) that outlive individual organizers.

**Cons:** Low priority for a small side project. Probably not needed until you have multiple active organizers.

**Context:** The `event_series` table already has `organizer_id`. Implementation is a simple admin API: `PATCH /api/admin/event-series/[id]/transfer` with `{ new_organizer_id }`. Add to the Admin Flow (Phase 5) dashboard.

**Depends on / blocked by:** Phase 5 admin flow (user management + event series management).
