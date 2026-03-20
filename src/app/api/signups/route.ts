import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events, users, signups, signupAttendees, forms, eventSeries } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { z } from "zod";
import { FormFieldsSchema, FormResponseSchema, type FormField } from "@/lib/schemas/form";
import { sendEmail } from "@/lib/novu";
import { unsealSession } from "@/lib/session";

const RequestSchema = z.object({
  eventId: z.string().uuid(),
  responses: z.record(z.string(), z.unknown()),
});

export async function POST(req: NextRequest) {
  // Validate signed session cookie (iron-session)
  const sessionCookie = req.cookies.get("yass_attendee_session")?.value;
  const session = sessionCookie ? await unsealSession(sessionCookie) : null;

  if (!session) {
    return NextResponse.json(
      { error: "Authentication required. Please verify your email first." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { eventId, responses } = parsed.data;

  // Session must match the eventId it was issued for
  if (session.eventId !== eventId) {
    return NextResponse.json(
      { error: "Session does not match this event. Please verify your email again." },
      { status: 401 }
    );
  }

  // Fetch event with series
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  if (event.status !== "open" || new Date(event.signupClosesAt) <= new Date()) {
    return NextResponse.json(
      { error: "This event is no longer accepting signups." },
      { status: 409 }
    );
  }

  const series = await db.query.eventSeries.findFirst({
    where: eq(eventSeries.id, event.seriesId),
  });

  // Resolve form fields for validation
  const formId = event.formId ?? series?.defaultFormId;
  let formFields: FormField[] = [];

  if (formId) {
    const form = await db.query.forms.findFirst({
      where: eq(forms.id, formId),
    });
    if (form?.fields) {
      const fieldsParsed = FormFieldsSchema.safeParse(form.fields);
      if (fieldsParsed.success) {
        formFields = fieldsParsed.data;
      }
    }
  }

  // Validate form responses
  const responsesParsed = FormResponseSchema.safeParse(responses);
  if (!responsesParsed.success) {
    return NextResponse.json(
      { error: "Invalid form responses." },
      { status: 400 }
    );
  }
  const validatedResponses = responsesParsed.data;

  // Check required fields
  for (const field of formFields) {
    if (field.required) {
      const val = validatedResponses[field.id];
      if (val === undefined || val === "" || val === null) {
        return NextResponse.json(
          { error: `Field "${field.label}" is required.` },
          { status: 400 }
        );
      }
      if (field.type === "repeater" && Array.isArray(val) && val.length === 0) {
        return NextResponse.json(
          { error: `Field "${field.label}" requires at least one entry.` },
          { status: 400 }
        );
      }
    }
  }

  // Look up or create user record (onConflictDoNothing handles concurrent inserts)
  const nameFromForm = (validatedResponses["name"] as string) ?? "";
  const [inserted] = await db
    .insert(users)
    .values({
      email: session.email,
      name: nameFromForm || session.email.split("@")[0],
    })
    .onConflictDoNothing()
    .returning();
  const user =
    inserted ??
    (await db.query.users.findFirst({ where: eq(users.email, session.email) }));

  if (!user) {
    return NextResponse.json({ error: "Failed to resolve user." }, { status: 500 });
  }

  // Check for existing non-cancelled signup
  const existingSignup = await db.query.signups.findFirst({
    where: and(
      eq(signups.eventId, eventId),
      eq(signups.userId, user.id),
      ne(signups.status, "cancelled")
    ),
  });

  if (existingSignup) {
    return NextResponse.json(
      { error: "You have already signed up for this event." },
      { status: 409 }
    );
  }

  // Generate cancel token
  const cancelToken = crypto.randomUUID();

  // Create signup
  const [signup] = await db
    .insert(signups)
    .values({
      eventId,
      userId: user.id,
      status: "submitted",
      responses: validatedResponses,
      cancelToken,
    })
    .returning();

  // Extract attendees from repeater field → insert into signup_attendees
  const repeaterField = formFields.find((f) => f.type === "repeater");
  if (repeaterField) {
    const repeaterValue = validatedResponses[repeaterField.id];
    if (Array.isArray(repeaterValue) && repeaterValue.length > 0) {
      const attendeeRows = repeaterValue.map((row, index) => {
        // Find the name sub-field (prefer "attendee_name" or "name" or first field)
        const nameSubField =
          repeaterField.subFields?.find((sf) => sf.id === "attendee_name") ??
          repeaterField.subFields?.find((sf) => sf.id === "name") ??
          repeaterField.subFields?.[0];
        const name = nameSubField ? (row[nameSubField.id] ?? "") : "";
        return {
          signupId: signup.id,
          name,
          position: index,
        };
      });

      if (attendeeRows.length > 0) {
        await db.insert(signupAttendees).values(attendeeRows);
      }
    }
  }

  // Send confirmation email via Novu (fire-and-forget)
  const cancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/my-signup/${cancelToken}`;
  const registrantName =
    (validatedResponses["name"] as string) ?? user.name ?? session.email;

  await sendEmail(session.email, "signup_received", {
    name: registrantName,
    event_name: event.name,
    event_date: new Date(event.eventDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    cancel_url: cancelUrl,
  });

  return NextResponse.json({ cancelToken });
}
