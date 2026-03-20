import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { eventSeries, events, forms, users } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SeriesPage() {
  const session = await auth0.getSession();
  if (!session?.user) redirect("/auth/login?returnTo=/organizer/series");

  const organizerUser = await db.query.users.findFirst({
    where: eq(users.email, session.user.email!),
  });

  const allSeries = organizerUser
    ? await db.query.eventSeries.findMany({
        where: eq(eventSeries.organizerId, organizerUser.id),
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      })
    : [];

  // Get event counts per series
  const eventCounts = await db
    .select({ seriesId: events.seriesId, cnt: count() })
    .from(events)
    .groupBy(events.seriesId);

  const countBySeriesId = new Map(
    eventCounts.map((r) => [r.seriesId, Number(r.cnt)])
  );

  // Get default form names
  const formIds = allSeries
    .map((s) => s.defaultFormId)
    .filter(Boolean) as string[];

  let formsMap = new Map<string, string>();
  if (formIds.length > 0) {
    const formRows = await db.query.forms.findMany();
    formsMap = new Map(formRows.map((f) => [f.id, f.name]));
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Event Series</h1>
          <p className="text-sm text-gray-500 mt-1">
            Series group related events and share preference points history
          </p>
        </div>
        <Button asChild>
          <Link href="/organizer/series/new">New Series</Link>
        </Button>
      </div>

      {allSeries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No event series yet.</p>
            <Button asChild>
              <Link href="/organizer/series/new">Create your first series</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {allSeries.map((series) => (
            <Card key={series.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{series.name}</CardTitle>
                  <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">
                    /{series.slug}
                  </span>
                </div>
                {series.description && (
                  <CardDescription>{series.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="flex gap-6 text-sm text-gray-600">
                  <span>
                    <strong className="text-gray-900">
                      {countBySeriesId.get(series.id) ?? 0}
                    </strong>{" "}
                    events
                  </span>
                  {series.defaultFormId && (
                    <span>
                      Default form:{" "}
                      <strong className="text-gray-900">
                        {formsMap.get(series.defaultFormId) ?? "Unknown"}
                      </strong>
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/organizer/events?series=${series.id}`}>
                      View Events
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
