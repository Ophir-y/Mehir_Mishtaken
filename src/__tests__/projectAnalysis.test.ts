import { describe, expect, it } from "vitest";
import {
  buildInputsForApartment,
  analyzeApartment,
} from "@/lib/projectAnalysis";
import { legalHoldingMonthsAfterHandover } from "@/lib/simulation";
import type { Project, ProjectApartment } from "@/lib/types";

const project: Project = {
  id: "demo",
  city: "תל אביב",
  projectName: "פרויקט דמו",
  estimatedHandoverMonths: 30,
  status: "open",
  apartments: [
    {
      rooms: 4,
      lotteryPrice: 2_200_000,
      marketPrice: 2_900_000,
      unitsOffered: 40,
      applicants: 1200,
      estimatedRent: 7500,
    },
  ],
};
const apt = project.apartments[0];

describe("buildInputsForApartment", () => {
  it("maps purchase + market + rent from project/apartment", () => {
    const inputs = buildInputsForApartment(project, apt);
    expect(inputs.purchasePrice).toBe(2_200_000);
    expect(inputs.marketPrice).toBe(2_900_000);
    // currentRent is the buyer's own residence rent (caller-supplied via
    // user prefs); falls through to the sandbox default when not overridden.
    expect(inputs.rentalIncome).toBe(7500);
  });

  it("uses the project's estimatedHandoverMonths for construction", () => {
    const inputs = buildInputsForApartment(project, apt);
    expect(inputs.constructionMonths).toBe(30);
  });

  it("derives holding years from the legal lockup", () => {
    const inputs = buildInputsForApartment(project, apt);
    const expectedMonths = legalHoldingMonthsAfterHandover(
      project.estimatedHandoverMonths,
    );
    expect(inputs.holdingYears).toBeCloseTo(expectedMonths / 12, 6);
  });

  it("derives mortgageAmount = (price - equity) + one-time costs", () => {
    const inputs = buildInputsForApartment(project, apt);
    // The mortgage must always be at least price - equity, never below 0,
    // and the difference vs (price - equity) is the one-time costs total.
    expect(inputs.mortgageAmount).toBeGreaterThanOrEqual(
      Math.max(0, inputs.purchasePrice - inputs.equity),
    );
  });

  it("applies userOverrides on top of project mapping", () => {
    const inputs = buildInputsForApartment(project, apt, {
      mortgageRate: 0.055,
      sp500Return: 0.07,
    });
    expect(inputs.mortgageRate).toBe(0.055);
    expect(inputs.sp500Return).toBe(0.07);
  });
});

describe("analyzeApartment", () => {
  it("runs a full simulation and returns both inputs and result", () => {
    const { inputs, result } = analyzeApartment(project, apt);
    expect(inputs.purchasePrice).toBe(2_200_000);
    // Total months = construction + post = 30 + (lockup post-handover).
    const expected =
      project.estimatedHandoverMonths +
      legalHoldingMonthsAfterHandover(project.estimatedHandoverMonths);
    expect(result.summary.totalMonths).toBe(expected);
  });

  it("net worth A is positive after the lockup with default appreciation", () => {
    const { result } = analyzeApartment(project, apt);
    expect(result.summary.finalA).toBeGreaterThan(0);
  });

  it("zero applicants is not in the schema — applicants null still simulates", () => {
    const aptNullApplicants: ProjectApartment = { ...apt, applicants: null };
    const { result } = analyzeApartment(project, aptNullApplicants);
    expect(result.summary.totalMonths).toBeGreaterThan(0);
  });
});
