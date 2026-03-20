import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { events, forms, eventSeries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { FormFieldsSchema, type FormField } from "@/lib/schemas/form";
import SignupForm from "@/components/SignupForm";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface PageProps {
  params: Promise<{ seriesSlug: string; eventId: string }>;
}

interface AttendeeSession {
  email: string;
  verified: boolean;
  eventId: string;
}

export default async function SignupPage({ params }: PageProps) {
  const { seriesSlug, eventId } = await params;

  // Check for valid attendee session cookie
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("yass_attendee_session");

  if (!sessionCookie?.value) {
    redirect(`/events/${seriesSlug}/${eventId}/verify`);
  }

  let session: AttendeeSession;
  try {
    session = JSON.parse(sessionCookie.value) as AttendeeSession;
  } catch {
    redirect(`/events/${seriesSlug}/${eventId}/verify`);
  }

  if (!session.verified || session.eventId !== eventId) {
    redirect(`/events/${seriesSlug}/${eventId}/verify`);
  }

  // Fetch event
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event || event.status === "draft") {
    notFound();
  }

  const series = await db.query.eventSeries.findFirst({
    where: eq(eventSeries.id, event.seriesId),
  });

  if (!series || series.slug !== seriesSlug) {
    notFound();
  }

  if (event.status !== "open" || new Date(event.signupClosesAt) <= new Date()) {
    return (
      <div className="container mx-auto max-w-md py-16 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Signups are closed</CardTitle>
            <CardDescription>
              The signup window for this event has closed.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Resolve the form (event-specific overrides series default)
  const formId = event.formId ?? series.defaultFormId;
  let formFields: FormField[] = [];

  if (formId) {
    const form = await db.query.forms.findFirst({
      where: eq(forms.id, formId),
    });

    if (form?.fields) {
      const parsed = FormFieldsSchema.safeParse(form.fields);
      if (parsed.success) {
        formFields = parsed.data;
      }
    }
  }

  return (
    <div className="container mx-auto max-w-lg py-10 px-4">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Signing up as</p>
        <p className="font-medium">{session.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{event.name}</CardTitle>
          <CardDescription>
            {new Date(event.eventDate).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-6" />
          <SignupForm
            fields={formFields}
            eventId={eventId}
            seriesSlug={seriesSlug}
          />
        </CardContent>
      </Card>
    </div>
  );
}
