// One mistyped letter in an email silently creates a SECOND person: the same
// name appears twice with different roles, and their videos split across two
// accounts that can't see each other's half. These pin the warning that catches
// it — including the real case that prompted it.
import { describe, it, expect } from "vitest";
import { canonicalEmail, editDistance, findDuplicates } from "../src/shared/engine/identity";

describe("canonicalEmail", () => {
  it("leaves an ordinary address alone", () => {
    expect(canonicalEmail("Sam@Example.com")).toBe("sam@example.com");
  });
  it("drops gmail's ignored dots", () => {
    expect(canonicalEmail("seema.bakliwal19@gmail.com")).toBe("seemabakliwal19@gmail.com");
  });
  it("drops a +tag on any provider", () => {
    expect(canonicalEmail("sam+tracker@example.com")).toBe("sam@example.com");
  });
  it("keeps dots outside gmail — they are significant there", () => {
    expect(canonicalEmail("a.b@example.com")).toBe("a.b@example.com");
  });
  it("does not choke on a non-address", () => {
    expect(canonicalEmail("nonsense")).toBe("nonsense");
    expect(canonicalEmail("")).toBe("");
  });
});

describe("editDistance", () => {
  it("counts single-character slips", () => {
    expect(editDistance("bakliwal", "bakliwal")).toBe(0);
    expect(editDistance("balkliwal", "bakliwal")).toBe(1);   // an inserted l
    expect(editDistance("bakilwal", "bakliwal")).toBe(2);    // a swapped pair
  });
  it("gives up past the cap instead of measuring far-apart strings", () => {
    expect(editDistance("sam", "anusha", 2)).toBeGreaterThan(2);
  });
});

describe("findDuplicates", () => {
  const roster = [
    { name: "Seema", email: "seemabakliwal19@gmail.com" },
    { name: "Sam", email: "kushalbakliwal25@gmail.com" },
  ];

  it("catches the real one-letter typo that split Seema in two", () => {
    // seemaba-LK-liwal vs seemaba-K-liwal: identical at a glance, two accounts.
    const hits = findDuplicates({ name: "seema", email: "seemabalkliwal19@gmail.com" }, roster);
    expect(hits).toHaveLength(1);
    expect(hits[0].reason).toBe("typo");
    expect(hits[0].person.email).toBe("seemabakliwal19@gmail.com");
    expect(hits[0].detail).toMatch(/differs by 1 character/);
  });

  it("catches a dotted gmail spelling of an address already on the team", () => {
    const hits = findDuplicates({ name: "S", email: "seema.bakliwal19@gmail.com" }, roster);
    expect(hits[0].reason).toBe("same-address");
  });

  it("catches a +tag spelling too", () => {
    const hits = findDuplicates({ name: "S", email: "seemabakliwal19+yt@gmail.com" }, roster);
    expect(hits[0].reason).toBe("same-address");
  });

  it("flags a repeated name on a clearly different address", () => {
    const hits = findDuplicates({ name: "Sam", email: "totallyunrelated@other.org" }, roster);
    expect(hits).toHaveLength(1);
    expect(hits[0].reason).toBe("same-name");
  });

  it("is case-insensitive about the name", () => {
    expect(findDuplicates({ name: "  sAm ", email: "x@other.org" }, roster)[0].reason).toBe("same-name");
  });

  it("says nothing about the SAME record — that is an edit, not a duplicate", () => {
    expect(findDuplicates({ name: "Seema", email: "seemabakliwal19@gmail.com" }, roster)).toEqual([]);
    // Adding a role in a second system re-saves the same email; it must stay silent.
    expect(findDuplicates({ name: "Seema", email: "  SEEMABAKLIWAL19@GMAIL.COM " }, roster)).toEqual([]);
  });

  it("says nothing about a genuinely new person", () => {
    expect(findDuplicates({ name: "Nina", email: "nina@dev.local" }, roster)).toEqual([]);
  });

  it("leads with the strongest reason when several apply", () => {
    const hits = findDuplicates(
      { name: "Sam", email: "seema.bakliwal19@gmail.com" },
      roster,
    );
    expect(hits[0].reason).toBe("same-address");
    expect(hits.map((h) => h.reason)).toContain("same-name");
  });
});
