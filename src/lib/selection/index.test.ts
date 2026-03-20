import { describe, it, expect } from "vitest";
import {
  selectFcfs,
  selectLottery,
  selectLotteryPreference,
  selectFcfsPreference,
  type SignupInput,
} from "./index";

// --- Test helpers ---

function makeSignup(
  id: string,
  msOffset: number = 0,
  points: number = 0,
  userId?: string
): SignupInput {
  return {
    signupId: id,
    userId: userId ?? `user-${id}`,
    signedUpAt: new Date(1000000 + msOffset),
    preferencePoints: points,
  };
}

function countByStatus(
  proposals: ReturnType<typeof selectFcfs>,
  status: "proposed_confirmed" | "proposed_waitlisted"
) {
  return proposals.filter((p) => p.proposedStatus === status).length;
}

// --- FCFS ---

describe("selectFcfs", () => {
  it("empty input returns empty output", () => {
    expect(selectFcfs([], 5)).toEqual([]);
  });

  it("n < maxAttendees: all confirmed", () => {
    const signups = [makeSignup("a", 0), makeSignup("b", 1), makeSignup("c", 2)];
    const result = selectFcfs(signups, 10);
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.proposedStatus === "proposed_confirmed")).toBe(
      true
    );
  });

  it("n === maxAttendees: all confirmed", () => {
    const signups = [makeSignup("a", 0), makeSignup("b", 1)];
    const result = selectFcfs(signups, 2);
    expect(countByStatus(result, "proposed_confirmed")).toBe(2);
    expect(countByStatus(result, "proposed_waitlisted")).toBe(0);
  });

  it("n > maxAttendees: correct confirmed/waitlisted split", () => {
    const signups = [
      makeSignup("a", 0),
      makeSignup("b", 1),
      makeSignup("c", 2),
      makeSignup("d", 3),
      makeSignup("e", 4),
    ];
    const result = selectFcfs(signups, 3);
    expect(countByStatus(result, "proposed_confirmed")).toBe(3);
    expect(countByStatus(result, "proposed_waitlisted")).toBe(2);
  });

  it("orders by signedUpAt ascending: earliest signup gets confirmed", () => {
    const signups = [
      makeSignup("late", 500),
      makeSignup("early", 0),
      makeSignup("mid", 250),
    ];
    const result = selectFcfs(signups, 1);
    const confirmed = result.find((r) => r.proposedStatus === "proposed_confirmed");
    expect(confirmed?.signupId).toBe("early");
  });

  it("all signups are present in output", () => {
    const signups = [makeSignup("a", 0), makeSignup("b", 1), makeSignup("c", 2)];
    const result = selectFcfs(signups, 2);
    const ids = result.map((r) => r.signupId).sort();
    expect(ids).toEqual(["a", "b", "c"]);
  });
});

// --- Lottery ---

describe("selectLottery", () => {
  it("empty input returns empty output", () => {
    expect(selectLottery([], 5)).toEqual([]);
  });

  it("n < maxAttendees: all confirmed", () => {
    const signups = [makeSignup("a"), makeSignup("b")];
    const result = selectLottery(signups, 10);
    expect(result.every((r) => r.proposedStatus === "proposed_confirmed")).toBe(
      true
    );
  });

  it("confirmed count = min(n, maxAttendees)", () => {
    const signups = Array.from({ length: 10 }, (_, i) => makeSignup(`s${i}`));
    const result = selectLottery(signups, 4);
    expect(countByStatus(result, "proposed_confirmed")).toBe(4);
    expect(countByStatus(result, "proposed_waitlisted")).toBe(6);
  });

  it("no duplicate signupIds in output", () => {
    const signups = Array.from({ length: 8 }, (_, i) => makeSignup(`s${i}`));
    const result = selectLottery(signups, 5);
    const ids = result.map((r) => r.signupId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("all input signups appear in output", () => {
    const signups = Array.from({ length: 6 }, (_, i) => makeSignup(`s${i}`));
    const result = selectLottery(signups, 3);
    const outputIds = new Set(result.map((r) => r.signupId));
    for (const s of signups) {
      expect(outputIds.has(s.signupId)).toBe(true);
    }
  });

  it("maxAttendees = 0: all waitlisted", () => {
    const signups = [makeSignup("a"), makeSignup("b")];
    const result = selectLottery(signups, 0);
    expect(result.every((r) => r.proposedStatus === "proposed_waitlisted")).toBe(
      true
    );
  });
});

// --- Lottery with Preference ---

describe("selectLotteryPreference", () => {
  it("empty input returns empty output", () => {
    expect(selectLotteryPreference([], 5)).toEqual([]);
  });

  it("n < maxAttendees: all confirmed", () => {
    const signups = [makeSignup("a", 0, 2), makeSignup("b", 1, 1)];
    const result = selectLotteryPreference(signups, 10);
    expect(result.every((r) => r.proposedStatus === "proposed_confirmed")).toBe(
      true
    );
  });

  it("confirmed count = min(n, maxAttendees)", () => {
    const signups = Array.from({ length: 8 }, (_, i) =>
      makeSignup(`s${i}`, i * 10, i % 3)
    );
    const result = selectLotteryPreference(signups, 5);
    expect(countByStatus(result, "proposed_confirmed")).toBe(5);
    expect(countByStatus(result, "proposed_waitlisted")).toBe(3);
  });

  it("higher points confirmed before lower points when maxAttendees is limited", () => {
    // 3 signups with high points, 3 with low — only 3 slots available
    const highPoints = [
      makeSignup("h1", 0, 5),
      makeSignup("h2", 1, 5),
      makeSignup("h3", 2, 5),
    ];
    const lowPoints = [
      makeSignup("l1", 3, 1),
      makeSignup("l2", 4, 1),
      makeSignup("l3", 5, 1),
    ];
    const result = selectLotteryPreference([...highPoints, ...lowPoints], 3);

    const confirmedIds = result
      .filter((r) => r.proposedStatus === "proposed_confirmed")
      .map((r) => r.signupId);

    expect(confirmedIds).toHaveLength(3);
    // All confirmed should be from the high-points group
    for (const id of confirmedIds) {
      expect(id.startsWith("h")).toBe(true);
    }
  });

  it("within same points group, selection is random (invariant: all members present)", () => {
    const signups = Array.from({ length: 6 }, (_, i) =>
      makeSignup(`s${i}`, i * 10, 3)
    );
    const result = selectLotteryPreference(signups, 3);
    const outputIds = new Set(result.map((r) => r.signupId));
    expect(outputIds.size).toBe(6);
  });

  it("no duplicates in output", () => {
    const signups = Array.from({ length: 10 }, (_, i) =>
      makeSignup(`s${i}`, i * 10, i % 4)
    );
    const result = selectLotteryPreference(signups, 6);
    const ids = result.map((r) => r.signupId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// --- FCFS with Preference ---

describe("selectFcfsPreference", () => {
  it("empty input returns empty output", () => {
    expect(selectFcfsPreference([], 5)).toEqual([]);
  });

  it("n < maxAttendees: all confirmed", () => {
    const signups = [makeSignup("a", 0, 3), makeSignup("b", 1, 1)];
    const result = selectFcfsPreference(signups, 10);
    expect(result.every((r) => r.proposedStatus === "proposed_confirmed")).toBe(
      true
    );
  });

  it("sorted by points desc, then signedUpAt asc within equal points", () => {
    const signups = [
      makeSignup("low-early", 0, 1),
      makeSignup("high-late", 200, 5),
      makeSignup("high-early", 100, 5),
      makeSignup("low-late", 300, 1),
      makeSignup("mid", 150, 3),
    ];
    // Expected order: high-early (5, t=100), high-late (5, t=200), mid (3, t=150),
    //                 low-early (1, t=0), low-late (1, t=300)
    const result = selectFcfsPreference(signups, 3);

    const confirmedIds = result
      .filter((r) => r.proposedStatus === "proposed_confirmed")
      .map((r) => r.signupId);

    expect(confirmedIds).toContain("high-early");
    expect(confirmedIds).toContain("high-late");
    expect(confirmedIds).toContain("mid");
  });

  it("within equal-points groups, earlier signedUpAt wins", () => {
    const signups = [
      makeSignup("later", 100, 3),
      makeSignup("earlier", 0, 3),
    ];
    const result = selectFcfsPreference(signups, 1);
    const confirmed = result.find((r) => r.proposedStatus === "proposed_confirmed");
    expect(confirmed?.signupId).toBe("earlier");
  });

  it("higher points beat earlier signup time", () => {
    const signups = [
      makeSignup("early-low", 0, 1),
      makeSignup("late-high", 999, 10),
    ];
    const result = selectFcfsPreference(signups, 1);
    const confirmed = result.find((r) => r.proposedStatus === "proposed_confirmed");
    expect(confirmed?.signupId).toBe("late-high");
  });

  it("correct confirmed/waitlisted counts", () => {
    const signups = Array.from({ length: 7 }, (_, i) =>
      makeSignup(`s${i}`, i * 10, i % 3)
    );
    const result = selectFcfsPreference(signups, 4);
    expect(countByStatus(result, "proposed_confirmed")).toBe(4);
    expect(countByStatus(result, "proposed_waitlisted")).toBe(3);
  });

  it("all input signups appear in output", () => {
    const signups = Array.from({ length: 5 }, (_, i) =>
      makeSignup(`s${i}`, i * 10, i)
    );
    const result = selectFcfsPreference(signups, 3);
    const outputIds = new Set(result.map((r) => r.signupId));
    for (const s of signups) {
      expect(outputIds.has(s.signupId)).toBe(true);
    }
  });
});
