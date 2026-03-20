import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { events, eventSeries, signupProposals, signups, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getOrUpsertOrganizerUser } from "@/lib/get-organizer-user";

const PatchSchema = z.object({
  proposed_status: z.enum(["proposed_confirmed", "proposed_waitlisted"]),
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
  { params }: { params: Promise<{ proposalId: string }> }
) {
  const { proposalId } = await params;

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
    return NextResponse.json({ error: "Invalid proposed_status." }, { status: 400 });
  }

  const { proposed_status } = parsed.data;

  // Fetch the proposal to verify it exists
  const proposal = await db.query.signupProposals.findFirst({
    where: eq(signupProposals.id, proposalId),
  });
  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
  }

  // Check that the event is in 'proposed' or 'finalized' status
  const event = await db.query.events.findFirst({
    where: eq(events.id, proposal.eventId),
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  if (event.status !== "proposed") {
    return NextResponse.json(
      { error: "Can only adjust proposals for events in 'proposed' status." },
      { status: 409 }
    );
  }

  // Check ownership
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

  // Update the proposal
  const [updated] = await db
    .update(signupProposals)
    .set({
      proposedStatus: proposed_status,
      manuallyAdjusted: true,
    })
    .where(eq(signupProposals.id, proposalId))
    .returning();

  return NextResponse.json({ proposal: updated });
}
