import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { eventSeries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getOrUpsertOrganizerUser } from "@/lib/get-organizer-user";

const CreateSeriesSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function getUserRoles(session: { user: Record<string, unknown> }): string[] {
  return (
    (session.user["https://yass.app/roles"] as string[] | undefined) ??
    (session.user["roles"] as string[] | undefined) ??
    []
  );
}

export async function POST(req: NextRequest) {
  const session = await auth0.getSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = getUserRoles(session);
  if (!roles.includes("organizer") && !roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateSeriesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const { name, description } = parsed.data;

  const organizerUser = await getOrUpsertOrganizerUser(session.user);
  if (!organizerUser) {
    return NextResponse.json({ error: "Organizer user not found." }, { status: 404 });
  }

  // Generate unique slug
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let attempt = 0;
  while (true) {
    const existing = await db.query.eventSeries.findFirst({
      where: eq(eventSeries.slug, slug),
    });
    if (!existing) break;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  const [series] = await db
    .insert(eventSeries)
    .values({
      slug,
      name,
      description,
      organizerId: organizerUser.id,
    })
    .returning();

  return NextResponse.json({ series }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth0.getSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizerUser = await getOrUpsertOrganizerUser(session.user);
  if (!organizerUser) return NextResponse.json([], { status: 200 });

  const roles = getUserRoles(session);
  const allSeries = roles.includes("admin")
    ? await db.query.eventSeries.findMany({
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      })
    : await db.query.eventSeries.findMany({
        where: eq(eventSeries.organizerId, organizerUser.id),
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      });

  return NextResponse.json(allSeries);
}
