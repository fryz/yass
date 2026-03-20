"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FormField } from "@/lib/schemas/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

const REQUIRED_FIELD_IDS = new Set(["name", "email", "attendees"]);

function SortableField({
  field,
  onRemove,
  onLabelChange,
  isRequired,
}: {
  field: FormField;
  onRemove: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
  isRequired: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id, disabled: isRequired });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-white border rounded-md"
    >
      <div
        {...(isRequired ? {} : { ...attributes, ...listeners })}
        className={`text-gray-400 select-none ${isRequired ? "cursor-not-allowed opacity-30" : "cursor-grab"}`}
        title={isRequired ? "Required field — cannot be reordered" : "Drag to reorder"}
      >
        ⠿
      </div>
      <div className="flex-1 flex items-center gap-3">
        <div className="flex-1">
          <Input
            value={field.label}
            onChange={(e) => onLabelChange(field.id, e.target.value)}
            disabled={isRequired}
            className="h-8 text-sm"
          />
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-mono">
          {field.type}
        </span>
        {field.required && (
          <span className="text-xs text-red-500">required</span>
        )}
      </div>
      {!isRequired && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(field.id)}
          className="text-gray-400 hover:text-red-500 h-7 w-7 p-0"
        >
          ×
        </Button>
      )}
    </div>
  );
}

export default function FormBuilder({
  formId,
  initialFields,
}: {
  formId: string;
  initialFields: FormField[];
}) {
  const router = useRouter();
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // New field state
  const [newFieldType, setNewFieldType] = useState<FormField["type"]>("text");
  const [newFieldLabel, setNewFieldLabel] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setFields((items) => {
      const oldIndex = items.findIndex((f) => f.id === active.id);
      const newIndex = items.findIndex((f) => f.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  function updateLabel(id: string, label: string) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, label } : f)));
  }

  function addField() {
    if (!newFieldLabel.trim()) return;
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type: newFieldType,
      label: newFieldLabel.trim(),
      required: false,
    };
    setFields((prev) => [...prev, newField]);
    setNewFieldLabel("");
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/organizer/forms/${formId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save form.");
        return;
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      router.refresh();
    } catch {
      setError("Unexpected error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={fields.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {fields.map((field) => (
              <SortableField
                key={field.id}
                field={field}
                isRequired={REQUIRED_FIELD_IDS.has(field.id)}
                onRemove={removeField}
                onLabelChange={updateLabel}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {fields.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4 border-2 border-dashed rounded-md">
          No fields. Add a field below.
        </p>
      )}

      {/* Add field row */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Add Field</p>
          <div className="flex gap-2">
            <Select
              value={newFieldType}
              onValueChange={(v) => setNewFieldType(v as FormField["type"])}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="select">Select</SelectItem>
                <SelectItem value="checkbox">Checkbox</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Field label"
              value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addField()}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={addField}
              disabled={!newFieldLabel.trim()}
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded px-3 py-2">
          Form saved successfully.
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Form"}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/organizer/forms")}
        >
          Back to Forms
        </Button>
      </div>
    </div>
  );
}
