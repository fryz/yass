import { db } from "@/db";
import { events, eventSeries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface PageProps {
  params: Promise<{ seriesSlug: string; eventId: string }>;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "open":
      return <Badge className="bg-green-100 text-green-800 border-green-200">Open for Signup</Badge>;
    case "closed":
      return <Badge variant="secondary">Signup Closed</Badge>;
    case "proposed":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Selection in Progress</Badge>;
    case "finalized":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Finalized</Badge>;
    case "draft":
      return <Badge variant="outline">Coming Soon</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getSelectionLogicLabel(logic: string) {
  switch (logic) {
    case "fcfs":
      return "First Come First Served";
    case "lottery":
      return "Random Lottery";
    case "lottery_preference":
      return "Lottery with Preference Points";
    case "fcfs_preference":
      return "FCFS with Preference Points";
    default:
      return logic;
  }
}

function getSelectionLogicDescription(logic: string) {
  switch (logic) {
    case "fcfs":
      return "Signups are accepted in the order they are received.";
    case "lottery":
      return "Attendees are selected randomly from all signups after the signup period closes.";
    case "lottery_preference":
      return "Attendees are selected by lottery, but those who have missed out on previous events get priority.";
    case "fcfs_preference":
      return "Signups are ordered by signup time, but those with preference points (from missing previous events) are prioritized.";
    default:
      return "";
  }
}

export default async function EventDetailPage({ params }: PageProps) {
  const { seriesSlug, eventId } = await params;

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event || event.status === "draft") {
    notFound();
  }

  const series = await db.query.eventSeries.findFirst({
    where: eq(eventSeries.id, event.seriesId),
  });

  if (!series || series.slug !== seriesSlug) {
    notFound();
  }

  const now = new Date();
  const signupOpen = event.status === "open" && new Date(event.signupClosesAt) > now;

  return (
    <div className="container mx-auto max-w-2xl py-10 px-4">
      <div className="mb-6">
        <Link
          href={`/events/${seriesSlug}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {series.name}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-2xl">{event.name}</CardTitle>
            {getStatusBadge(event.status)}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {event.description && (
            <p className="text-muted-foreground">{event.description}</p>
          )}

          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Date & Time</p>
              <p className="mt-1 font-medium">
                {new Date(event.eventDate).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(event.eventDate).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Capacity</p>
              <p className="mt-1 font-medium">{event.maxAttendees} attendees</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Selection Method</p>
              <p className="mt-1 font-medium">{getSelectionLogicLabel(event.selectionLogic)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {getSelectionLogicDescription(event.selectionLogic)}
              </p>
            </div>

            {event.status === "open" && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Signup Closes</p>
                <p className="mt-1 font-medium">
                  {new Date(event.signupClosesAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(event.signupClosesAt).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}
          </div>

          <Separator />

          <div>
            {signupOpen ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Signups close on{" "}
                  {new Date(event.signupClosesAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                  })}
                  . You&apos;ll verify your email before submitting.
                </p>
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link href={`/events/${seriesSlug}/${eventId}/verify`}>
                    Sign Up
                  </Link>
                </Button>
              </div>
            ) : event.status === "open" ? (
              <div className="rounded-md bg-muted p-4">
                <p className="text-sm font-medium">Signup period has ended</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The signup window for this event has closed. The organizer will run selection and notify attendees soon.
                </p>
              </div>
            ) : event.status === "closed" ? (
              <div className="rounded-md bg-muted p-4">
                <p className="text-sm font-medium">Signups are closed</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Selection will be run soon. Attendees will be notified by email.
                </p>
              </div>
            ) : event.status === "proposed" ? (
              <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
                <p className="text-sm font-medium text-yellow-900">Selection in progress</p>
                <p className="mt-1 text-sm text-yellow-700">
                  The organizer is reviewing the attendee list. Notifications will be sent once finalized.
                </p>
              </div>
            ) : event.status === "finalized" ? (
              <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
                <p className="text-sm font-medium text-blue-900">Attendee list finalized</p>
                <p className="mt-1 text-sm text-blue-700">
                  This event has been finalized. Confirmed attendees and waitlisted guests have been notified by email.
                </p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
