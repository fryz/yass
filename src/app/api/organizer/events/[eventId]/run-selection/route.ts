import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { events, eventSeries, signupProposals, signups, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runSelectionForEvent } from "@/lib/selection/runSelection";
import { getOrUpsertOrganizerUser } from "@/lib/get-organizer-user";

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

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  // Check authorization
  const series = await db.query.eventSeries.findFirst({
    where: eq(eventSeries.id, event.seriesId),
  });
  const organizerUser = await getOrUpsertOrganizerUser(session.user);
  const roles = getUserRoles(session);
  const isAdmin = roles.includes("admin");
  const isOwner = organizerUser && series?.organizerId === organizerUser.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (event.status !== "closed" && event.status !== "proposed") {
    return NextResponse.json(
      {
        error: `Event must be in 'closed' or 'proposed' status to run selection. Current status: '${event.status}'.`,
      },
      { status: 409 }
    );
  }

  try {
    const result = await runSelectionForEvent(eventId);

    // Fetch the resulting proposals with signup info
    const proposals = await db
      .select({
        proposalId: signupProposals.id,
        signupId: signupProposals.signupId,
        proposedStatus: signupProposals.proposedStatus,
        manuallyAdjusted: signupProposals.manuallyAdjusted,
        signedUpAt: signups.signedUpAt,
        userId: signups.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(signupProposals)
      .innerJoin(signups, eq(signupProposals.signupId, signups.id))
      .innerJoin(users, eq(signups.userId, users.id))
      .where(eq(signupProposals.eventId, eventId));

    return NextResponse.json({
      ...result,
      proposals,
    });
  } catch (err) {
    console.error("run-selection error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Selection failed." },
      { status: 500 }
    );
  }
}
