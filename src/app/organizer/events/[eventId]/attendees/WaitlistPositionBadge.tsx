import { Badge } from "@/components/ui/badge";

interface WaitlistPositionBadgeProps {
  position: number;
}

export function WaitlistPositionBadge({ position }: WaitlistPositionBadgeProps) {
  return (
    <Badge className="bg-orange-100 text-orange-800 border-orange-200">
      Waitlist #{position}
    </Badge>
  );
}
