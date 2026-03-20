import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { eventSeries, events, signups, users } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STATUS_COLORS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  open: "default",
  closed: "outline",
  proposed: "outline",
  finalized: "default",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
  proposed: "Proposed",
  finalized: "Finalized",
};

export default async function OrganizerEventsPage() {
  const session = await auth0.getSession();
  if (!session?.user) redirect("/auth/login?returnTo=/organizer/events");

  // Find the organizer's user record by Auth0 email
  const organizerUser = await db.query.users.findFirst({
    where: eq(users.email, session.user.email!),
  });

  // Get all series for this organizer
  const rawSeries = organizerUser
    ? await db.query.eventSeries.findMany({
        where: eq(eventSeries.organizerId, organizerUser.id),
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      })
    : [];

  // Fetch events for each series separately, ordered by eventDate desc
  const { desc: descOrder } = await import("drizzle-orm");
  const allSeriesEvents = rawSeries.length > 0
    ? await db.query.events.findMany({
        orderBy: descOrder(events.eventDate),
      })
    : [];

  const allSeries = rawSeries.map((s) => ({
    ...s,
    events: allSeriesEvents.filter((e) => e.seriesId === s.id),
  }));

  // Gather signup counts per event
  const eventIds = allSeries.flatMap((s) => s.events.map((e) => e.id));

  type SignupCountRow = { eventId: string; status: string; cnt: number };
  let signupCounts: SignupCountRow[] = [];
  if (eventIds.length > 0) {
    // Query signup counts grouped by eventId + status
    const rows = await db
      .select({
        eventId: signups.eventId,
        status: signups.status,
        cnt: count(),
      })
      .from(signups)
      .groupBy(signups.eventId, signups.status);
    signupCounts = rows.map((r) => ({
      eventId: r.eventId,
      status: r.status,
      cnt: Number(r.cnt),
    }));
  }

  // Build a lookup map
  const countsByEvent = new Map<
    string,
    { total: number; confirmed: number; waitlisted: number }
  >();
  for (const row of signupCounts) {
    const cur = countsByEvent.get(row.eventId) ?? {
      total: 0,
      confirmed: 0,
      waitlisted: 0,
    };
    cur.total += row.cnt;
    if (row.status === "confirmed") cur.confirmed += row.cnt;
    if (row.status === "waitlisted") cur.waitlisted += row.cnt;
    countsByEvent.set(row.eventId, cur);
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your event series and individual events
          </p>
        </div>
        <Button asChild>
          <Link href="/organizer/events/new">New Event</Link>
        </Button>
      </div>

      {allSeries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">
              You haven&apos;t created any event series yet.
            </p>
            <Button asChild>
              <Link href="/organizer/events/new">Create your first event</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {allSeries.map((series) => (
            <Card key={series.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{series.name}</CardTitle>
                  <Link
                    href={`/organizer/series`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Edit series
                  </Link>
                </div>
                {series.description && (
                  <CardDescription>{series.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {series.events.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">
                    No events in this series yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {series.events.map((event) => {
                      const counts = countsByEvent.get(event.id) ?? {
                        total: 0,
                        confirmed: 0,
                        waitlisted: 0,
                      };
                      return (
                        <div
                          key={event.id}
                          className="flex items-center justify-between py-2 border-t first:border-t-0"
                        >
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium text-sm">{event.name}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(event.eventDate).toLocaleDateString(
                                  "en-US",
                                  {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  }
                                )}
                              </p>
                            </div>
                            <Badge variant={STATUS_COLORS[event.status]}>
                              {STATUS_LABELS[event.status]}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right text-xs text-gray-500">
                              <span className="font-medium text-gray-700">
                                {counts.total}
                              </span>{" "}
                              signups
                              {event.status === "finalized" && (
                                <span className="ml-2">
                                  <span className="text-green-600 font-medium">
                                    {counts.confirmed}
                                  </span>{" "}
                                  confirmed ·{" "}
                                  <span className="text-yellow-600 font-medium">
                                    {counts.waitlisted}
                                  </span>{" "}
                                  waitlisted
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button asChild variant="outline" size="sm">
                                <Link
                                  href={`/organizer/events/${event.id}/attendees`}
                                >
                                  Attendees
                                </Link>
                              </Button>
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/organizer/events/${event.id}`}>
                                  Manage
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-4 pt-3 border-t">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/organizer/events/new">
                      Add event to this series
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
