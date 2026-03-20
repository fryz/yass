import { db } from "@/db";
import { eventSeries } from "@/db/schema";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default async function EventsPage() {
  const allSeries = await db.query.eventSeries.findMany({
    orderBy: (s, { asc }) => [asc(s.name)],
  });

  return (
    <div className="container mx-auto max-w-3xl py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Browse Events</h1>
        <p className="mt-2 text-muted-foreground">
          Find and sign up for upcoming events.
        </p>
      </div>

      {allSeries.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          No event series yet. Check back soon!
        </p>
      ) : (
        <div className="space-y-4">
          {allSeries.map((series) => (
            <Link key={series.id} href={`/events/${series.slug}`} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl">{series.name}</CardTitle>
                </CardHeader>
                {series.description && (
                  <CardContent className="pt-0">
                    <CardDescription>{series.description}</CardDescription>
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
