import {
  defaultInputs,
  defaultRentalIncome,
  deriveInputs,
  pmt,
  runSimulation,
  type SimulationInputs,
  type SimulationResult,
} from "@/lib/simulation";
import type { Project, ProjectApartment } from "@/lib/types";

/**
 * Build the SimulationInputs for one apartment in one project. Pre-fills
 * apartment-specific fields from the project, then layers user overrides
 * (typically equity %, mortgage rate, S&P assumptions) on top, and finally
 * runs the shared derivation (equity, mortgage = price - equity + costs,
 * holding from the legal lockup).
 */
export function buildInputsForApartment(
  project: Project,
  apt: ProjectApartment,
  userOverrides: Partial<SimulationInputs> = {},
): SimulationInputs {
  // Start from the sandbox defaults so any field the user doesn't override
  // still has a sane value.
  const base: SimulationInputs = { ...defaultInputs };

  base.purchasePrice = apt.lotteryPrice;
  base.marketPrice = apt.marketPrice;
  // `rentalIncome` = what B collects from the tenant of the bought apartment.
  // `currentRent` = what B (and C) pay at their OWN residence — distinct from
  // the bought apartment's yield. The caller is expected to override
  // `currentRent` from user prefs; the sandbox default below is only a fallback.
  base.rentalIncome = apt.estimatedRent;
  // Switch off the "rent as % of property value" mode so the apartment-
  // specific rent is used verbatim. Same for equity (we still want % mode for
  // the sandbox-style UI, but at the simulation level the derivation handles
  // both).
  base.rentalIncomeAsPercent = false;
  base.constructionMonths = project.estimatedHandoverMonths;

  // Refresh the default rental-income fallback against the new price.
  // Not strictly necessary since we just set rentalIncome from the project,
  // but keeps the structure consistent if a caller flips back to the default.
  base.rentalIncome = base.rentalIncome || defaultRentalIncome(base);

  // Apply user overrides BEFORE derivation so e.g. an overridden equity %
  // flows into the derived mortgage amount.
  const merged: SimulationInputs = { ...base, ...userOverrides };
  return deriveInputs(merged);
}

/** Convenience: build inputs and run the simulation in one call. */
export function analyzeApartment(
  project: Project,
  apt: ProjectApartment,
  userOverrides: Partial<SimulationInputs> = {},
): { inputs: SimulationInputs; result: SimulationResult } {
  const inputs = buildInputsForApartment(project, apt, userOverrides);
  const result = runSimulation(inputs);
  return { inputs, result };
}

/**
 * Quick metrics that don't require running the full simulation — used in the
 * table view where we want sub-millisecond render per row.
 */
export function fastMetrics(
  apt: ProjectApartment,
  inputs: SimulationInputs,
): { monthlyMortgage: number; rentalYieldGross: number } {
  const r = inputs.mortgageRate / 12;
  const n = inputs.termYears * 12;
  const monthlyMortgage = pmt(inputs.mortgageAmount, r, n);
  const rentalYieldGross =
    apt.marketPrice > 0
      ? (apt.estimatedRent * 12) / apt.marketPrice
      : 0;
  return { monthlyMortgage, rentalYieldGross };
}
