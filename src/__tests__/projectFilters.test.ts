import { describe, expect, it } from "vitest";
import {
  daysUntilClose,
  isOpenForRegistration,
} from "@/lib/projectFilters";
import type { Project } from "@/lib/types";

function mk(overrides: Partial<Project> = {}): Project {
  return {
    id: "t",
    city: "תל אביב",
    projectName: "פרויקט בדיקה",
    estimatedHandoverMonths: 24,
    apartments: [],
    status: "open",
    ...overrides,
  };
}

const NOW = new Date("2026-06-14T12:00:00Z");

describe("isOpenForRegistration", () => {
  it("status=open with future close date → true", () => {
    const p = mk({
      status: "open",
      registrationClosesAt: "2026-06-30T23:59:59Z",
    });
    expect(isOpenForRegistration(p, NOW)).toBe(true);
  });

  it("status=open with past close date → false (stale data defence)", () => {
    const p = mk({
      status: "open",
      registrationClosesAt: "2026-05-01T00:00:00Z",
    });
    expect(isOpenForRegistration(p, NOW)).toBe(false);
  });

  it("status=open with no close date → true (no enforcement available)", () => {
    expect(isOpenForRegistration(mk({ status: "open" }), NOW)).toBe(true);
  });

  it("status=upcoming → false", () => {
    expect(
      isOpenForRegistration(
        mk({
          status: "upcoming",
          registrationOpensAt: "2026-07-01T00:00:00Z",
        }),
        NOW,
      ),
    ).toBe(false);
  });

  it("status=closed → false", () => {
    expect(isOpenForRegistration(mk({ status: "closed" }), NOW)).toBe(false);
  });

  it("status=drawn → false", () => {
    expect(isOpenForRegistration(mk({ status: "drawn" }), NOW)).toBe(false);
  });
});

describe("daysUntilClose", () => {
  it("returns null when no close date", () => {
    expect(daysUntilClose(mk(), NOW)).toBeNull();
  });

  it("returns 0 for past dates (clamped, not negative)", () => {
    const p = mk({ registrationClosesAt: "2026-05-01T00:00:00Z" });
    expect(daysUntilClose(p, NOW)).toBe(0);
  });

  it("returns days remaining for future dates", () => {
    const p = mk({ registrationClosesAt: "2026-06-21T12:00:00Z" }); // exactly 7 days
    expect(daysUntilClose(p, NOW)).toBe(7);
  });
});
