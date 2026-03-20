import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { eventSeries, forms, users } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
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
import { FormFieldsSchema, type FormField } from "@/lib/schemas/form";

export default async function FormsPage() {
  const session = await auth0.getSession();
  if (!session?.user) redirect("/auth/login?returnTo=/organizer/forms");

  const organizerUser = await db.query.users.findFirst({
    where: eq(users.email, session.user.email!),
  });

  // Get all series for this organizer
  const allSeries = organizerUser
    ? await db.query.eventSeries.findMany({
        where: eq(eventSeries.organizerId, organizerUser.id),
      })
    : [];

  const seriesIds = allSeries.map((s) => s.id);

  // Get all forms associated with organizer's series
  const allForms =
    seriesIds.length > 0
      ? await db.query.forms.findMany({
          where: inArray(forms.seriesId, seriesIds),
          orderBy: (f, { desc }) => [desc(f.createdAt)],
        })
      : [];

  const seriesById = new Map(allSeries.map((s) => [s.id, s]));

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Forms</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage signup forms for your event series
          </p>
        </div>
      </div>

      {allForms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-2">No custom forms yet.</p>
            <p className="text-sm text-gray-400">
              Forms are created automatically when you create a series. You can
              customize them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {allForms.map((form) => {
            const parsed = FormFieldsSchema.safeParse(form.fields);
            const fieldCount = parsed.success ? parsed.data.length : 0;
            const series = form.seriesId
              ? seriesById.get(form.seriesId)
              : null;

            return (
              <Card key={form.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{form.name}</CardTitle>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/organizer/forms/${form.id}/edit`}>
                        Edit
                      </Link>
                    </Button>
                  </div>
                  {series && (
                    <CardDescription>Series: {series.name}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    {fieldCount} field{fieldCount !== 1 ? "s" : ""}
                    {parsed.success &&
                      `: ${parsed.data.map((f: FormField) => f.label).join(", ")}`}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
