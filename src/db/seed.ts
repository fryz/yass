import { db } from "./index";
import { forms } from "./schema";
import type { FormField } from "@/lib/schemas/form";

const basicFormFields: FormField[] = [
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
];

async function seed() {
  await db
    .insert(forms)
    .values({
      name: "Basic",
      seriesId: null,
      fields: basicFormFields,
    })
    .onConflictDoNothing();
  console.log("Seeded Basic form template");
}

seed().catch(console.error);
