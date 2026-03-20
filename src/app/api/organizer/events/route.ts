import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { eventSeries, events, forms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getOrUpsertOrganizerUser } from "@/lib/get-organizer-user";

const CreateEventSchema = z.object({
  // Series: either reference existing or create new
  series_id: z.string().uuid().optional(),
  series_name: z.string().min(1).optional(),
  series_description: z.string().optional(),
  // Event fields
  name: z.string().min(1),
  description: z.string().optional(),
  event_date: z.string().datetime(),
  max_attendees: z.number().int().positive(),
  signup_closes_at: z.string().datetime(),
  selection_logic: z.enum(["fcfs", "lottery", "lottery_preference", "fcfs_preference"]),
  form_id: z.string().uuid().optional(),
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

  const parsed = CreateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Must have either series_id or series_name
  if (!data.series_id && !data.series_name) {
    return NextResponse.json(
      { error: "Either series_id or series_name is required." },
      { status: 400 }
    );
  }

  const organizerUser = await getOrUpsertOrganizerUser(session.user);
  if (!organizerUser) {
    return NextResponse.json({ error: "Organizer user not found." }, { status: 404 });
  }

  let seriesId: string;

  if (data.series_id) {
    // Validate series ownership
    const series = await db.query.eventSeries.findFirst({
      where: eq(eventSeries.id, data.series_id),
    });
    if (!series) {
      return NextResponse.json({ error: "Series not found." }, { status: 404 });
    }
    if (!roles.includes("admin") && series.organizerId !== organizerUser.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    seriesId = series.id;
  } else {
    // Create new series
    const baseSlug = slugify(data.series_name!);
    let slug = baseSlug;
    let attempt = 0;
    // Ensure unique slug
    while (true) {
      const existing = await db.query.eventSeries.findFirst({
        where: eq(eventSeries.slug, slug),
      });
      if (!existing) break;
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    // Create a default Basic form for the series
    const [basicForm] = await db
      .insert(forms)
      .values({
        name: "Basic",
        fields: [
          { id: "name", type: "text", label: "Your name", required: true },
          { id: "email", type: "email", label: "Email address", required: true },
          {
            id: "attendees",
            type: "repeater",
            label: "Who is attending?",
            required: true,
            subFields: [
              { id: "attendee_name", type: "text", label: "Name", required: true },
            ],
          },
        ],
      })
      .returning();

    const [newSeries] = await db
      .insert(eventSeries)
      .values({
        slug,
        name: data.series_name!,
        description: data.series_description,
        organizerId: organizerUser.id,
        defaultFormId: basicForm.id,
      })
      .returning();

    // Update form's seriesId now that we have the series
    await db
      .update(forms)
      .set({ seriesId: newSeries.id })
      .where(eq(forms.id, basicForm.id));

    seriesId = newSeries.id;
  }

  // Create the event
  const [event] = await db
    .insert(events)
    .values({
      seriesId,
      name: data.name,
      description: data.description,
      eventDate: new Date(data.event_date),
      maxAttendees: data.max_attendees,
      signupClosesAt: new Date(data.signup_closes_at),
      selectionLogic: data.selection_logic,
      formId: data.form_id,
      status: "draft",
    })
    .returning();

  return NextResponse.json({ event }, { status: 201 });
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
    ? await db.query.eventSeries.findMany()
    : await db.query.eventSeries.findMany({
        where: eq(eventSeries.organizerId, organizerUser.id),
      });

  const seriesIds = allSeries.map((s) => s.id);
  if (seriesIds.length === 0) return NextResponse.json([], { status: 200 });

  const allEvents = await db.query.events.findMany({
    orderBy: (e, { desc }) => [desc(e.createdAt)],
  });

  const filtered = allEvents.filter((e) => seriesIds.includes(e.seriesId));
  return NextResponse.json(filtered);
}
