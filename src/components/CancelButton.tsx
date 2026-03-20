"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface CancelButtonProps {
  cancelToken: string;
}

export default function CancelButton({ cancelToken }: CancelButtonProps) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleCancel = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/signups/cancel?token=${encodeURIComponent(cancelToken)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to cancel. Please try again.");
        setConfirming(false);
        return;
      }

      // Refresh the page to show cancelled state
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2 text-right">
      {confirming && !loading && (
        <p className="text-sm text-muted-foreground">
          Are you sure? This cannot be undone.
        </p>
      )}
      <div className="flex gap-2 justify-end">
        {confirming && !loading && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirming(false)}
          >
            Keep signup
          </Button>
        )}
        <Button
          variant="destructive"
          size="sm"
          onClick={handleCancel}
          disabled={loading}
        >
          {loading ? "Cancelling…" : confirming ? "Yes, cancel my signup" : "Cancel signup"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
