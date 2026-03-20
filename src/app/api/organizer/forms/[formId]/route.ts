import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { eventSeries, forms, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { FormFieldsSchema } from "@/lib/schemas/form";
import { getOrUpsertOrganizerUser } from "@/lib/get-organizer-user";

const LOCKED_FIELD_IDS = new Set(["name", "email", "attendees"]);

function getUserRoles(session: { user: Record<string, unknown> }): string[] {
  return (
    (session.user["https://yass.app/roles"] as string[] | undefined) ??
    (session.user["roles"] as string[] | undefined) ??
    []
  );
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params;

  const session = await auth0.getSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate fields
  const fieldsRaw = (body as Record<string, unknown>)?.fields;
  const parsed = FormFieldsSchema.safeParse(fieldsRaw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid form fields.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const newFields = parsed.data;

  // Ensure locked fields are not removed
  const fieldIds = new Set(newFields.map((f) => f.id));
  for (const lockedId of LOCKED_FIELD_IDS) {
    if (!fieldIds.has(lockedId)) {
      return NextResponse.json(
        { error: `Required field '${lockedId}' cannot be removed.` },
        { status: 400 }
      );
    }
  }

  // Check form exists
  const form = await db.query.forms.findFirst({
    where: eq(forms.id, formId),
  });
  if (!form) {
    return NextResponse.json({ error: "Form not found." }, { status: 404 });
  }

  // Check ownership via series
  if (form.seriesId) {
    const series = await db.query.eventSeries.findFirst({
      where: eq(eventSeries.id, form.seriesId),
    });
    const organizerUser = await getOrUpsertOrganizerUser(session.user);
    const roles = getUserRoles(session);
    const isAdmin = roles.includes("admin");
    if (!isAdmin && series?.organizerId !== organizerUser?.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
  }

  const [updated] = await db
    .update(forms)
    .set({ fields: newFields, updatedAt: new Date() })
    .where(eq(forms.id, formId))
    .returning();

  return NextResponse.json({ form: updated });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params;

  const session = await auth0.getSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await db.query.forms.findFirst({
    where: eq(forms.id, formId),
  });
  if (!form) {
    return NextResponse.json({ error: "Form not found." }, { status: 404 });
  }

  return NextResponse.json({ form });
}
