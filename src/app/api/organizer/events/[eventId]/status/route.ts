import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { events, eventSeries, signups, users } from "@/db/schema";
import { eq, and, ne, count } from "drizzle-orm";
import { z } from "zod";

const PatchSchema = z.object({
  action: z.enum(["publish", "close", "reopen_draft"]),
});

function getUserRoles(session: { user: Record<string, unknown> }): string[] {
  return (
    (session.user["https://yass.app/roles"] as string[] | undefined) ??
    (session.user["roles"] as string[] | undefined) ??
    []
  );
}

export async function PATCH(
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

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const { action } = parsed.data;

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const series = await db.query.eventSeries.findFirst({
    where: eq(eventSeries.id, event.seriesId),
  });

  // Authorization: organizer must own the series, or be admin
  const organizerUser = await db.query.users.findFirst({
    where: eq(users.email, session.user.email!),
  });
  const roles = getUserRoles(session);
  const isAdmin = roles.includes("admin");
  const isOwner = organizerUser && series?.organizerId === organizerUser.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Validate state machine transitions
  const currentStatus = event.status;

  if (action === "publish") {
    if (currentStatus !== "draft") {
      return NextResponse.json(
        { error: `Cannot publish event in '${currentStatus}' status.` },
        { status: 409 }
      );
    }
    await db
      .update(events)
      .set({ status: "open", updatedAt: new Date() })
      .where(eq(events.id, eventId));
  } else if (action === "close") {
    if (currentStatus !== "open") {
      return NextResponse.json(
        { error: `Cannot close event in '${currentStatus}' status.` },
        { status: 409 }
      );
    }
    await db
      .update(events)
      .set({ status: "closed", updatedAt: new Date() })
      .where(eq(events.id, eventId));
  } else if (action === "reopen_draft") {
    if (currentStatus !== "open") {
      return NextResponse.json(
        { error: `Can only reopen to draft from 'open' status.` },
        { status: 409 }
      );
    }
    // Only allowed if no submitted signups exist
    const [{ cnt }] = await db
      .select({ cnt: count() })
      .from(signups)
      .where(
        and(
          eq(signups.eventId, eventId),
          ne(signups.status, "cancelled")
        )
      );
    if (Number(cnt) > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot unpublish event: signups already exist. Close signups instead.",
        },
        { status: 409 }
      );
    }
    await db
      .update(events)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(events.id, eventId));
  }

  const updated = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  return NextResponse.json({ event: updated });
}
