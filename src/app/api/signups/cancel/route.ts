import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { signups, events, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { sendEmail } from "@/lib/novu";

export async function DELETE(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Missing cancel token." },
      { status: 400 }
    );
  }

  // Fetch signup by cancel_token
  const signup = await db.query.signups.findFirst({
    where: eq(signups.cancelToken, token),
  });

  if (!signup) {
    return NextResponse.json(
      { error: "Signup not found." },
      { status: 404 }
    );
  }

  if (signup.status === "cancelled") {
    return NextResponse.json(
      { error: "This signup has already been cancelled." },
      { status: 409 }
    );
  }

  const wasConfirmed = signup.status === "confirmed";

  const event = await db.query.events.findFirst({
    where: eq(events.id, signup.eventId),
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, signup.userId),
  });

  // Execute cancellation in a transaction
  // If was confirmed and event is finalized, promote next waitlisted signup
  let promotedSignupId: string | null = null;
  let promotedUser: typeof user | null = null;

  // neon-http adapter doesn't support true transactions with FOR UPDATE SKIP LOCKED,
  // but we use a sequential approach to minimize race window.
  // For production, swap to neon websocket driver + db.transaction().

  // Step 1: Cancel the signup
  await db
    .update(signups)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(signups.cancelToken, token));

  // Step 2: If was confirmed and event is finalized, promote next waitlisted signup
  if (wasConfirmed && event.status === "finalized") {
    const nextWaitlisted = await db.query.signups.findFirst({
      where: and(
        eq(signups.eventId, signup.eventId),
        eq(signups.status, "waitlisted")
      ),
      orderBy: (s, { asc }) => [asc(s.signedUpAt)],
    });

    if (nextWaitlisted) {
      await db
        .update(signups)
        .set({ status: "confirmed", updatedAt: new Date() })
        .where(eq(signups.id, nextWaitlisted.id));

      promotedSignupId = nextWaitlisted.id;
      promotedUser = await db.query.users.findFirst({
        where: eq(users.id, nextWaitlisted.userId),
      });
    }
  }

  // After "transaction": send emails (fire-and-forget)
  const cancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/my-signup/${token}`;
  const userName = user?.name ?? user?.email ?? "Attendee";

  if (!user?.email) {
    console.error(`cancel: no user email for signup ${signup.id}, skipping cancellation email`);
  } else {
    await sendEmail(user.email, "cancellation_confirmed", {
      name: userName,
      event_name: event.name,
      cancel_url: cancelUrl,
    });
  }

  if (promotedSignupId && promotedUser) {
    const promotedSignup = await db.query.signups.findFirst({
      where: eq(signups.id, promotedSignupId),
    });
    if (promotedSignup) {
      const promotedCancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/my-signup/${promotedSignup.cancelToken}`;
      await sendEmail(promotedUser.email, "waitlist_promoted", {
        name: promotedUser.name,
        event_name: event.name,
        event_date: new Date(event.eventDate).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        cancel_url: promotedCancelUrl,
      });
    }
  }

  return NextResponse.json({ success: true });
}
