import { db } from "@/db";
import { eventSeries, events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface PageProps {
  params: Promise<{ seriesSlug: string }>;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "open":
      return <Badge className="bg-green-100 text-green-800 border-green-200">Open</Badge>;
    case "closed":
      return <Badge variant="secondary">Closed</Badge>;
    case "proposed":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Selection Pending</Badge>;
    case "finalized":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Finalized</Badge>;
    case "draft":
      return <Badge variant="outline">Draft</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getSelectionLogicLabel(logic: string) {
  switch (logic) {
    case "fcfs":
      return "First Come First Served";
    case "lottery":
      return "Lottery";
    case "lottery_preference":
      return "Lottery with Preference";
    case "fcfs_preference":
      return "FCFS with Preference";
    default:
      return logic;
  }
}

export default async function SeriesPage({ params }: PageProps) {
  const { seriesSlug } = await params;

  const series = await db.query.eventSeries.findFirst({
    where: eq(eventSeries.slug, seriesSlug),
  });

  if (!series) {
    notFound();
  }

  const seriesEvents = await db.query.events.findMany({
    where: eq(events.seriesId, series.id),
    orderBy: (e, { desc }) => [desc(e.eventDate)],
  });

  const visibleEvents = seriesEvents.filter((e) => e.status !== "draft");

  return (
    <div className="container mx-auto max-w-3xl py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{series.name}</h1>
        {series.description && (
          <p className="mt-2 text-muted-foreground">{series.description}</p>
        )}
      </div>

      <Separator className="mb-8" />

      {visibleEvents.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          No upcoming events. Check back soon!
        </p>
      ) : (
        <div className="space-y-4">
          {visibleEvents.map((event) => {
            const now = new Date();
            const signupOpen = event.status === "open" && new Date(event.signupClosesAt) > now;
            const signupClosed = new Date(event.signupClosesAt) <= now || event.status !== "open";

            return (
              <Link
                key={event.id}
                href={`/events/${seriesSlug}/${event.id}`}
                className="block"
              >
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-xl">{event.name}</CardTitle>
                      {getStatusBadge(event.status)}
                    </div>
                    <CardDescription>
                      <span className="font-medium">
                        {new Date(event.eventDate).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                      <span>
                        <span className="font-medium text-foreground">Selection:</span>{" "}
                        {getSelectionLogicLabel(event.selectionLogic)}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">Slots:</span>{" "}
                        {event.maxAttendees}
                      </span>
                      {signupOpen && (
                        <span>
                          <span className="font-medium text-foreground">Signup closes:</span>{" "}
                          {new Date(event.signupClosesAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                      {signupClosed && event.status === "open" && (
                        <span className="text-orange-600">Signup closed</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
