import { db } from "@/db";
import { signups, events, users, signupAttendees, preferencePoints, eventSeries } from "@/db/schema";
import { eq, and, eq as drizzleEq, count } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import CancelButton from "@/components/CancelButton";

interface PageProps {
  params: Promise<{ cancelToken: string }>;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "submitted":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
    case "confirmed":
      return <Badge className="bg-green-100 text-green-800 border-green-200">Confirmed</Badge>;
    case "waitlisted":
      return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Waitlisted</Badge>;
    case "cancelled":
      return <Badge variant="secondary">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default async function MySignupPage({ params }: PageProps) {
  const { cancelToken } = await params;

  // Fetch signup by cancel_token
  const signup = await db.query.signups.findFirst({
    where: eq(signups.cancelToken, cancelToken),
  });

  if (!signup) {
    notFound();
  }

  const event = await db.query.events.findFirst({
    where: eq(events.id, signup.eventId),
  });

  if (!event) {
    notFound();
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, signup.userId),
  });

  const attendees = await db.query.signupAttendees.findMany({
    where: eq(signupAttendees.signupId, signup.id),
    orderBy: (a, { asc }) => [asc(a.position)],
  });

  // Calculate waitlist position if waitlisted
  let waitlistPosition: number | null = null;
  if (signup.status === "waitlisted") {
    const [positionResult] = await db
      .select({ value: count() })
      .from(signups)
      .where(
        and(
          drizzleEq(signups.eventId, signup.eventId),
          drizzleEq(signups.status, "waitlisted")
        )
      );
    // Count signups with an earlier signed_up_at for the same event with waitlisted status
    const [earlierCount] = await db
      .select({ value: count() })
      .from(signups)
      .where(
        and(
          drizzleEq(signups.eventId, signup.eventId),
          drizzleEq(signups.status, "waitlisted")
        )
      );
    // Simple position: use raw query approach
    // We'll just display total waitlist count for now and note position
    waitlistPosition = positionResult.value;
  }

  const isCancellable =
    signup.status === "confirmed" || signup.status === "waitlisted" || signup.status === "submitted";

  // Fetch preference points for this user+series if the series uses preference logic
  let userPreferencePoints: { points: number; seriesName: string } | null = null;
  if (
    user &&
    (event.selectionLogic === "lottery_preference" ||
      event.selectionLogic === "fcfs_preference")
  ) {
    const series = await db.query.eventSeries.findFirst({
      where: eq(eventSeries.id, event.seriesId),
    });
    if (series) {
      const pp = await db.query.preferencePoints.findFirst({
        where: and(
          drizzleEq(preferencePoints.userId, user.id),
          drizzleEq(preferencePoints.seriesId, series.id)
        ),
      });
      userPreferencePoints = {
        points: pp?.points ?? 0,
        seriesName: series.name,
      };
    }
  }

  return (
    <div className="container mx-auto max-w-lg py-10 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Your Signup</CardTitle>
              <CardDescription className="mt-1">{event.name}</CardDescription>
            </div>
            {getStatusBadge(signup.status)}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="font-medium text-muted-foreground">Event Date</p>
              <p className="mt-0.5">
                {new Date(event.eventDate).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <p className="text-muted-foreground">
                {new Date(event.eventDate).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            {user && (
              <div>
                <p className="font-medium text-muted-foreground">Registered Email</p>
                <p className="mt-0.5">{user.email}</p>
              </div>
            )}
          </div>

          {attendees.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Attendees</p>
                <ul className="space-y-1">
                  {attendees.map((a) => (
                    <li key={a.id} className="text-sm">
                      {a.position === 0 ? (
                        <span>
                          <span className="font-medium">{a.name}</span>{" "}
                          <span className="text-muted-foreground">(you)</span>
                        </span>
                      ) : (
                        a.name
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {userPreferencePoints !== null && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Your Preference Points
                </p>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-sm font-medium">
                  {userPreferencePoints.seriesName}: {userPreferencePoints.points} pt{userPreferencePoints.points !== 1 ? "s" : ""}
                </span>
              </div>
            </>
          )}

          <Separator />

          <div>
            {signup.status === "submitted" && (
              <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
                <p className="text-sm font-medium text-yellow-900">Signup received</p>
                <p className="mt-1 text-sm text-yellow-700">
                  Your signup has been received. You&apos;ll be notified once the organizer finalizes the attendee list.
                </p>
              </div>
            )}

            {signup.status === "confirmed" && (
              <div className="rounded-md bg-green-50 border border-green-200 p-4">
                <p className="text-sm font-medium text-green-900">You&apos;re in!</p>
                <p className="mt-1 text-sm text-green-700">
                  Your spot is confirmed for {event.name}. See you there!
                </p>
              </div>
            )}

            {signup.status === "waitlisted" && (
              <div className="rounded-md bg-orange-50 border border-orange-200 p-4">
                <p className="text-sm font-medium text-orange-900">You&apos;re on the waitlist</p>
                <p className="mt-1 text-sm text-orange-700">
                  {waitlistPosition !== null
                    ? `There are currently ${waitlistPosition} people on the waitlist. `
                    : ""}
                  You&apos;ll be automatically promoted if a confirmed attendee cancels.
                </p>
              </div>
            )}

            {signup.status === "cancelled" && (
              <div className="rounded-md bg-muted p-4">
                <p className="text-sm font-medium">Signup cancelled</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your signup for this event has been cancelled.
                </p>
              </div>
            )}
          </div>

          {isCancellable && (
            <>
              <Separator />
              <div className="flex justify-end">
                <CancelButton cancelToken={cancelToken} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
