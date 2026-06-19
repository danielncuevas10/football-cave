import { describe, it, expect } from "vitest";
import { getThirdAssignments } from "./thirdsLookup";
import type { GroupLetter } from "@/types/bracket";

// Run with: npx vitest lib/bracket/thirdsLookup.test.ts
// (add vitest to devDependencies first: npm i -D vitest)

describe("getThirdAssignments", () => {
  const ABCDEFGH: GroupLetter[] = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const ABCDEFGI: GroupLetter[] = ["A", "B", "C", "D", "E", "F", "G", "I"];
  const ABCEFGIJ: GroupLetter[] = ["A", "B", "C", "E", "F", "G", "I", "J"];

  it("returns correct assignments for stub row ABCDEFGH", () => {
    const result = getThirdAssignments(ABCDEFGH);
    expect(result).not.toBeNull();
    expect(result!["R32_T1"]).toBe("H");
    expect(result!["R32_T2"]).toBe("F");
    expect(result!["R32_T3"]).toBe("B");
    expect(result!["R32_T4"]).toBe("C");
    expect(result!["R32_T5"]).toBe("A");
    expect(result!["R32_T6"]).toBe("G");
    expect(result!["R32_T7"]).toBe("D");
    expect(result!["R32_T8"]).toBe("E");
  });

  it("returns correct assignments for stub row ABCDEFGI", () => {
    const result = getThirdAssignments(ABCDEFGI);
    expect(result).not.toBeNull();
    expect(result!["R32_T8"]).toBe("I");
    expect(result!["R32_T7"]).toBe("D");
  });

  it("returns correct assignments for stub row ABCEFGIJ", () => {
    const result = getThirdAssignments(ABCEFGIJ);
    expect(result).not.toBeNull();
    expect(result!["R32_T1"]).toBe("C");
    expect(result!["R32_T7"]).toBe("J");
  });

  it("is order-independent — shuffled input gives same result", () => {
    const shuffled: GroupLetter[] = ["H", "G", "F", "E", "D", "C", "B", "A"];
    expect(getThirdAssignments(shuffled)).toEqual(
      getThirdAssignments(ABCDEFGH)
    );
  });

  it("returns null for an unstubbed combination", () => {
    const unstubbed: GroupLetter[] = ["A", "B", "C", "D", "E", "F", "G", "K"];
    const result = getThirdAssignments(unstubbed);
    expect(result).toBeNull();
  });

  it("throws when given fewer than 8 groups", () => {
    const tooFew: GroupLetter[] = ["A", "B", "C"];
    expect(() => getThirdAssignments(tooFew)).toThrow(
      "Expected exactly 8 qualifying groups, got 3"
    );
  });

  it("throws when given more than 8 groups", () => {
    const tooMany: GroupLetter[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
    expect(() => getThirdAssignments(tooMany)).toThrow(
      "Expected exactly 8 qualifying groups, got 9"
    );
  });

  it("each stub row assigns all 8 qualifying groups exactly once", () => {
    const combos = [ABCDEFGH, ABCDEFGI, ABCEFGIJ];
    combos.forEach((groups) => {
      const result = getThirdAssignments(groups);
      expect(result).not.toBeNull();
      const assigned = Object.values(result!);
      const uniqueAssigned = new Set(assigned);
      expect(uniqueAssigned.size).toBe(8);
      // Every assigned group must be in the qualifying set
      const qualifyingSet = new Set(groups);
      assigned.forEach((g) => expect(qualifyingSet.has(g as GroupLetter)).toBe(true));
    });
  });
});
