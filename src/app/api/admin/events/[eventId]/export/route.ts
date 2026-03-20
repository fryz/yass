import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { events, signups, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const userRoles: string[] =
    (session.user["https://yass.app/roles"] as string[] | undefined) ??
    (session.user["roles"] as string[] | undefined) ??
    [];

  if (!userRoles.includes("admin")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { eventId } = await params;

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) {
    return new NextResponse("Event not found", { status: 404 });
  }

  // Fetch confirmed signups with user info
  const confirmedSignups = await db
    .select({
      signupId: signups.id,
      signedUpAt: signups.signedUpAt,
      responses: signups.responses,
      userName: users.name,
      userEmail: users.email,
    })
    .from(signups)
    .leftJoin(users, eq(signups.userId, users.id))
    .where(
      and(eq(signups.eventId, eventId), eq(signups.status, "confirmed"))
    );

  // Collect all unique form field keys from responses
  const allFieldKeys = new Set<string>();
  const parsedResponses: Array<Record<string, string>> = [];

  for (const row of confirmedSignups) {
    let responseMap: Record<string, string> = {};
    try {
      const raw = row.responses as Record<string, unknown>;
      for (const [key, val] of Object.entries(raw)) {
        responseMap[key] = Array.isArray(val)
          ? val
              .map((v) =>
                typeof v === "object" && v !== null
                  ? Object.values(v).join(", ")
                  : String(v)
              )
              .join("; ")
          : String(val ?? "");
        allFieldKeys.add(key);
      }
    } catch {
      // malformed responses — skip
    }
    parsedResponses.push(responseMap);
  }

  const extraFields = Array.from(allFieldKeys);

  // CSV helpers
  function escapeCell(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  // Header row
  const headers = ["name", "email", "signed_up_at", ...extraFields];
  const rows: string[] = [headers.map(escapeCell).join(",")];

  // Data rows
  for (let i = 0; i < confirmedSignups.length; i++) {
    const row = confirmedSignups[i];
    const resp = parsedResponses[i];
    const cells = [
      row.userName ?? "",
      row.userEmail ?? "",
      new Date(row.signedUpAt).toISOString(),
      ...extraFields.map((key) => resp[key] ?? ""),
    ];
    rows.push(cells.map(escapeCell).join(","));
  }

  const csv = rows.join("\n");
  const safeName = event.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${safeName}-attendees.csv"`,
    },
  });
}
