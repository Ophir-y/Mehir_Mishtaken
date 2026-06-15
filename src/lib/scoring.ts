import { type SimulationInputs } from "@/lib/simulation";
import { analyzeApartment, fastMetrics } from "@/lib/projectAnalysis";
import type {
  Project,
  ProjectApartment,
  ProjectPricePerSqm,
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

export interface ScoringOptions {
  /**
   * What-if discount fraction applied to the gov-set list price per m²
   * (0..1). When provided, the apartment's lottery price is rescaled
   * before scoring & simulation, so the user can stress-test different
   * discount levels. Falls through to the per-lottery discount parsed
   * from Notes when omitted.
   */
  discountOverride?: number;
}

/**
 * Apply a what-if discount override to an apartment by rescaling its
 * lottery price. The original `apt.lotteryPrice` already reflects the
 * per-lottery discount parsed from the API; we back that out by the
 * ratio (1 − override) / (1 − parsedDiscount). Market price is unchanged
 * — it's the open-market reference, independent of the program discount.
 */
function applyDiscountOverride(
  project: Project,
  apt: ProjectApartment,
  override: number | undefined,
): ProjectApartment {
  if (override === undefined || !project.pricePerSqm) return apt;
  const parsed = project.pricePerSqm.discountPercent;
  if (parsed >= 1 || override >= 1) return apt;
  const ratio = (1 - override) / (1 - parsed);
  if (!Number.isFinite(ratio) || ratio === 1) return apt;
  return { ...apt, lotteryPrice: Math.round(apt.lotteryPrice * ratio) };
}

export function scoreApartment(
  project: Project,
  apt: ProjectApartment,
  userOverrides: Partial<SimulationInputs> = {},
  scoringOptions: ScoringOptions = {},
): ScoredApartment {
  const effectiveApt = applyDiscountOverride(
    project,
    apt,
    scoringOptions.discountOverride,
  );

  // Run the full simulation once — the source of truth for the real-return
  // metric. Other metrics are derived without re-running it.
  const { inputs, result } = analyzeApartment(project, effectiveApt, userOverrides);
  const { monthlyMortgage, rentalYieldGross } = fastMetrics(effectiveApt, inputs);

  const discountAbsolute = Math.max(0, effectiveApt.marketPrice - effectiveApt.lotteryPrice);
  const discountFraction =
    effectiveApt.marketPrice > 0 ? discountAbsolute / effectiveApt.marketPrice : 0;

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
    apt: effectiveApt,
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

/**
 * Recompute the per-m² info using the user's discount override. When no
 * override (or no parser pricePerSqm), returns the original. Market price
 * is independent of the program discount — only the lottery side changes.
 */
function effectivePricePerSqmFor(
  project: Project,
  override: number | undefined,
): ProjectPricePerSqm | undefined {
  const base = project.pricePerSqm;
  if (!base || override === undefined || override >= 1 || override < 0) {
    return base;
  }
  const list = base.listPricePerSqm;
  const market = base.marketPricePerSqm;
  const newLottery = Math.round(list * (1 - override));
  return {
    ...base,
    discountPercent: override,
    lotteryPricePerSqm: newLottery,
    savingsPercent: market > 0 ? (market - newLottery) / market : 0,
  };
}

export function scoreProject(
  project: Project,
  userOverrides: Partial<SimulationInputs> = {},
  scoringOptions: ScoringOptions = {},
): ScoredProject {
  const apartments = project.apartments.map((apt) =>
    scoreApartment(project, apt, userOverrides, scoringOptions),
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
    effectivePricePerSqm: effectivePricePerSqmFor(
      project,
      scoringOptions.discountOverride,
    ),
  };
}

export function scoreAllProjects(
  projects: Project[],
  userOverrides: Partial<SimulationInputs> = {},
  scoringOptions: ScoringOptions = {},
): ScoredProject[] {
  return projects
    .map((p) => scoreProject(p, userOverrides, scoringOptions))
    .sort((a, b) => b.score - a.score);
}
