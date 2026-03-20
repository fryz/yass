import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { events, eventSeries, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
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
import EventActions from "./EventActions";

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

export default async function EventDetailPage({
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

  // Check ownership: organizer must own this series (unless admin)
  const organizerUser = await db.query.users.findFirst({
    where: eq(users.email, session.user.email!),
  });

  const userRoles: string[] =
    (session.user["https://yass.app/roles"] as string[] | undefined) ??
    (session.user["roles"] as string[] | undefined) ??
    [];

  const isAdmin = userRoles.includes("admin");
  const isOwner = organizerUser && series.organizerId === organizerUser.id;

  if (!isAdmin && !isOwner) {
    redirect("/organizer/events");
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
        <Link href="/organizer/events" className="hover:text-gray-900">
          Events
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
                    hour: "2-digit",
                    minute: "2-digit",
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
                    hour: "2-digit",
                    minute: "2-digit",
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
            <CardTitle className="text-base">Actions</CardTitle>
            <CardDescription>
              Manage this event&apos;s lifecycle
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EventActions event={event} />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href={`/organizer/events/${event.id}/attendees`}>
              View Attendees
            </Link>
          </Button>
          {event.status === "open" && (
            <Button asChild variant="outline">
              <Link href={`/events/${series.slug}/${event.id}`} target="_blank">
                View Public Page
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
