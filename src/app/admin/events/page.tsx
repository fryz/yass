import { db } from "@/db";
import { events, eventSeries, users, signups } from "@/db/schema";
import { count, eq, ilike, or } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function AdminEventsPage({ searchParams }: PageProps) {
  const { status, q } = await searchParams;

  // Fetch all events with series + organizer info
  const allEvents = await db
    .select({
      id: events.id,
      name: events.name,
      eventDate: events.eventDate,
      status: events.status,
      maxAttendees: events.maxAttendees,
      seriesId: events.seriesId,
      seriesName: eventSeries.name,
      organizerName: users.name,
      organizerEmail: users.email,
    })
    .from(events)
    .leftJoin(eventSeries, eq(events.seriesId, eventSeries.id))
    .leftJoin(users, eq(eventSeries.organizerId, users.id))
    .orderBy(events.eventDate);

  // Signup counts per event
  const signupRows = await db
    .select({
      eventId: signups.eventId,
      status: signups.status,
      cnt: count(),
    })
    .from(signups)
    .groupBy(signups.eventId, signups.status);

  const countsByEvent = new Map<string, { confirmed: number; total: number }>();
  for (const row of signupRows) {
    const cur = countsByEvent.get(row.eventId) ?? { confirmed: 0, total: 0 };
    cur.total += Number(row.cnt);
    if (row.status === "confirmed") cur.confirmed += Number(row.cnt);
    countsByEvent.set(row.eventId, cur);
  }

  // Filter
  let filtered = allEvents;
  if (status) {
    filtered = filtered.filter((e) => e.status === status);
  }
  if (q) {
    const lower = q.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.name.toLowerCase().includes(lower) ||
        (e.seriesName ?? "").toLowerCase().includes(lower) ||
        (e.organizerEmail ?? "").toLowerCase().includes(lower)
    );
  }

  const statuses = ["draft", "open", "closed", "proposed", "finalized"];

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Events</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} event{filtered.length !== 1 ? "s" : ""}
            {status ? ` with status "${status}"` : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Link
          href="/admin/events"
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !status
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          All
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/admin/events?status=${s}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              status === s
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Series</TableHead>
              <TableHead>Organizer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Signups</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-gray-500 py-8"
                >
                  No events found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((event) => {
                const counts = countsByEvent.get(event.id) ?? {
                  confirmed: 0,
                  total: 0,
                };
                return (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.name}</TableCell>
                    <TableCell className="text-gray-600">
                      {event.seriesName ?? "—"}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      <div className="text-xs">
                        <div>{event.organizerName}</div>
                        <div className="text-gray-400">{event.organizerEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(event.eventDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[event.status]}>
                        {STATUS_LABELS[event.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {counts.total} total · {counts.confirmed} confirmed
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/events/${event.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
