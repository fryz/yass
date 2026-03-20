"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Event = {
  id: string;
  status: string;
};

export default function EventActions({ event }: { event: Event }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transitionStatus(action: string) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizer/events/${event.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update status.");
        return;
      }
      router.refresh();
    } catch {
      setError("Unexpected error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function runSelection() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/organizer/events/${event.id}/run-selection`,
        {
          method: "POST",
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to run selection.");
        return;
      }
      router.push(`/organizer/events/${event.id}/attendees`);
    } catch {
      setError("Unexpected error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function sendEmailToAttendees() {
    router.push(`/organizer/events/${event.id}/attendees`);
  }

  return (
    <div className="space-y-3">
      {event.status === "draft" && (
        <div className="flex items-start gap-3">
          <Button
            onClick={() => transitionStatus("publish")}
            disabled={isLoading}
          >
            Publish Event
          </Button>
          <p className="text-sm text-gray-500 mt-2">
            Publishing makes the event visible to attendees and opens signups.
          </p>
        </div>
      )}

      {event.status === "open" && (
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <Button
              variant="outline"
              onClick={() => transitionStatus("close")}
              disabled={isLoading}
            >
              Close Signups
            </Button>
            <p className="text-sm text-gray-500 mt-2">
              Closes signups early. Selection can then be run.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              onClick={() => transitionStatus("reopen_draft")}
              disabled={isLoading}
            >
              Unpublish
            </Button>
            <p className="text-sm text-gray-500 mt-2">
              Only available if no signups have been submitted.
            </p>
          </div>
        </div>
      )}

      {event.status === "closed" && (
        <div className="flex items-start gap-3">
          <Button onClick={runSelection} disabled={isLoading}>
            Run Selection
          </Button>
          <p className="text-sm text-gray-500 mt-2">
            Runs the selection algorithm to propose confirmed and waitlisted
            attendees. No emails sent yet.
          </p>
        </div>
      )}

      {event.status === "proposed" && (
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <Button
              variant="outline"
              onClick={runSelection}
              disabled={isLoading}
            >
              Re-run Selection
            </Button>
            <p className="text-sm text-gray-500 mt-2">
              Re-runs the algorithm and replaces proposals. Review attendees
              first if you&apos;ve made manual adjustments.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Button onClick={sendEmailToAttendees} disabled={isLoading}>
              Review &amp; Finalize
            </Button>
            <p className="text-sm text-gray-500 mt-2">
              Review the proposed list, adjust if needed, then finalize to send
              notifications.
            </p>
          </div>
        </div>
      )}

      {event.status === "finalized" && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            This event is finalized. Attendees have been notified. You can still
            manage individual attendees from the attendees page.
          </p>
          <Button
            variant="outline"
            onClick={sendEmailToAttendees}
            disabled={isLoading}
          >
            Email Attendees
          </Button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
