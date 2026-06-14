import { type SimulationInputs } from "@/lib/simulation";
import { analyzeApartment, fastMetrics } from "@/lib/projectAnalysis";
import type {
  Project,
  ProjectApartment,
  ScoredApartment,
  ScoredProject,
} from "@/lib/types";

/**
 * Per-factor weights (sum = 1.0). Tune here — every other consumer reads
 * `scoreApartment().breakdown` and the weighted composite.
 */
export const SCORING_WEIGHTS = {
  discount: 0.25,
  realReturn: 0.35,
  rentalYield: 0.15,
  winProbability: 0.20,
  equityBurden: 0.05,
} as const;

/** Clamp x into [0, 100]. */
function clamp100(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

/**
 * Linear-rescale `value` so that `lowAnchor` maps to 0 and `highAnchor` maps
 * to 100. Used to convert raw factors to a 0-100 score with sensible anchors.
 */
function rescale(value: number, lowAnchor: number, highAnchor: number): number {
  if (highAnchor === lowAnchor) return 0;
  return clamp100(((value - lowAnchor) / (highAnchor - lowAnchor)) * 100);
}

export function scoreApartment(
  project: Project,
  apt: ProjectApartment,
  userOverrides: Partial<SimulationInputs> = {},
): ScoredApartment {
  // Run the full simulation once — the source of truth for the real-return
  // metric. Other metrics are derived without re-running it.
  const { inputs, result } = analyzeApartment(project, apt, userOverrides);
  const { monthlyMortgage, rentalYieldGross } = fastMetrics(apt, inputs);

  const discountAbsolute = Math.max(0, apt.marketPrice - apt.lotteryPrice);
  const discountFraction =
    apt.marketPrice > 0 ? discountAbsolute / apt.marketPrice : 0;

  // Real return: ((finalA - upfront cash) / upfront cash) / holdingYears.
  // upfrontCash = equity + one-time costs that the buyer actually paid in
  // cash. Since one-time costs are financed in the mortgage in our model,
  // the cash outflow is just `equity`.
  const upfront = Math.max(1, inputs.equity);
  const totalReturn = (result.summary.finalA - upfront) / upfront;
  const annualReturnPct =
    inputs.holdingYears > 0 ? totalReturn / inputs.holdingYears : 0;

  // Winning probability — apartments / applicants. If applicants is unknown,
  // we conservatively assign 0.05 (a guess) so the project still ranks but
  // doesn't dominate.
  const winProbability =
    apt.applicants && apt.applicants > 0
      ? Math.min(1, apt.unitsOffered / apt.applicants)
      : 0.05;

  // Approximate B-scenario monthly cash flow once the apartment is rented.
  // (Mortgage + opex - net rental income from the simulation's first
  // post-handover month, if available.)
  const firstPost = result.monthly.find((r) => r.phase === "post");
  const monthlyCashFlowB = firstPost
    ? firstPost.netRentalIncome -
      firstPost.mortgagePayment -
      firstPost.insurancePaid -
      firstPost.hoaPaid
    : 0;

  // ---- 0..100 normalization with realistic anchors ----
  const discountScore = rescale(discountFraction, 0.10, 0.35); // 10% → 0, 35% → 100
  const realReturnScore = rescale(annualReturnPct, 0.0, 0.20); // 0%/y → 0, 20%/y → 100
  const rentalYieldScore = rescale(rentalYieldGross, 0.02, 0.06); // 2% → 0, 6% → 100
  const winProbScore = rescale(winProbability, 0.005, 0.10); // 0.5% → 0, 10% → 100
  // Equity burden — smaller equity = higher score. Anchor 1.5M → 0, 200K → 100.
  const equityBurdenScore = rescale(-inputs.equity, -1_500_000, -200_000);

  const composite =
    SCORING_WEIGHTS.discount * discountScore +
    SCORING_WEIGHTS.realReturn * realReturnScore +
    SCORING_WEIGHTS.rentalYield * rentalYieldScore +
    SCORING_WEIGHTS.winProbability * winProbScore +
    SCORING_WEIGHTS.equityBurden * equityBurdenScore;

  return {
    project,
    apt,
    score: clamp100(composite),
    breakdown: {
      discount: discountScore,
      realReturn: realReturnScore,
      rentalYield: rentalYieldScore,
      winProbability: winProbScore,
      equityBurden: equityBurdenScore,
    },
    metrics: {
      discountFraction,
      discountAbsolute,
      annualReturnPct,
      rentalYieldGross,
      winProbability,
      requiredEquity: inputs.equity,
      finalNetWorthA: result.summary.finalA,
      monthlyMortgagePayment: monthlyMortgage,
      monthlyCashFlowB,
    },
  };
}

export function scoreProject(
  project: Project,
  userOverrides: Partial<SimulationInputs> = {},
): ScoredProject {
  const apartments = project.apartments.map((apt) =>
    scoreApartment(project, apt, userOverrides),
  );
  // Project-level score = best apartment, since you register for the project
  // (or city) but get assigned a specific apartment by raffle.
  const best = apartments.reduce(
    (acc, cur) => (cur.score > acc.score ? cur : acc),
    apartments[0],
  );
  return {
    project,
    best,
    apartments,
    score: best?.score ?? 0,
  };
}

export function scoreAllProjects(
  projects: Project[],
  userOverrides: Partial<SimulationInputs> = {},
): ScoredProject[] {
  return projects
    .map((p) => scoreProject(p, userOverrides))
    .sort((a, b) => b.score - a.score);
}
