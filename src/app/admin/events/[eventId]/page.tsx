import { db } from "@/db";
import { events, eventSeries, users, signups } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
  proposed: "Proposed",
  finalized: "Finalized",
};

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

const SELECTION_LOGIC_LABELS: Record<string, string> = {
  fcfs: "First Come, First Served",
  lottery: "Lottery",
  lottery_preference: "Lottery with Preference Points",
  fcfs_preference: "FCFS with Preference Points",
};

interface PageProps {
  params: Promise<{ eventId: string }>;
}

export default async function AdminEventDetailPage({ params }: PageProps) {
  const { eventId } = await params;

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) notFound();

  const series = await db.query.eventSeries.findFirst({
    where: eq(eventSeries.id, event.seriesId),
  });

  if (!series) notFound();

  const organizer = await db.query.users.findFirst({
    where: eq(users.id, series.organizerId),
  });

  // Signup counts by status
  const signupRows = await db
    .select({
      status: signups.status,
      cnt: count(),
    })
    .from(signups)
    .where(eq(signups.eventId, eventId))
    .groupBy(signups.status);

  const counts: Record<string, number> = {};
  for (const row of signupRows) {
    counts[row.status] = Number(row.cnt);
  }
  const totalSignups = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
        <Link href="/admin/events" className="hover:text-gray-900">
          All Events
        </Link>
        <span>/</span>
        <span className="text-gray-900">{event.name}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            <Badge variant={STATUS_COLORS[event.status]}>
              {STATUS_LABELS[event.status]}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">{series.name}</p>
        </div>
        <Button asChild variant="outline">
          <a href={`/api/admin/events/${eventId}/export`}>
            Export CSV
          </a>
        </Button>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {event.description && (
              <p className="text-gray-700">{event.description}</p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Event Date
                </p>
                <p className="text-gray-900 mt-1">
                  {new Date(event.eventDate).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Signup Closes
                </p>
                <p className="text-gray-900 mt-1">
                  {new Date(event.signupClosesAt).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Max Attendees
                </p>
                <p className="text-gray-900 mt-1">{event.maxAttendees}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Selection Algorithm
                </p>
                <p className="text-gray-900 mt-1">
                  {SELECTION_LOGIC_LABELS[event.selectionLogic]}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organizer</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{organizer?.name ?? "—"}</p>
            <p className="text-gray-500">{organizer?.email ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Total
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {totalSignups}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Confirmed
                </p>
                <p className="text-2xl font-bold text-green-700 mt-1">
                  {counts.confirmed ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Waitlisted
                </p>
                <p className="text-2xl font-bold text-orange-600 mt-1">
                  {counts.waitlisted ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Submitted
                </p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {counts.submitted ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href={`/organizer/events/${event.id}/attendees`}>
              View Attendees
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/admin/events/${eventId}/export`}>
              Export Confirmed Attendees (CSV)
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
