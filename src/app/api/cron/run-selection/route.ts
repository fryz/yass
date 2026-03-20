import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events } from "@/db/schema";
import { eq, lte, and } from "drizzle-orm";
import { runSelectionForEvent } from "@/lib/selection/runSelection";

/**
 * Vercel Cron handler — runs every minute.
 * Finds all 'open' events whose signup_closes_at has passed and runs selection.
 */
export async function GET(req: NextRequest) {
  // Validate CRON_SECRET — required; fail-closed if not configured
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured." }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find all open events where signup_closes_at <= now
  const overdueEvents = await db.query.events.findMany({
    where: and(
      eq(events.status, "open"),
      lte(events.signupClosesAt, now)
    ),
  });

  if (overdueEvents.length === 0) {
    return NextResponse.json({ processed: 0, results: [] });
  }

  const results: Array<{
    eventId: string;
    success: boolean;
    error?: string;
    proposedConfirmed?: number;
    proposedWaitlisted?: number;
  }> = [];

  for (const event of overdueEvents) {
    try {
      // First close the event (open → closed), then run selection (closed → proposed)
      await db
        .update(events)
        .set({ status: "closed", updatedAt: now })
        .where(eq(events.id, event.id));

      const result = await runSelectionForEvent(event.id);
      results.push({
        eventId: event.id,
        success: true,
        proposedConfirmed: result.proposedConfirmed,
        proposedWaitlisted: result.proposedWaitlisted,
      });
    } catch (err) {
      console.error(`Cron: failed to process event ${event.id}:`, err);
      results.push({
        eventId: event.id,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  console.log(`Cron run-selection: processed ${results.length} events`, results);

  return NextResponse.json({
    processed: results.length,
    results,
    timestamp: now.toISOString(),
  });
}
