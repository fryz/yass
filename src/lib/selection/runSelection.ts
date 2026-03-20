import { db } from "@/db";
import {
  events,
  signups,
  signupProposals,
  preferencePoints,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  selectFcfs,
  selectLottery,
  selectLotteryPreference,
  selectFcfsPreference,
  type SignupInput,
} from "./index";

export type RunSelectionResult = {
  eventId: string;
  proposedConfirmed: number;
  proposedWaitlisted: number;
};

/**
 * Runs selection for a single event (must be in 'closed' or 'proposed' status).
 * Fetches all submitted signups, runs the algorithm, replaces proposals.
 * If event was 'closed', transitions to 'proposed'.
 */
export async function runSelectionForEvent(
  eventId: string
): Promise<RunSelectionResult> {
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) {
    throw new Error(`Event ${eventId} not found`);
  }

  if (event.status !== "closed" && event.status !== "proposed") {
    throw new Error(
      `Event ${eventId} is in '${event.status}' status; must be 'closed' or 'proposed' to run selection`
    );
  }

  // Fetch all submitted signups with preference points (single JOIN query)
  const rows = await db
    .select({
      signupId: signups.id,
      userId: signups.userId,
      signedUpAt: signups.signedUpAt,
      preferencePoints: sql<number>`COALESCE(${preferencePoints.points}, 0)`,
    })
    .from(signups)
    .leftJoin(
      preferencePoints,
      and(
        eq(preferencePoints.userId, signups.userId),
        eq(preferencePoints.seriesId, event.seriesId)
      )
    )
    .where(
      and(eq(signups.eventId, eventId), eq(signups.status, "submitted"))
    );

  const signupInputs: SignupInput[] = rows.map((r) => ({
    signupId: r.signupId,
    userId: r.userId,
    signedUpAt: new Date(r.signedUpAt),
    preferencePoints: r.preferencePoints ?? 0,
  }));

  // Run the appropriate algorithm
  let proposals;
  switch (event.selectionLogic) {
    case "fcfs":
      proposals = selectFcfs(signupInputs, event.maxAttendees);
      break;
    case "lottery":
      proposals = selectLottery(signupInputs, event.maxAttendees);
      break;
    case "lottery_preference":
      proposals = selectLotteryPreference(signupInputs, event.maxAttendees);
      break;
    case "fcfs_preference":
      proposals = selectFcfsPreference(signupInputs, event.maxAttendees);
      break;
    default:
      throw new Error(`Unknown selection logic: ${event.selectionLogic}`);
  }

  const now = new Date();

  // Delete existing proposals for this event
  await db
    .delete(signupProposals)
    .where(eq(signupProposals.eventId, eventId));

  // Insert new proposals
  if (proposals.length > 0) {
    await db.insert(signupProposals).values(
      proposals.map((p) => ({
        eventId,
        signupId: p.signupId,
        proposedStatus: p.proposedStatus,
        runAt: now,
        manuallyAdjusted: false,
      }))
    );
  }

  // Transition to 'proposed' if currently 'closed'
  if (event.status === "closed") {
    await db
      .update(events)
      .set({ status: "proposed", updatedAt: now })
      .where(eq(events.id, eventId));
  }

  const confirmedCount = proposals.filter(
    (p) => p.proposedStatus === "proposed_confirmed"
  ).length;
  const waitlistedCount = proposals.filter(
    (p) => p.proposedStatus === "proposed_waitlisted"
  ).length;

  return {
    eventId,
    proposedConfirmed: confirmedCount,
    proposedWaitlisted: waitlistedCount,
  };
}
