export type SignupInput = {
  signupId: string;
  userId: string;
  signedUpAt: Date;
  preferencePoints: number;
};

export type ProposalOutput = {
  signupId: string;
  proposedStatus: "proposed_confirmed" | "proposed_waitlisted";
};

/**
 * FCFS: First-come, first-served.
 * Sort by signedUpAt ascending; first maxAttendees → confirmed, rest → waitlisted.
 */
export function selectFcfs(
  signups: SignupInput[],
  maxAttendees: number
): ProposalOutput[] {
  const sorted = [...signups].sort(
    (a, b) => a.signedUpAt.getTime() - b.signedUpAt.getTime()
  );
  return sorted.map((s, i) => ({
    signupId: s.signupId,
    proposedStatus:
      i < maxAttendees ? "proposed_confirmed" : "proposed_waitlisted",
  }));
}

/**
 * Lottery: Pure random shuffle.
 * First maxAttendees → confirmed, rest → waitlisted.
 */
export function selectLottery(
  signups: SignupInput[],
  maxAttendees: number
): ProposalOutput[] {
  const shuffled = fisherYatesShuffle([...signups]);
  return shuffled.map((s, i) => ({
    signupId: s.signupId,
    proposedStatus:
      i < maxAttendees ? "proposed_confirmed" : "proposed_waitlisted",
  }));
}

/**
 * Lottery with Preference:
 * Group by exact preference points value, descending order of points.
 * Within each group, shuffle randomly.
 * First maxAttendees across all groups → confirmed, rest → waitlisted.
 */
export function selectLotteryPreference(
  signups: SignupInput[],
  maxAttendees: number
): ProposalOutput[] {
  // Group by points
  const groups = new Map<number, SignupInput[]>();
  for (const s of signups) {
    const bucket = groups.get(s.preferencePoints) ?? [];
    bucket.push(s);
    groups.set(s.preferencePoints, bucket);
  }

  // Sort groups descending by points, shuffle within each group
  const sortedGroupKeys = [...groups.keys()].sort((a, b) => b - a);
  const ordered: SignupInput[] = [];
  for (const key of sortedGroupKeys) {
    ordered.push(...fisherYatesShuffle(groups.get(key)!));
  }

  return ordered.map((s, i) => ({
    signupId: s.signupId,
    proposedStatus:
      i < maxAttendees ? "proposed_confirmed" : "proposed_waitlisted",
  }));
}

/**
 * FCFS with Preference:
 * Sort by preference points descending, then signedUpAt ascending within equal-points groups.
 * First maxAttendees → confirmed, rest → waitlisted.
 */
export function selectFcfsPreference(
  signups: SignupInput[],
  maxAttendees: number
): ProposalOutput[] {
  const sorted = [...signups].sort((a, b) => {
    if (b.preferencePoints !== a.preferencePoints) {
      return b.preferencePoints - a.preferencePoints; // higher points first
    }
    return a.signedUpAt.getTime() - b.signedUpAt.getTime(); // earlier signup first
  });

  return sorted.map((s, i) => ({
    signupId: s.signupId,
    proposedStatus:
      i < maxAttendees ? "proposed_confirmed" : "proposed_waitlisted",
  }));
}

/**
 * Fisher-Yates shuffle (in-place, returns array).
 */
function fisherYatesShuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
