import { describe, it, expect } from "vitest";
import { atLeast, type Role } from "../src/lib/permissions";

describe("workspace role hierarchy", () => {
  const cases: Array<[Role, Role, boolean]> = [
    // [actual role, required minimum, expected]
    ["OWNER", "VIEWER", true],
    ["OWNER", "MEMBER", true],
    ["OWNER", "ADMIN", true],
    ["OWNER", "OWNER", true],
    ["ADMIN", "VIEWER", true],
    ["ADMIN", "MEMBER", true],
    ["ADMIN", "ADMIN", true],
    ["ADMIN", "OWNER", false],
    ["MEMBER", "VIEWER", true],
    ["MEMBER", "MEMBER", true],
    ["MEMBER", "ADMIN", false],
    ["MEMBER", "OWNER", false],
    ["VIEWER", "VIEWER", true],
    ["VIEWER", "MEMBER", false],
    ["VIEWER", "ADMIN", false],
    ["VIEWER", "OWNER", false],
  ];

  it.each(cases)("atLeast(%s, %s) === %s", (role, min, expected) => {
    expect(atLeast(role, min)).toBe(expected);
  });

  it("orders roles strictly", () => {
    expect(atLeast("OWNER", "ADMIN")).toBe(true);
    expect(atLeast("ADMIN", "MEMBER")).toBe(true);
    expect(atLeast("MEMBER", "VIEWER")).toBe(true);
    // and not the reverse
    expect(atLeast("VIEWER", "MEMBER")).toBe(false);
  });
});
