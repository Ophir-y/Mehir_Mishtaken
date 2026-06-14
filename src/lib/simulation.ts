// Pure simulation for the Mehir Matara comparison app.
// All currency values are in shekels (₪). Rates are annual unless noted.

export type ConstructionMode =
  | "interest_only"
  | "full_grace"
  | "interest_principal";

export interface SimulationInputs {
  // Apartment
  purchasePrice: number;
  marketPrice: number;
  appreciation: number; // annual, decimal (0.025 = 2.5%)
  holdingYears: number;

  // Construction
  constructionMonths: number; // 0 = immediate possession
  signingPct: number; // decimal (0.20 = 20%)
  constructionMode: ConstructionMode;

  // Mortgage (post-handover Shpitzer)
  equity: number;
  /**
   * UI mode: when true, the effective equity is computed in App.tsx as
   * `purchasePrice * equityPercent`. The `equity` field is then overwritten
   * before reaching the simulation, so this flag is UI-only.
   */
  equityAsPercent: boolean;
  equityPercent: number; // decimal, e.g. 0.25 = 25%
  mortgageAmount: number;
  termYears: number;
  mortgageRate: number; // annual decimal

  // One-time costs.
  // Three of these (madad, purchase tax, legal fees) are computed as a
  // percentage of the purchase price — that's how they work in reality.
  // The simulation computes the ₪ amount = purchasePrice * percent.
  madadPercent: number; // construction cost index over the build period
  /**
   * Purchase tax (mas rechisha) is computed from the legal brackets — not a
   * single percentage. This flag picks the bracket schedule: true → single
   * residence (דירה יחידה), false → additional residence / investor rates.
   */
  isSingleResidence: boolean;
  legalFeesPercent: number; // עו״ד
  upgrades: number; // absolute ₪
  furniture: number; // absolute ₪

  // Monthly ongoing (start at handover)
  insurance: number;
  hoa: number;

  // Rent
  currentRent: number;
  rentGrowth: number; // annual decimal
  rentalIncome: number; // base, before vacancy/escalation (₪ mode)
  /**
   * When true, rental income each month is computed as
   * `property_value * rentalIncomePercent / 12` (gross annual yield of the
   * current asset value). In this mode the absolute `rentalIncome` field is
   * ignored and `rentGrowth` is NOT applied to the rental income (since
   * appreciation already moves the property value).
   */
  rentalIncomeAsPercent: boolean;
  rentalIncomePercent: number; // annual decimal yield, e.g. 0.04 = 4%
  vacancyMonths: number; // per year

  // Tax — apartment capital gain (mas shevach)
  taxRate: number; // decimal
  exemption: boolean;

  // Tax — rental income (Israel: ~10% track flat OR exempt below ~5,500 ₪)
  rentalTaxEnabled: boolean;
  rentalTaxRate: number; // decimal, default 0.10
  rentalTaxExemption: number; // monthly ₪ exempt amount, default 5500

  // Tax — S&P capital gains (Israel: 25% on REAL gain — nominal gain
  // minus inflation indexation of the cost basis). When `inflation` is 0,
  // collapses to nominal taxation.
  sp500TaxEnabled: boolean;
  sp500TaxRate: number; // decimal, default 0.25

  // Inflation — annual decimal. Used to index S&P contributions to current
  // purchasing power before computing taxable gain (Israeli mas revach hon
  // real-terms rule).
  inflation: number;

  // S&P
  sp500Return: number; // annual decimal
}

export interface MonthlyRow {
  month: number; // 1-indexed since signing
  year: number; // ceil(month/12)
  phase: "construction" | "post";

  // Construction-specific
  contractorPayment: number;
  oneTimeCostsPaid: number; // tax/legal/upgrades/madad/furniture as they come due
  equityUsed: number;
  mortgageDrawn: number;
  drawnBalance: number; // end-of-month
  constructionInterestPaid: number;
  constructionPrincipalPaid: number;
  constructionPayment: number; // total paid to bank this month during construction

  // Post-handover-specific (zero during construction)
  mortgagePayment: number;
  interestPaid: number;
  principalPaid: number;
  remainingBalance: number;

  // Both phases
  rentPaid: number;
  rentalIncome: number; // gross
  rentalTax: number; // monthly tax on rental income (scenario B)
  netRentalIncome: number; // gross - tax
  insurancePaid: number;
  hoaPaid: number;
  propertyValue: number;
  contractorObligation: number; // unpaid contractor balance (0 post-handover)

  homeEquity: number;
  capitalGain: number;
  masShevach: number;

  // Cash flows we use for the portfolios
  housingCostA: number;
  housingCostB: number;
  housingCostC: number;
  portfolioBDeposit: number;
  portfolioCDeposit: number;
  portfolioB: number;
  portfolioC: number;

  // Cumulative invested capital (nominal) and CPI-indexed (real, in current
  // shekels). Provisioned S&P CGT uses the indexed series:
  //   tax = max(0, portfolio - indexed_contributions) * rate
  // The nominal contributions are exposed for transparency.
  contributionsB: number;
  contributionsC: number;
  contributionsBIndexed: number;
  contributionsCIndexed: number;
  sp500TaxB: number;
  sp500TaxC: number;

  netWorthA: number;
  netWorthB: number;
  netWorthC: number;
}

export interface YearlyRow {
  year: number;
  endMonth: number;
  phase: "construction" | "post" | "mixed";
  netWorthA: number;
  netWorthB: number;
  netWorthC: number;
  propertyValue: number;
  portfolioC: number;
  portfolioB: number;
  remainingBalance: number;
}

export interface Summary {
  finalA: number;
  finalB: number;
  finalC: number;
  winner: "A" | "B" | "C";
  gapBvsA: number;
  gapCvsA: number;
  totalMonths: number;
  handoverMonth: number;
  breakevenMonthCvsA: number | null;
}

export interface SimulationResult {
  monthly: MonthlyRow[];
  yearly: YearlyRow[];
  summary: Summary;
}

// ============================================================================
// Israeli purchase tax (mas rechisha) brackets — 2024-2025.
// These thresholds are CPI-indexed and updated annually by Rashut HaMisim
// (January each year). Update from
// https://www.gov.il/he/departments/general/property-tax-rates
// ============================================================================

/** Tax bracket — apply `rate` to the portion of the price up to `upTo`. */
interface TaxBracket {
  upTo: number;
  rate: number;
}

const PURCHASE_TAX_BRACKETS_SINGLE: TaxBracket[] = [
  { upTo: 1_978_745, rate: 0 },
  { upTo: 2_347_040, rate: 0.035 },
  { upTo: 6_055_070, rate: 0.05 },
  { upTo: 20_183_565, rate: 0.08 },
  { upTo: Infinity, rate: 0.10 },
];

const PURCHASE_TAX_BRACKETS_INVESTOR: TaxBracket[] = [
  { upTo: 6_055_070, rate: 0.08 },
  { upTo: Infinity, rate: 0.10 },
];

/**
 * Compute Israeli purchase tax (mas rechisha) using the legal bracket schedule.
 * Bracketed: each portion of the price is taxed at the bracket rate that
 * contains it (NOT a flat rate that escalates over the whole price).
 */
export function computePurchaseTax(
  price: number,
  isSingleResidence: boolean,
): number {
  const brackets = isSingleResidence
    ? PURCHASE_TAX_BRACKETS_SINGLE
    : PURCHASE_TAX_BRACKETS_INVESTOR;
  let tax = 0;
  let prevThreshold = 0;
  for (const b of brackets) {
    if (price <= prevThreshold) break;
    const portion = Math.min(price, b.upTo) - prevThreshold;
    tax += portion * b.rate;
    prevThreshold = b.upTo;
  }
  return tax;
}

/** Effective purchase tax rate (tax / price), useful for display. */
export function purchaseTaxEffectiveRate(
  price: number,
  isSingleResidence: boolean,
): number {
  if (price <= 0) return 0;
  return computePurchaseTax(price, isSingleResidence) / price;
}

// ============================================================================
// Mehir Matara resale lockup — earliest legal sale date.
//   "Cannot sell before 7 years from raffle OR 5 years from handover —
//    whichever is EARLIER."
//   Source: Mehir Matara program regulations.
// ============================================================================

export const LOCKUP_YEARS_FROM_RAFFLE = 7;
export const LOCKUP_YEARS_FROM_HANDOVER = 5;

/**
 * Minimum months the buyer must hold the apartment AFTER handover before they
 * can legally sell. Construction time is counted toward the 7-year-from-raffle
 * clock, so longer construction shortens the post-handover lockup (down to a
 * floor of zero if construction itself exceeds 7 years).
 */
export function legalHoldingMonthsAfterHandover(
  constructionMonths: number,
): number {
  const fromRaffleTotalMonths = LOCKUP_YEARS_FROM_RAFFLE * 12;
  const fromHandoverMonths = LOCKUP_YEARS_FROM_HANDOVER * 12;
  return Math.max(
    0,
    Math.min(fromRaffleTotalMonths - constructionMonths, fromHandoverMonths),
  );
}

/** Standard Shpitzer monthly payment. */
export function pmt(principal: number, monthlyRate: number, n: number): number {
  if (n <= 0) return 0;
  if (monthlyRate === 0) return principal / n;
  return (
    (principal * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -n))
  );
}

/** Annual rate → monthly rate. */
const monthly = (annual: number) => annual / 12;
/** Annual return → monthly compound return. */
const monthlyCompound = (annual: number) =>
  Math.pow(1 + annual, 1 / 12) - 1;

/** Rent / income escalator: anniversary years since signing. */
function escalatedRent(base: number, growth: number, month: number): number {
  // Year index since signing (1-based): month 1..12 → year 1, 13..24 → year 2, etc.
  // Apply growth in subsequent years: year_factor = (1+growth)^(year-1)
  const year = Math.ceil(month / 12);
  return base * Math.pow(1 + growth, Math.max(0, year - 1));
}

export function runSimulation(inputs: SimulationInputs): SimulationResult {
  const {
    purchasePrice,
    marketPrice,
    appreciation,
    holdingYears,
    constructionMonths,
    signingPct,
    constructionMode,
    equity,
    mortgageAmount,
    termYears,
    mortgageRate,
    madadPercent,
    isSingleResidence,
    legalFeesPercent,
    upgrades,
    furniture,
    insurance,
    hoa,
    currentRent,
    rentGrowth,
    rentalIncome,
    rentalIncomeAsPercent,
    rentalIncomePercent,
    vacancyMonths,
    taxRate,
    exemption,
    rentalTaxEnabled,
    rentalTaxRate,
    rentalTaxExemption,
    sp500TaxEnabled,
    sp500TaxRate,
    inflation,
    sp500Return,
  } = inputs;

  // Convert the percentage-based costs to absolute ₪ on the purchase price.
  // Purchase tax uses the legal bracket schedule (not a flat percentage).
  const madad = purchasePrice * madadPercent;
  const purchaseTax = computePurchaseTax(purchasePrice, isSingleResidence);
  const legalFees = purchasePrice * legalFeesPercent;
  const oneTimeCosts = madad + purchaseTax + legalFees + upgrades + furniture;
  const handoverMonth = constructionMonths;
  const postHandoverMonths = holdingYears * 12;
  const totalMonths = handoverMonth + postHandoverMonths;

  const rMort = monthly(mortgageRate);
  const rSp = monthlyCompound(sp500Return);
  const termMonths = termYears * 12;
  const shpitzerPMT = pmt(mortgageAmount, rMort, termMonths);

  // ===== Construction schedule of contractor payments =====
  // Month 1: signing payment (purchasePrice * signingPct).
  // Months 2..handover: equal slices of (purchasePrice - signing) / (handover - 1).
  // Edge case: constructionMonths === 0 → no construction phase.
  // Edge case: constructionMonths === 1 → signing month IS handover; entire price due at signing.
  const signingPayment = purchasePrice * signingPct;
  function contractorDue(month: number): number {
    if (constructionMonths <= 0) return 0;
    if (month === 1) {
      // If only one construction month, the entire purchase is due now.
      return constructionMonths === 1 ? purchasePrice : signingPayment;
    }
    if (month <= constructionMonths) {
      return (purchasePrice - signingPayment) / (constructionMonths - 1);
    }
    return 0;
  }

  /**
   * One-time costs paid this month, by timing:
   *  - Month 1: purchase tax + legal fees + upgrades (paid at signing)
   *  - Each construction month: madad spread uniformly (accrues on the
   *    unpaid contractor balance — uniform is a good approximation)
   *  - Handover month: furniture (you only buy furniture when you have keys)
   *  - If constructionMonths === 0: everything collapses into month 1.
   */
  function oneTimeCostsDue(month: number): number {
    if (constructionMonths <= 0) {
      return month === 1
        ? purchaseTax + legalFees + upgrades + madad + furniture
        : 0;
    }
    let amount = 0;
    if (month === 1) {
      amount += purchaseTax + legalFees + upgrades;
    }
    if (month >= 1 && month <= constructionMonths) {
      amount += madad / constructionMonths;
    }
    if (month === constructionMonths) {
      amount += furniture;
    }
    return amount;
  }

  let equityRemaining = equity;
  let drawnBalance = 0;
  let contractorObligation = purchasePrice;
  let portfolioB = 0;
  // C starts with `equity`. One-time costs are financed inside the mortgage
  // (App.tsx adds them to `mortgageAmount`), so A/B feel them as larger
  // monthly Shpitzer payments — that surplus then flows into C's portfolio
  // via the housing-cost differential.
  let portfolioC = equity;
  let remainingBalance = mortgageAmount;
  // Track total invested capital for S&P CGT — both nominal and CPI-indexed.
  let contributionsB = 0;
  let contributionsC = equity;
  let contributionsBIndexed = 0;
  let contributionsCIndexed = equity;
  const rInflation = monthlyCompound(inflation);

  /** Provisioned S&P CGT on REAL gain (no loss credit). */
  function sp500Tax(portfolio: number, indexedContributions: number): number {
    if (!sp500TaxEnabled) return 0;
    const realGain = portfolio - Math.max(0, indexedContributions);
    return Math.max(0, realGain) * sp500TaxRate;
  }

  // The implicit "budget" we use to make the three scenarios comparable is
  // scenario-A's housing cost. C invests the difference; B reinvests
  // (rental_income - rent_paid). Insurance + HOA cancel out between A and B,
  // and the mortgage payment is captured by home equity (property value minus
  // remaining balance), so portfolio B only sees rent flows.

  const monthlyRows: MonthlyRow[] = [];

  // ===== CONSTRUCTION PHASE =====
  for (let m = 1; m <= constructionMonths; m++) {
    const due = contractorDue(m);
    const costsDue = oneTimeCostsDue(m);
    const totalDue = due + costsDue;

    // Equity covers any outflow first (contractor + one-time costs).
    const equityUsed = Math.min(equityRemaining, totalDue);
    equityRemaining -= equityUsed;
    const mortgageDrawn = totalDue - equityUsed;
    // Cap drawdowns so we never exceed the contracted mortgage amount.
    const cappedDraw = Math.min(mortgageDrawn, mortgageAmount - drawnBalance);

    // Add drawdown first.
    drawnBalance += cappedDraw;
    contractorObligation -= due;
    if (contractorObligation < 0) contractorObligation = 0;

    // Apply construction-phase mortgage behaviour.
    let interestThisMonth = drawnBalance * rMort;
    let principalThisMonth = 0;
    let paymentThisMonth = 0;

    if (constructionMode === "interest_only") {
      // Pay interest, no principal. Drawn balance stays.
      paymentThisMonth = interestThisMonth;
    } else if (constructionMode === "full_grace") {
      // Capitalize interest into the drawn balance, no cash payment.
      drawnBalance += interestThisMonth;
      paymentThisMonth = 0;
      // Recompute reported "interest paid" as 0 (we capitalized it).
      interestThisMonth = 0;
    } else {
      // Partial Shpitzer on drawn balance, term = mortgage term (rough model).
      const partialPmt = pmt(drawnBalance, rMort, termMonths);
      paymentThisMonth = partialPmt;
      principalThisMonth = Math.max(0, partialPmt - interestThisMonth);
      drawnBalance = Math.max(0, drawnBalance - principalThisMonth);
    }

    const rentPaid = escalatedRent(currentRent, rentGrowth, m);

    // Property appreciation tracked monthly.
    const propertyValue =
      marketPrice * Math.pow(1 + appreciation, m / 12);
    const liabilities = drawnBalance + contractorObligation;
    const homeEquity = propertyValue - liabilities;

    // No mas shevach during construction (apartment not sold).
    const capitalGain = propertyValue - (purchasePrice + oneTimeCosts);

    // Housing costs (cash out-of-pocket each month).
    const housingCostA = rentPaid + paymentThisMonth;
    const housingCostB = housingCostA; // no rental income — no keys yet
    const housingCostC = rentPaid;

    // Portfolio C deposits the difference between scenario A and C, which
    // during construction equals the mortgage payment (interest etc.).
    const portfolioCDeposit = housingCostA - housingCostC; // = paymentThisMonth
    const portfolioBDeposit = -rentPaid; // 0 rental income during construction
    portfolioC = portfolioC * (1 + rSp) + portfolioCDeposit;
    portfolioB = portfolioB * (1 + rSp) + portfolioBDeposit;
    contributionsB += portfolioBDeposit;
    contributionsC += portfolioCDeposit;
    // CPI-index existing contributions, then add new deposit at face value.
    contributionsBIndexed = contributionsBIndexed * (1 + rInflation) + portfolioBDeposit;
    contributionsCIndexed = contributionsCIndexed * (1 + rInflation) + portfolioCDeposit;

    const sp500TaxBNow = sp500Tax(portfolioB, contributionsBIndexed);
    const sp500TaxCNow = sp500Tax(portfolioC, contributionsCIndexed);

    // Net worth (after provisioned S&P CGT).
    const netWorthA = homeEquity;
    const netWorthB = homeEquity + portfolioB - sp500TaxBNow;
    const netWorthC = portfolioC - sp500TaxCNow;

    monthlyRows.push({
      month: m,
      year: Math.ceil(m / 12),
      phase: "construction",
      contractorPayment: due,
      oneTimeCostsPaid: costsDue,
      equityUsed,
      mortgageDrawn: cappedDraw,
      drawnBalance,
      constructionInterestPaid: interestThisMonth,
      constructionPrincipalPaid: principalThisMonth,
      constructionPayment: paymentThisMonth,
      mortgagePayment: 0,
      interestPaid: 0,
      principalPaid: 0,
      remainingBalance: drawnBalance, // for reference during construction
      rentPaid,
      rentalIncome: 0,
      rentalTax: 0,
      netRentalIncome: 0,
      insurancePaid: 0,
      hoaPaid: 0,
      propertyValue,
      contractorObligation,
      homeEquity,
      capitalGain,
      masShevach: 0,
      housingCostA,
      housingCostB,
      housingCostC,
      portfolioBDeposit,
      portfolioCDeposit,
      portfolioB,
      portfolioC,
      contributionsB,
      contributionsC,
      contributionsBIndexed,
      contributionsCIndexed,
      sp500TaxB: sp500TaxBNow,
      sp500TaxC: sp500TaxCNow,
      netWorthA,
      netWorthB,
      netWorthC,
    });
  }

  // ===== HANDOVER TOP-UP =====
  // The drawn balance must equal the contracted mortgage amount before the
  // post-handover Shpitzer starts. Two ways this can land short:
  //   1) `constructionMonths === 0` — the construction loop never ran, so
  //      drawnBalance is still 0. Top up the whole mortgage at handover.
  //   2) `constructionMonths > 0` but equity exceeded the signing payment,
  //      so the bank lent less during construction than the final balance.
  //      The borrower draws the remainder as cash at handover.
  if (drawnBalance < mortgageAmount) {
    drawnBalance = mortgageAmount;
  }
  remainingBalance = drawnBalance; // standard Shpitzer starts from here

  // ===== POST-HANDOVER PHASE =====
  for (let k = 1; k <= postHandoverMonths; k++) {
    const m = handoverMonth + k;
    const interestThisMonth = remainingBalance * rMort;
    const principalThisMonth = Math.min(
      remainingBalance,
      shpitzerPMT - interestThisMonth,
    );
    remainingBalance = Math.max(0, remainingBalance - principalThisMonth);
    const mortgagePayment = interestThisMonth + principalThisMonth;

    const rentPaid = escalatedRent(currentRent, rentGrowth, m);
    const propertyValue =
      marketPrice * Math.pow(1 + appreciation, m / 12);

    // Rental income — two modes:
    //  - absolute ₪: base * (1 - vacancy/12), escalated by rentGrowth annually.
    //  - % of property value: propertyValue * pct / 12 * (1 - vacancy/12).
    //    No rentGrowth applied — appreciation already moves propertyValue.
    let rentalIncomeThisMonth: number;
    if (rentalIncomeAsPercent) {
      const monthlyGross = (propertyValue * rentalIncomePercent) / 12;
      rentalIncomeThisMonth = monthlyGross * (1 - vacancyMonths / 12);
    } else {
      const grossRental = rentalIncome * (1 - vacancyMonths / 12);
      rentalIncomeThisMonth = escalatedRent(grossRental, rentGrowth, m);
    }

    // Rental income tax (Israel): simplified model = (gross - monthly exempt) * rate.
    // Reflects the "above ~5,500 ₪ is taxable" rule; the actual exemption-track
    // formula is more complex (see ExplanationsPanel).
    const rentalTaxThisMonth = rentalTaxEnabled
      ? Math.max(0, rentalIncomeThisMonth - rentalTaxExemption) * rentalTaxRate
      : 0;
    const netRentalIncome = rentalIncomeThisMonth - rentalTaxThisMonth;

    const homeEquity = propertyValue - remainingBalance;
    const capitalGain = propertyValue - (purchasePrice + oneTimeCosts);
    const masShevach = exemption
      ? 0
      : Math.max(0, capitalGain) * taxRate;

    const housingCostA = mortgagePayment + insurance + hoa;
    const housingCostB = mortgagePayment + insurance + hoa - netRentalIncome;
    const housingCostC = rentPaid;

    // Portfolio C: invest the difference between A's housing cost and C's
    // housing cost. Result reflects the "what if you had not bought" world.
    const portfolioCDeposit = housingCostA - housingCostC;
    portfolioC = portfolioC * (1 + rSp) + portfolioCDeposit;
    contributionsC += portfolioCDeposit;

    // Portfolio B: only rent flows (mortgage and opex already captured by
    // home equity and cancel against A's budget). Uses NET rental income
    // (after rental-income tax).
    const portfolioBDeposit = netRentalIncome - rentPaid;
    portfolioB = portfolioB * (1 + rSp) + portfolioBDeposit;
    contributionsB += portfolioBDeposit;

    // CPI-index existing contributions, then add this month's deposit at face value.
    contributionsBIndexed = contributionsBIndexed * (1 + rInflation) + portfolioBDeposit;
    contributionsCIndexed = contributionsCIndexed * (1 + rInflation) + portfolioCDeposit;

    const sp500TaxBNow = sp500Tax(portfolioB, contributionsBIndexed);
    const sp500TaxCNow = sp500Tax(portfolioC, contributionsCIndexed);

    const netWorthA = homeEquity - masShevach;
    const netWorthB = homeEquity - masShevach + portfolioB - sp500TaxBNow;
    const netWorthC = portfolioC - sp500TaxCNow;

    monthlyRows.push({
      month: m,
      year: Math.ceil(m / 12),
      phase: "post",
      contractorPayment: 0,
      // No-construction case: month 1 of post-handover is when all costs land.
      oneTimeCostsPaid:
        constructionMonths === 0 && k === 1 ? oneTimeCostsDue(1) : 0,
      equityUsed: 0,
      mortgageDrawn: 0,
      drawnBalance: remainingBalance,
      constructionInterestPaid: 0,
      constructionPrincipalPaid: 0,
      constructionPayment: 0,
      mortgagePayment,
      interestPaid: interestThisMonth,
      principalPaid: principalThisMonth,
      remainingBalance,
      rentPaid,
      rentalIncome: rentalIncomeThisMonth,
      rentalTax: rentalTaxThisMonth,
      netRentalIncome,
      insurancePaid: insurance,
      hoaPaid: hoa,
      propertyValue,
      contractorObligation: 0,
      homeEquity,
      capitalGain,
      masShevach,
      housingCostA,
      housingCostB,
      housingCostC,
      portfolioBDeposit,
      portfolioCDeposit,
      portfolioB,
      portfolioC,
      contributionsB,
      contributionsC,
      contributionsBIndexed,
      contributionsCIndexed,
      sp500TaxB: sp500TaxBNow,
      sp500TaxC: sp500TaxCNow,
      netWorthA,
      netWorthB,
      netWorthC,
    });
  }

  // ===== YEARLY ROLLUP =====
  const yearly: YearlyRow[] = [];
  const maxYear = monthlyRows.length
    ? monthlyRows[monthlyRows.length - 1].year
    : 0;
  for (let y = 1; y <= maxYear; y++) {
    const rowsInYear = monthlyRows.filter((r) => r.year === y);
    if (!rowsInYear.length) continue;
    const last = rowsInYear[rowsInYear.length - 1];
    const phases = new Set(rowsInYear.map((r) => r.phase));
    const phase: YearlyRow["phase"] =
      phases.size === 1
        ? (rowsInYear[0].phase as "construction" | "post")
        : "mixed";
    yearly.push({
      year: y,
      endMonth: last.month,
      phase,
      netWorthA: last.netWorthA,
      netWorthB: last.netWorthB,
      netWorthC: last.netWorthC,
      propertyValue: last.propertyValue,
      portfolioC: last.portfolioC,
      portfolioB: last.portfolioB,
      remainingBalance: last.remainingBalance,
    });
  }

  // ===== SUMMARY =====
  const last = monthlyRows[monthlyRows.length - 1];
  const finalA = last?.netWorthA ?? 0;
  const finalB = last?.netWorthB ?? 0;
  const finalC = last?.netWorthC ?? 0;
  let winner: "A" | "B" | "C" = "A";
  if (finalB > finalA && finalB >= finalC) winner = "B";
  else if (finalC > finalA && finalC > finalB) winner = "C";

  // Breakeven: first month where C ≥ A.
  let breakevenMonthCvsA: number | null = null;
  for (const row of monthlyRows) {
    if (row.netWorthC >= row.netWorthA) {
      breakevenMonthCvsA = row.month;
      break;
    }
  }

  return {
    monthly: monthlyRows,
    yearly,
    summary: {
      finalA,
      finalB,
      finalC,
      winner,
      gapBvsA: finalB - finalA,
      gapCvsA: finalC - finalA,
      totalMonths,
      handoverMonth,
      breakevenMonthCvsA,
    },
  };
}

/** Default inputs matching the spec. */
export const defaultInputs: SimulationInputs = {
  purchasePrice: 2_300_000,
  marketPrice: 3_100_000,
  appreciation: 0.025,
  holdingYears: 5,

  constructionMonths: 24,
  signingPct: 0.20,
  constructionMode: "interest_only",

  equity: 600_000, // overridden when equityAsPercent is true
  equityAsPercent: true, // default mode: choose equity as % of price
  equityPercent: 0.25, // 25% of purchase price
  mortgageAmount: 1_700_000, // derived: purchasePrice - equity
  termYears: 30,
  mortgageRate: 0.047,

  // Madad tashumot habniya: ~3-4%/year on the unpaid contractor balance.
  // Over a typical 24-month build with ~80% paid linearly after signing,
  // cumulative impact is ~3-5% of purchase price. Default 4%.
  madadPercent: 0.04,
  // Purchase tax (mas rechisha) — computed from legal brackets. Default to
  // single-residence treatment (the Mehir Matara case for most buyers).
  isSingleResidence: true,
  // Legal fees: lawyers typically charge ~0.5-1.5% of the deal value.
  // Default 1%.
  legalFeesPercent: 0.01,
  upgrades: 70_000,
  furniture: 40_000,

  insurance: 250,
  hoa: 200,

  currentRent: 5_500,
  rentGrowth: 0.02,
  rentalIncome: 0, // computed on first render as 80% of PMT
  rentalIncomeAsPercent: true,
  rentalIncomePercent: 0.03, // 3% gross annual yield on property value
  vacancyMonths: 0.5,

  taxRate: 0.25,
  exemption: true,

  rentalTaxEnabled: true,
  rentalTaxRate: 0.10,
  rentalTaxExemption: 5_500,

  sp500TaxEnabled: true,
  sp500TaxRate: 0.25,

  // Israeli CPI long-run context: last 25 years ~2-3%; last 10 years ~1.5%.
  // Default 3% — matches modern era and BoI target ceiling. Slider goes high
  // enough to model the 50-year historical figure (~7-10%) if desired.
  inflation: 0.03,

  sp500Return: 0.10,
};

/** Convenience: default rental income = 80% of the post-handover PMT. */
export function defaultRentalIncome(inputs: SimulationInputs): number {
  const r = inputs.mortgageRate / 12;
  const n = inputs.termYears * 12;
  return Math.round(pmt(inputs.mortgageAmount, r, n) * 0.8);
}

/** Sum of all one-time costs in ₪. Purchase tax uses bracket schedule. */
export function computeOneTimeCosts(inputs: SimulationInputs): number {
  const madad = inputs.purchasePrice * inputs.madadPercent;
  const purchaseTax = computePurchaseTax(
    inputs.purchasePrice,
    inputs.isSingleResidence,
  );
  const legalFees = inputs.purchasePrice * inputs.legalFeesPercent;
  return madad + purchaseTax + legalFees + inputs.upgrades + inputs.furniture;
}

/**
 * Apply the shared derivations the UI does before running the simulation:
 *   - equity from percent (when in % mode)
 *   - mortgageAmount = (price - equity) + one-time costs
 *   - holdingYears from the Mehir Matara lockup rule
 * Both the sandbox page and the per-project analyzer call this so any rule
 * change flows through both.
 */
export function deriveInputs(inputs: SimulationInputs): SimulationInputs {
  const out = { ...inputs };
  if (out.equityAsPercent) {
    out.equity = out.purchasePrice * out.equityPercent;
  } else {
    out.equity = Math.min(out.equity, out.purchasePrice);
  }
  const oneTimeCosts = computeOneTimeCosts(out);
  out.mortgageAmount =
    Math.max(0, out.purchasePrice - out.equity) + oneTimeCosts;
  out.holdingYears =
    legalHoldingMonthsAfterHandover(out.constructionMonths) / 12;
  return out;
}
