"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type AttendeeRow = {
  proposalId: string;
  signupId: string;
  userId: string;
  name: string;
  email: string;
  signedUpAt: Date;
  proposedStatus: "proposed_confirmed" | "proposed_waitlisted";
  manuallyAdjusted: boolean;
};

type FinalizedRow = {
  signupId: string;
  userId: string;
  name: string;
  email: string;
  signedUpAt: Date;
  status: string;
};

type Props = {
  eventId: string;
  eventStatus: string;
  proposedConfirmed: AttendeeRow[];
  proposedWaitlisted: AttendeeRow[];
  finalizedConfirmed: FinalizedRow[];
  finalizedWaitlisted: FinalizedRow[];
};

export default function AttendeeTabs({
  eventId,
  eventStatus,
  proposedConfirmed,
  proposedWaitlisted,
  finalizedConfirmed,
  finalizedWaitlisted,
}: Props) {
  const router = useRouter();
  const [moving, setMoving] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  async function moveAttendee(
    proposalId: string,
    newStatus: "proposed_confirmed" | "proposed_waitlisted"
  ) {
    setMoving(proposalId);
    setMoveError(null);
    try {
      const res = await fetch(`/api/organizer/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposed_status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMoveError(data.error ?? "Failed to move attendee.");
        return;
      }
      router.refresh();
    } catch {
      setMoveError("Unexpected error.");
    } finally {
      setMoving(null);
    }
  }

  if (eventStatus === "proposed") {
    return (
      <div>
        {moveError && (
          <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {moveError}
          </p>
        )}
        <Tabs defaultValue="confirmed">
          <TabsList className="mb-4">
            <TabsTrigger value="confirmed">
              Proposed Confirmed ({proposedConfirmed.length})
            </TabsTrigger>
            <TabsTrigger value="waitlisted">
              Proposed Waitlist ({proposedWaitlisted.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="confirmed">
            <AttendeeTable
              rows={proposedConfirmed}
              moveLabel="Move to Waitlist"
              moveStatus="proposed_waitlisted"
              onMove={moveAttendee}
              moving={moving}
            />
          </TabsContent>

          <TabsContent value="waitlisted">
            <AttendeeTable
              rows={proposedWaitlisted}
              moveLabel="Move to Confirmed"
              moveStatus="proposed_confirmed"
              onMove={moveAttendee}
              moving={moving}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Finalized view
  return (
    <Tabs defaultValue="confirmed">
      <TabsList className="mb-4">
        <TabsTrigger value="confirmed">
          Confirmed ({finalizedConfirmed.length})
        </TabsTrigger>
        <TabsTrigger value="waitlisted">
          Waitlist ({finalizedWaitlisted.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="confirmed">
        <FinalizedTable rows={finalizedConfirmed} />
      </TabsContent>

      <TabsContent value="waitlisted">
        <FinalizedTable rows={finalizedWaitlisted} />
      </TabsContent>
    </Tabs>
  );
}

function AttendeeTable({
  rows,
  moveLabel,
  moveStatus,
  onMove,
  moving,
}: {
  rows: AttendeeRow[];
  moveLabel: string;
  moveStatus: "proposed_confirmed" | "proposed_waitlisted";
  onMove: (
    proposalId: string,
    status: "proposed_confirmed" | "proposed_waitlisted"
  ) => void;
  moving: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center border rounded-md">
        No attendees in this category.
      </p>
    );
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left">
            <th className="px-4 py-3 font-medium text-gray-500">Name</th>
            <th className="px-4 py-3 font-medium text-gray-500">Email</th>
            <th className="px-4 py-3 font-medium text-gray-500">Signed Up</th>
            <th className="px-4 py-3 font-medium text-gray-500">Adjusted</th>
            <th className="px-4 py-3 font-medium text-gray-500"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.proposalId} className="border-t">
              <td className="px-4 py-3 font-medium">{row.name}</td>
              <td className="px-4 py-3 text-gray-600">{row.email}</td>
              <td className="px-4 py-3 text-gray-600">
                {new Date(row.signedUpAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="px-4 py-3">
                {row.manuallyAdjusted && (
                  <Badge variant="outline" className="text-xs">
                    Adjusted
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={moving === row.proposalId}
                  onClick={() => onMove(row.proposalId, moveStatus)}
                >
                  {moving === row.proposalId ? "Moving..." : moveLabel}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FinalizedTable({ rows }: { rows: FinalizedRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center border rounded-md">
        No attendees in this category.
      </p>
    );
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left">
            <th className="px-4 py-3 font-medium text-gray-500">Name</th>
            <th className="px-4 py-3 font-medium text-gray-500">Email</th>
            <th className="px-4 py-3 font-medium text-gray-500">Signed Up</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.signupId} className="border-t">
              <td className="px-4 py-3 font-medium">{row.name}</td>
              <td className="px-4 py-3 text-gray-600">{row.email}</td>
              <td className="px-4 py-3 text-gray-600">
                {new Date(row.signedUpAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
