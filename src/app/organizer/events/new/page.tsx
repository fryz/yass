"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Series = { id: string; name: string };
type Form = { id: string; name: string };

const SELECTION_LOGIC_OPTIONS = [
  { value: "fcfs", label: "First Come, First Served (FCFS)" },
  { value: "lottery", label: "Lottery (random)" },
  { value: "lottery_preference", label: "Lottery with Preference Points" },
  { value: "fcfs_preference", label: "FCFS with Preference Points" },
];

export default function NewEventPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [formsList, setFormsList] = useState<Form[]>([]);

  // Form fields
  const [seriesId, setSeriesId] = useState<string>("__new__");
  const [seriesName, setSeriesName] = useState("");
  const [seriesDescription, setSeriesDescription] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("30");
  const [signupClosesAt, setSignupClosesAt] = useState("");
  const [selectionLogic, setSelectionLogic] = useState("fcfs");
  const [formId, setFormId] = useState<string>("__none__");

  useEffect(() => {
    // Load existing series and forms
    fetch("/api/organizer/series")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSeriesList(data);
      })
      .catch(() => {});

    fetch("/api/organizer/forms")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setFormsList(data);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        name,
        description,
        event_date: eventDate ? new Date(eventDate).toISOString() : undefined,
        max_attendees: parseInt(maxAttendees, 10),
        signup_closes_at: signupClosesAt
          ? new Date(signupClosesAt).toISOString()
          : undefined,
        selection_logic: selectionLogic,
        form_id: formId !== "__none__" ? formId : undefined,
      };

      if (seriesId === "__new__") {
        body.series_name = seriesName;
        body.series_description = seriesDescription;
      } else {
        body.series_id = seriesId;
      }

      const res = await fetch("/api/organizer/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create event.");
        return;
      }

      router.push(`/organizer/events/${data.event.id}`);
    } catch {
      setError("Unexpected error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create Event</h1>
        <p className="text-sm text-gray-500 mt-1">
          New events start as drafts and must be published before signups open.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Series */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event Series</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Series</Label>
              <Select value={seriesId} onValueChange={setSeriesId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select or create a series" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">+ Create new series</SelectItem>
                  {seriesList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {seriesId === "__new__" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="series-name">Series Name</Label>
                  <Input
                    id="series-name"
                    value={seriesName}
                    onChange={(e) => setSeriesName(e.target.value)}
                    placeholder="e.g. Coastal Hiking Group"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="series-desc">Series Description</Label>
                  <Textarea
                    id="series-desc"
                    value={seriesDescription}
                    onChange={(e) => setSeriesDescription(e.target.value)}
                    placeholder="Brief description of this series"
                    rows={2}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Event details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event-name">Event Name</Label>
              <Input
                id="event-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Spring Hike 2026"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-desc">Description</Label>
              <Textarea
                id="event-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What attendees need to know about this event"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-date">Event Date & Time</Label>
                <Input
                  id="event-date"
                  type="datetime-local"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-attendees">Max Attendees</Label>
                <Input
                  id="max-attendees"
                  type="number"
                  min="1"
                  value={maxAttendees}
                  onChange={(e) => setMaxAttendees(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="closes-at">Signup Closes At</Label>
              <Input
                id="closes-at"
                type="datetime-local"
                value={signupClosesAt}
                onChange={(e) => setSignupClosesAt(e.target.value)}
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Selection & Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Selection & Form</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Selection Algorithm</Label>
              <Select value={selectionLogic} onValueChange={setSelectionLogic}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SELECTION_LOGIC_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Preference points algorithms track fairness across events in the
                same series.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Signup Form (optional)</Label>
              <Select value={formId} onValueChange={setFormId}>
                <SelectTrigger>
                  <SelectValue placeholder="Use series default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Use series default</SelectItem>
                  {formsList.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Leave blank to use your series&apos; default form. Override
                here for one-off events.
              </p>
            </div>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Event"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/organizer/events")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
