"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormField } from "@/lib/schemas/form";

interface SignupFormProps {
  fields: FormField[];
  eventId: string;
  seriesSlug: string;
}

type FormValues = Record<string, string | boolean | Record<string, string>[]>;

function RepeaterField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FormField;
  value: Record<string, string>[];
  onChange: (value: Record<string, string>[]) => void;
  disabled: boolean;
}) {
  const subFields = field.subFields ?? [];

  const addRow = () => {
    const emptyRow: Record<string, string> = {};
    subFields.forEach((sf) => {
      emptyRow[sf.id] = "";
    });
    onChange([...value, emptyRow]);
  };

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, subFieldId: string, val: string) => {
    const updated = value.map((row, i) => {
      if (i !== index) return row;
      return { ...row, [subFieldId]: val };
    });
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {value.map((row, index) => (
        <div key={index} className="rounded-md border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {index === 0 ? "You (registrant)" : `Guest ${index}`}
            </span>
            {index > 0 && (
              <button
                type="button"
                onClick={() => removeRow(index)}
                disabled={disabled}
                className="text-xs text-destructive hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
          {subFields.map((sf) => (
            <div key={sf.id} className="space-y-1">
              <Label htmlFor={`${field.id}-${index}-${sf.id}`} className="text-sm">
                {sf.label}
                {sf.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Input
                id={`${field.id}-${index}-${sf.id}`}
                type="text"
                value={row[sf.id] ?? ""}
                onChange={(e) => updateRow(index, sf.id, e.target.value)}
                required={sf.required && index === 0}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        disabled={disabled}
      >
        + Add guest
      </Button>
    </div>
  );
}

function renderField(
  field: FormField,
  values: FormValues,
  setValues: React.Dispatch<React.SetStateAction<FormValues>>,
  disabled: boolean
) {
  const value = values[field.id];

  switch (field.type) {
    case "text":
    case "email":
      return (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={field.id}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={field.id}
            type={field.type}
            value={(value as string) ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [field.id]: e.target.value }))
            }
            required={field.required}
            disabled={disabled}
          />
        </div>
      );

    case "select":
      return (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={field.id}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <select
            id={field.id}
            value={(value as string) ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [field.id]: e.target.value }))
            }
            required={field.required}
            disabled={disabled}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Select an option</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );

    case "checkbox":
      return (
        <div key={field.id} className="flex items-center gap-2">
          <input
            id={field.id}
            type="checkbox"
            checked={(value as boolean) ?? false}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [field.id]: e.target.checked }))
            }
            required={field.required}
            disabled={disabled}
            className="h-4 w-4 rounded border-input"
          />
          <Label htmlFor={field.id}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
        </div>
      );

    case "repeater": {
      const subFields = field.subFields ?? [];
      // Initialize with one empty row if empty
      const rows = (value as Record<string, string>[]) ?? [];
      if (rows.length === 0) {
        const emptyRow: Record<string, string> = {};
        subFields.forEach((sf) => {
          emptyRow[sf.id] = "";
        });
        // Set default synchronously on first render via initializer
      }

      return (
        <div key={field.id} className="space-y-2">
          <Label>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <RepeaterField
            field={field}
            value={(value as Record<string, string>[]) ?? []}
            onChange={(newVal) =>
              setValues((prev) => ({ ...prev, [field.id]: newVal }))
            }
            disabled={disabled}
          />
        </div>
      );
    }

    default:
      return null;
  }
}

export default function SignupForm({ fields, eventId, seriesSlug }: SignupFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form values with defaults
  const buildInitialValues = (): FormValues => {
    const initial: FormValues = {};
    for (const field of fields) {
      if (field.type === "checkbox") {
        initial[field.id] = false;
      } else if (field.type === "repeater") {
        const emptyRow: Record<string, string> = {};
        (field.subFields ?? []).forEach((sf) => {
          emptyRow[sf.id] = "";
        });
        initial[field.id] = [emptyRow];
      } else {
        initial[field.id] = "";
      }
    }
    return initial;
  };

  const [values, setValues] = useState<FormValues>(buildInitialValues);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, responses: values }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError(data.error ?? "You have already signed up for this event.");
        } else if (res.status === 401) {
          // Session expired — redirect to verify
          router.push(`/events/${seriesSlug}/${eventId}/verify`);
          return;
        } else {
          setError(data.error ?? "Something went wrong. Please try again.");
        }
        return;
      }

      const { cancelToken } = data as { cancelToken: string };
      router.push(`/my-signup/${cancelToken}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (fields.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          No additional information is required. Click below to submit your signup.
        </p>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full"
        >
          {loading ? "Submitting…" : "Submit signup"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {fields.map((field) => renderField(field, values, setValues, loading))}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Submitting…" : "Submit signup"}
      </Button>
    </form>
  );
}
