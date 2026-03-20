import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { events, eventSeries, signups, signupProposals, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AttendeeTabs from "./AttendeeTabs";
import FinalizeButton from "./FinalizeButton";
import EmailDialog from "./EmailDialog";

export default async function AttendeesPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const session = await auth0.getSession();
  if (!session?.user) redirect("/auth/login");

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });
  if (!event) notFound();

  const series = await db.query.eventSeries.findFirst({
    where: eq(eventSeries.id, event.seriesId),
  });
  if (!series) notFound();

  // Check ownership
  const organizerUser = await db.query.users.findFirst({
    where: eq(users.email, session.user.email!),
  });
  const userRoles: string[] =
    (session.user["https://yass.app/roles"] as string[] | undefined) ??
    (session.user["roles"] as string[] | undefined) ??
    [];
  const isAdmin = userRoles.includes("admin");
  const isOwner = organizerUser && series.organizerId === organizerUser.id;
  if (!isAdmin && !isOwner) redirect("/organizer/events");

  // For proposed/finalized events, fetch proposals joined with signup + user data
  type AttendeeRow = {
    proposalId: string;
    signupId: string;
    userId: string;
    name: string;
    email: string;
    signedUpAt: Date;
    proposedStatus: "proposed_confirmed" | "proposed_waitlisted";
    manuallyAdjusted: boolean;
    preferencePoints?: number;
  };

  type FinalizedRow = {
    signupId: string;
    userId: string;
    name: string;
    email: string;
    signedUpAt: Date;
    status: string;
  };

  let proposedConfirmed: AttendeeRow[] = [];
  let proposedWaitlisted: AttendeeRow[] = [];
  let finalizedConfirmed: FinalizedRow[] = [];
  let finalizedWaitlisted: FinalizedRow[] = [];

  if (event.status === "proposed") {
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

    for (const row of proposals) {
      const attendee: AttendeeRow = {
        proposalId: row.proposalId,
        signupId: row.signupId,
        userId: row.userId,
        name: row.userName,
        email: row.userEmail,
        signedUpAt: row.signedUpAt,
        proposedStatus: row.proposedStatus,
        manuallyAdjusted: row.manuallyAdjusted,
      };
      if (row.proposedStatus === "proposed_confirmed") {
        proposedConfirmed.push(attendee);
      } else {
        proposedWaitlisted.push(attendee);
      }
    }

    proposedConfirmed.sort(
      (a, b) => a.signedUpAt.getTime() - b.signedUpAt.getTime()
    );
    proposedWaitlisted.sort(
      (a, b) => a.signedUpAt.getTime() - b.signedUpAt.getTime()
    );
  }

  if (event.status === "finalized") {
    const confirmedRows = await db
      .select({
        signupId: signups.id,
        userId: signups.userId,
        signedUpAt: signups.signedUpAt,
        status: signups.status,
        userName: users.name,
        userEmail: users.email,
      })
      .from(signups)
      .innerJoin(users, eq(signups.userId, users.id))
      .where(and(eq(signups.eventId, eventId), eq(signups.status, "confirmed")));

    const waitlistedRows = await db
      .select({
        signupId: signups.id,
        userId: signups.userId,
        signedUpAt: signups.signedUpAt,
        status: signups.status,
        userName: users.name,
        userEmail: users.email,
      })
      .from(signups)
      .innerJoin(users, eq(signups.userId, users.id))
      .where(
        and(eq(signups.eventId, eventId), eq(signups.status, "waitlisted"))
      );

    finalizedConfirmed = confirmedRows.map((r) => ({
      signupId: r.signupId,
      userId: r.userId,
      name: r.userName,
      email: r.userEmail,
      signedUpAt: r.signedUpAt,
      status: r.status,
    }));
    finalizedWaitlisted = waitlistedRows.map((r) => ({
      signupId: r.signupId,
      userId: r.userId,
      name: r.userName,
      email: r.userEmail,
      signedUpAt: r.signedUpAt,
      status: r.status,
    }));
  }

  // Submitted signups for non-proposed/finalized events
  const submittedSignups =
    event.status !== "proposed" && event.status !== "finalized"
      ? await db
          .select({
            signupId: signups.id,
            userId: signups.userId,
            signedUpAt: signups.signedUpAt,
            status: signups.status,
            userName: users.name,
            userEmail: users.email,
          })
          .from(signups)
          .innerJoin(users, eq(signups.userId, users.id))
          .where(
            and(
              eq(signups.eventId, eventId),
              eq(signups.status, "submitted")
            )
          )
      : [];

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
        <Link href="/organizer/events" className="hover:text-gray-900">
          Events
        </Link>
        <span>/</span>
        <Link
          href={`/organizer/events/${eventId}`}
          className="hover:text-gray-900"
        >
          {event.name}
        </Link>
        <span>/</span>
        <span className="text-gray-900">Attendees</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendees</h1>
          <p className="text-sm text-gray-500 mt-1">
            {event.name} · {series.name}
          </p>
        </div>
        <div className="flex gap-2">
          {(event.status === "proposed" || event.status === "finalized") && (
            <EmailDialog eventId={eventId} eventName={event.name} />
          )}
          {event.status === "proposed" && (
            <FinalizeButton eventId={eventId} />
          )}
        </div>
      </div>

      {event.status === "proposed" && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
          Selection has run. Review the proposed list below. You can move
          attendees between tabs or re-run selection. Click &quot;Finalize&quot;
          when ready to send notifications.
        </div>
      )}

      {(event.status === "proposed" || event.status === "finalized") ? (
        <AttendeeTabs
          eventId={eventId}
          eventStatus={event.status}
          proposedConfirmed={proposedConfirmed}
          proposedWaitlisted={proposedWaitlisted}
          finalizedConfirmed={finalizedConfirmed}
          finalizedWaitlisted={finalizedWaitlisted}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Signups ({submittedSignups.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {submittedSignups.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                No signups yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="pb-2 font-medium text-gray-500">Name</th>
                    <th className="pb-2 font-medium text-gray-500">Email</th>
                    <th className="pb-2 font-medium text-gray-500">
                      Signed Up
                    </th>
                    <th className="pb-2 font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {submittedSignups.map((row) => (
                    <tr key={row.signupId} className="border-b last:border-0">
                      <td className="py-2 font-medium">{row.userName}</td>
                      <td className="py-2 text-gray-600">{row.userEmail}</td>
                      <td className="py-2 text-gray-600">
                        {new Date(row.signedUpAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2">
                        <Badge variant="secondary">{row.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
