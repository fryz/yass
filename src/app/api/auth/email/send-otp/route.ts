import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailVerifications, events } from "@/db/schema";
import { eq, and, gte, count } from "drizzle-orm";
import { sendEmail } from "@/lib/novu";
import { z } from "zod";

const RequestSchema = z.object({
  email: z.string().email(),
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
      { error: "Invalid request. Provide a valid email and eventId." },
      { status: 400 }
    );
  }

  const { email, eventId } = parsed.data;

  // Check event exists and is open
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

  // Rate limit: max 5 OTP sends per email per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [recentCount] = await db
    .select({ value: count() })
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.email, email),
        gte(emailVerifications.createdAt, oneHourAgo)
      )
    );

  if (recentCount.value >= 5) {
    return NextResponse.json(
      { error: "Too many verification attempts. Please wait before trying again." },
      { status: 429 }
    );
  }

  // Generate 6-digit OTP (cryptographically secure)
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  const otpCode = (bytes[0] % 900000 + 100000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Insert OTP record
  await db.insert(emailVerifications).values({
    email,
    otpCode,
    expiresAt,
    used: false,
  });

  // Send OTP via Novu (fire-and-forget)
  await sendEmail(email, "otp", {
    email,
    otp_code: otpCode,
    expires_in_minutes: 10,
  });

  return NextResponse.json({ success: true });
}
