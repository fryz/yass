import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailVerifications, events } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";
import { sealSession } from "@/lib/session";

const RequestSchema = z.object({
  email: z.string().email(),
  otp_code: z.string().length(6),
  eventId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request. Provide email, otp_code, and eventId." },
      { status: 400 }
    );
  }

  const { email, otp_code, eventId } = parsed.data;

  // Check event is still open
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  if (event.status !== "open" || new Date(event.signupClosesAt) <= new Date()) {
    return NextResponse.json(
      { error: "This event is no longer accepting signups." },
      { status: 409 }
    );
  }

  // Look up unexpired, unused OTP for this email
  const now = new Date();
  const verification = await db.query.emailVerifications.findFirst({
    where: and(
      eq(emailVerifications.email, email),
      eq(emailVerifications.otpCode, otp_code),
      eq(emailVerifications.used, false),
      gt(emailVerifications.expiresAt, now)
    ),
    orderBy: (ev, { desc }) => [desc(ev.createdAt)],
  });

  if (!verification) {
    // Check if there's an expired one to give a better message
    const expiredVerification = await db.query.emailVerifications.findFirst({
      where: and(
        eq(emailVerifications.email, email),
        eq(emailVerifications.otpCode, otp_code),
        eq(emailVerifications.used, false)
      ),
    });

    if (expiredVerification) {
      return NextResponse.json(
        { error: "This code has expired. Please request a new one." },
        { status: 410 }
      );
    }

    return NextResponse.json(
      { error: "Invalid code. Please try again." },
      { status: 400 }
    );
  }

  // Mark OTP as used
  await db
    .update(emailVerifications)
    .set({ used: true })
    .where(eq(emailVerifications.id, verification.id));

  // Set signed, sealed HttpOnly session cookie (iron-session)
  const sealed = await sealSession({ email, verified: true, eventId });

  const response = NextResponse.json({ success: true });
  response.cookies.set("yass_attendee_session", sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60, // 1 hour
    path: "/",
  });

  return response;
}
