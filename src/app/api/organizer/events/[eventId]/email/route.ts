import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { events, eventSeries, signups, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { sendEmail } from "@/lib/novu";

const BodySchema = z.object({
  subject: z.string().min(1),
  message: z.string().min(1),
});

function getUserRoles(session: { user: Record<string, unknown> }): string[] {
  return (
    (session.user["https://yass.app/roles"] as string[] | undefined) ??
    (session.user["roles"] as string[] | undefined) ??
    []
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  const session = await auth0.getSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Subject and message are required." },
      { status: 400 }
    );
  }

  const { subject, message } = parsed.data;

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  // Check ownership
  const series = await db.query.eventSeries.findFirst({
    where: eq(eventSeries.id, event.seriesId),
  });
  const organizerUser = await db.query.users.findFirst({
    where: eq(users.email, session.user.email!),
  });
  const roles = getUserRoles(session);
  const isAdmin = roles.includes("admin");
  const isOwner = organizerUser && series?.organizerId === organizerUser.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Fetch all confirmed attendees
  const confirmedSignups = await db
    .select({
      userName: users.name,
      userEmail: users.email,
    })
    .from(signups)
    .innerJoin(users, eq(signups.userId, users.id))
    .where(and(eq(signups.eventId, eventId), eq(signups.status, "confirmed")));

  const eventDateStr = new Date(event.eventDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Send emails fire-and-forget
  let sentCount = 0;
  for (const attendee of confirmedSignups) {
    await sendEmail(attendee.userEmail, "event_update", {
      name: attendee.userName,
      event_name: event.name,
      event_date: eventDateStr,
      subject,
      message,
    });
    sentCount++;
  }

  return NextResponse.json({ success: true, sentCount });
}
