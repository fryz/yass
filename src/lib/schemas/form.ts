import { z } from "zod";

export const FormFieldSchema: z.ZodType<FormField> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.enum(["text", "email", "select", "checkbox", "repeater"]),
    label: z.string(),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
    subFields: z.array(FormFieldSchema).optional(),
  })
);

export type FormField = {
  id: string;
  type: "text" | "email" | "select" | "checkbox" | "repeater";
  label: string;
  required: boolean;
  options?: string[];
  subFields?: FormField[];
};

export const FormFieldsSchema = z.array(FormFieldSchema);

export const FormResponseSchema = z.record(
  z.string(),
  z.union([
    z.string(),
    z.boolean(),
    z.array(z.record(z.string(), z.string())),
  ])
);
export type FormResponse = z.infer<typeof FormResponseSchema>;
