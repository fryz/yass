import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { eventSeries, forms, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { FormFieldsSchema } from "@/lib/schemas/form";
import FormBuilder from "./FormBuilder";

export default async function FormEditPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  const session = await auth0.getSession();
  if (!session?.user) redirect("/auth/login");

  const form = await db.query.forms.findFirst({
    where: eq(forms.id, formId),
  });
  if (!form) notFound();

  // Check ownership via series
  if (form.seriesId) {
    const series = await db.query.eventSeries.findFirst({
      where: eq(eventSeries.id, form.seriesId),
    });
    const organizerUser = await db.query.users.findFirst({
      where: eq(users.email, session.user.email!),
    });
    const userRoles: string[] =
      (session.user["https://yass.app/roles"] as string[] | undefined) ??
      (session.user["roles"] as string[] | undefined) ??
      [];
    const isAdmin = userRoles.includes("admin");
    if (!isAdmin && series?.organizerId !== organizerUser?.id) {
      redirect("/organizer/forms");
    }
  }

  const parsed = FormFieldsSchema.safeParse(form.fields);
  const fields = parsed.success ? parsed.data : [];

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Edit Form: {form.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Drag to reorder fields. Required fields (Name, Email, Attendees) cannot
          be removed.
        </p>
      </div>
      <FormBuilder formId={formId} initialFields={fields} />
    </div>
  );
}
