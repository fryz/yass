import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import {
  events,
  eventSeries,
  signups,
  signupProposals,
  preferencePoints,
  notifications,
  users,
} from "@/db/schema";
import { getOrUpsertOrganizerUser } from "@/lib/get-organizer-user";
import { eq, inArray, sql } from "drizzle-orm";
import { sendEmail } from "@/lib/novu";

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

  if (event.status !== "proposed") {
    return NextResponse.json(
      { error: `Event must be in 'proposed' status to finalize. Current: '${event.status}'.` },
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

  const usesPreferencePoints =
    event.selectionLogic === "lottery_preference" ||
    event.selectionLogic === "fcfs_preference";

  // --- DB Transaction ---
  type FinalizedSignup = {
    signupId: string;
    userId: string;
    proposedStatus: "proposed_confirmed" | "proposed_waitlisted";
  };

  let finalizedSignups: FinalizedSignup[] = [];
  let confirmedCount = 0;
  let waitlistedCount = 0;

  await db.transaction(async (tx) => {
    // 1. Fetch all proposals
    const proposals = await tx
      .select()
      .from(signupProposals)
      .where(eq(signupProposals.eventId, eventId));

    const confirmedSignupIds = proposals
      .filter((p) => p.proposedStatus === "proposed_confirmed")
      .map((p) => p.signupId);

    const waitlistedSignupIds = proposals
      .filter((p) => p.proposedStatus === "proposed_waitlisted")
      .map((p) => p.signupId);

    confirmedCount = confirmedSignupIds.length;
    waitlistedCount = waitlistedSignupIds.length;

    // Fetch signup → userId mapping for email sends
    const allSignupIds = [...confirmedSignupIds, ...waitlistedSignupIds];
    const signupRows =
      allSignupIds.length > 0
        ? await tx
            .select({ id: signups.id, userId: signups.userId, cancelToken: signups.cancelToken })
            .from(signups)
            .where(inArray(signups.id, allSignupIds))
        : [];

    finalizedSignups = proposals.map((p) => {
      const signup = signupRows.find((s) => s.id === p.signupId);
      return {
        signupId: p.signupId,
        userId: signup?.userId ?? "",
        proposedStatus: p.proposedStatus,
      };
    });

    // 2. UPDATE confirmed signups
    if (confirmedSignupIds.length > 0) {
      await tx
        .update(signups)
        .set({ status: "confirmed", updatedAt: new Date() })
        .where(inArray(signups.id, confirmedSignupIds));
    }

    // 3. UPDATE waitlisted signups
    if (waitlistedSignupIds.length > 0) {
      await tx
        .update(signups)
        .set({ status: "waitlisted", updatedAt: new Date() })
        .where(inArray(signups.id, waitlistedSignupIds));
    }

    // 4. Update preference points (only for preference algorithms)
    if (usesPreferencePoints) {
      // Get userIds for confirmed and waitlisted
      const confirmedUserIds = signupRows
        .filter((s) => confirmedSignupIds.includes(s.id))
        .map((s) => s.userId);

      const waitlistedUserIds = signupRows
        .filter((s) => waitlistedSignupIds.includes(s.id))
        .map((s) => s.userId);

      // Confirmed → points = 0
      if (confirmedUserIds.length > 0) {
        for (const userId of confirmedUserIds) {
          await tx
            .insert(preferencePoints)
            .values({
              userId,
              seriesId: event.seriesId,
              points: 0,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [preferencePoints.userId, preferencePoints.seriesId],
              set: { points: 0, updatedAt: new Date() },
            });
        }
      }

      // Waitlisted → points += 1
      if (waitlistedUserIds.length > 0) {
        for (const userId of waitlistedUserIds) {
          await tx
            .insert(preferencePoints)
            .values({
              userId,
              seriesId: event.seriesId,
              points: 1,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [preferencePoints.userId, preferencePoints.seriesId],
              set: {
                points: sql`${preferencePoints.points} + 1`,
                updatedAt: new Date(),
              },
            });
        }
      }
    }

    // 5. UPDATE event status to 'finalized'
    await tx
      .update(events)
      .set({ status: "finalized", updatedAt: new Date() })
      .where(eq(events.id, eventId));

    // 6. DELETE proposals
    await tx
      .delete(signupProposals)
      .where(eq(signupProposals.eventId, eventId));
  });

  // --- After transaction: send Novu emails (fire-and-forget) ---
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const eventDateStr = new Date(event.eventDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Fetch all signup cancel tokens and user details for email sending
  const allSignupIds = finalizedSignups.map((s) => s.signupId);
  const signupDetails =
    allSignupIds.length > 0
      ? await db
          .select({
            id: signups.id,
            userId: signups.userId,
            cancelToken: signups.cancelToken,
            userName: users.name,
            userEmail: users.email,
          })
          .from(signups)
          .innerJoin(users, eq(signups.userId, users.id))
          .where(inArray(signups.id, allSignupIds))
      : [];

  const signupDetailMap = new Map(signupDetails.map((s) => [s.id, s]));

  // Send emails to each attendee
  for (const fs of finalizedSignups) {
    const detail = signupDetailMap.get(fs.signupId);
    if (!detail) continue;

    const cancelUrl = `${baseUrl}/my-signup/${detail.cancelToken}`;
    const templateId =
      fs.proposedStatus === "proposed_confirmed"
        ? "selection_confirmed"
        : "selection_waitlisted";

    const payload: Record<string, unknown> = {
      name: detail.userName,
      event_name: event.name,
      event_date: eventDateStr,
      cancel_url: cancelUrl,
    };

    await sendEmail(detail.userEmail, templateId, payload);

    // Log notification
    try {
      await db.insert(notifications).values({
        recipientId: detail.userId,
        eventId,
        type: "selection_run",
        novuId: `${templateId}_${detail.id}_${Date.now()}`,
      });
    } catch {
      // Best-effort logging
    }
  }

  // Send email to organizer
  if (organizerUser && series) {
    const eventUrl = `${baseUrl}/organizer/events/${eventId}`;
    await sendEmail(organizerUser.email, "organizer_selection_complete", {
      organizer_name: organizerUser.name,
      event_name: event.name,
      confirmed_count: confirmedCount,
      waitlisted_count: waitlistedCount,
      event_url: eventUrl,
    });
  }

  return NextResponse.json({
    success: true,
    confirmedCount,
    waitlistedCount,
  });
}
