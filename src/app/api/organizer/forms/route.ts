import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { eventSeries, forms } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getOrUpsertOrganizerUser } from "@/lib/get-organizer-user";

function getUserRoles(session: { user: Record<string, unknown> }): string[] {
  return (
    (session.user["https://yass.app/roles"] as string[] | undefined) ??
    (session.user["roles"] as string[] | undefined) ??
    []
  );
}

export async function GET(req: NextRequest) {
  const session = await auth0.getSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizerUser = await getOrUpsertOrganizerUser(session.user);
  if (!organizerUser) return NextResponse.json([], { status: 200 });

  const roles = getUserRoles(session);

  let allForms;
  if (roles.includes("admin")) {
    allForms = await db.query.forms.findMany({
      orderBy: (f, { desc }) => [desc(f.createdAt)],
    });
  } else {
    const allSeries = await db.query.eventSeries.findMany({
      where: eq(eventSeries.organizerId, organizerUser.id),
    });
    const seriesIds = allSeries.map((s) => s.id);
    if (seriesIds.length === 0) return NextResponse.json([], { status: 200 });

    allForms = await db.query.forms.findMany({
      where: inArray(forms.seriesId, seriesIds),
      orderBy: (f, { desc }) => [desc(f.createdAt)],
    });
  }

  return NextResponse.json(allForms);
}
