// Pure simulation for the Mehir Matara comparison app.
// All currency values are in shekels (₪). Rates are annual unless noted.
//
// Architecture:
//   1. Pure helper functions (no side effects, no state) for each calculation.
//   2. A single `runSimulation` that composes them month-by-month.
//   3. Each monthly step is its own function for clarity.

// ============================================================================
// Types
// ============================================================================

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
  equityAsPercent: boolean;
  equityPercent: number; // decimal, e.g. 0.25 = 25%
  mortgageAmount: number;
  termYears: number;
  mortgageRate: number; // annual decimal

  // One-time costs
  madadPercent: number;
  isSingleResidence: boolean;
  legalFeesPercent: number;
  upgrades: number; // absolute ₪
  furniture: number; // absolute ₪

  // Monthly ongoing (start at handover)
  insurance: number;
  hoa: number;

  // Rent
  currentRent: number;
  rentGrowth: number; // annual decimal
  rentalIncome: number; // base ₪ (absolute mode)
  rentalIncomeAsPercent: boolean;
  rentalIncomePercent: number; // annual decimal yield
  vacancyMonths: number; // per year

  // Tax — apartment capital gain (mas shevach)
  taxRate: number;
  exemption: boolean;

  // Tax — rental income
  rentalTaxEnabled: boolean;
  rentalTaxRate: number;
  rentalTaxExemption: number; // monthly ₪ exempt amount

  // Tax — S&P capital gains (real gain, inflation-indexed)
  sp500TaxEnabled: boolean;
  sp500TaxRate: number;

  // Inflation
  inflation: number;

  // S&P
  sp500Return: number; // annual decimal
}

export interface MonthlyRow {
  month: number;
  year: number;
  phase: "construction" | "post";

  // Construction-specific
  contractorPayment: number;
  oneTimeCostsPaid: number;
  equityUsed: number;
  mortgageDrawn: number;
  drawnBalance: number;
  constructionInterestPaid: number;
  constructionPrincipalPaid: number;
  constructionPayment: number;

  // Post-handover-specific
  mortgagePayment: number;
  interestPaid: number;
  principalPaid: number;
  remainingBalance: number;

  // Both phases
  rentPaid: number;
  rentalIncome: number;
  rentalTax: number;
  netRentalIncome: number;
  insurancePaid: number;
  hoaPaid: number;
  propertyValue: number;
  contractorObligation: number;

  homeEquity: number;
  capitalGain: number;
  masShevach: number;

  housingCostA: number;
  housingCostB: number;
  housingCostC: number;
  portfolioBDeposit: number;
  portfolioCDeposit: number;
  portfolioB: number;
  portfolioC: number;

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
// Rate conversion helpers
// ============================================================================

/** Annual nominal rate → monthly rate. */
export const toMonthly = (annual: number) => annual / 12;

/** Annual return → monthly compound rate (geometric). */
export const toMonthlyCompound = (annual: number) =>
  Math.pow(1 + annual, 1 / 12) - 1;

// ============================================================================
// Escalation (rent / income growth by anniversary year)
// ============================================================================

/** Escalate a base amount by annual growth, applied on anniversary years. */
export function escalateByYear(
  base: number,
  annualGrowth: number,
  month: number,
): number {
  const year = Math.ceil(month / 12);
  return base * Math.pow(1 + annualGrowth, Math.max(0, year - 1));
}

// ============================================================================
// Israeli purchase tax (mas rechisha) — bracket schedule 2024-2025
// ============================================================================

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

export function purchaseTaxEffectiveRate(
  price: number,
  isSingleResidence: boolean,
): number {
  if (price <= 0) return 0;
  return computePurchaseTax(price, isSingleResidence) / price;
}

// ============================================================================
// Mehir Matara resale lockup
// ============================================================================

export const LOCKUP_YEARS_FROM_RAFFLE = 7;
export const LOCKUP_YEARS_FROM_HANDOVER = 5;

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

// ============================================================================
// Mortgage helpers
// ============================================================================

/** Standard Shpitzer (constant-payment amortization) monthly payment. */
export function pmt(principal: number, monthlyRate: number, n: number): number {
  if (n <= 0) return 0;
  if (monthlyRate === 0) return principal / n;
  return (
    (principal * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -n))
  );
}

/** One month of amortization: returns { interest, principal, newBalance }. */
export function amortizeOneMonth(
  balance: number,
  monthlyRate: number,
  pmtAmount: number,
): { interest: number; principal: number; newBalance: number } {
  const interest = balance * monthlyRate;
  const principal = Math.max(0, Math.min(balance, pmtAmount - interest));
  const newBalance = Math.max(0, balance - principal);
  return { interest, principal, newBalance };
}

// ============================================================================
// One-time cost calculations
// ============================================================================

/** Compute all one-time costs as a total ₪ amount. */
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
 * One-time costs due in a given construction month.
 *
 * Timing:
 *  - Month 1: purchase tax + legal fees + upgrades
 *  - Each construction month: madad spread uniformly
 *  - Handover month (last construction month): furniture
 *  - constructionMonths === 0: everything collapses to month 1
 */
export function oneTimeCostsDue(
  month: number,
  constructionMonths: number,
  purchaseTax: number,
  legalFees: number,
  upgrades: number,
  madad: number,
  furniture: number,
): number {
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

// ============================================================================
// Contractor payment schedule
// ============================================================================

/**
 * Contractor payment due in a given construction month.
 *
 * Schedule:
 *  - Month 1: signing payment = purchasePrice * signingPct
 *  - Months 2..handover: equal slices of (price - signing) / (handover - 1)
 *  - constructionMonths === 1: entire price at signing
 *  - constructionMonths === 0: nothing
 */
export function contractorDue(
  month: number,
  constructionMonths: number,
  purchasePrice: number,
  signingPct: number,
): number {
  if (constructionMonths <= 0) return 0;
  const signingPayment = purchasePrice * signingPct;
  if (month === 1) {
    return constructionMonths === 1 ? purchasePrice : signingPayment;
  }
  if (month <= constructionMonths) {
    return (purchasePrice - signingPayment) / (constructionMonths - 1);
  }
  return 0;
}

// ============================================================================
// Rental income calculation
// ============================================================================

/** Compute gross rental income for a given month. */
export function computeRentalIncome(
  month: number,
  propertyValue: number,
  rentalIncomeAbsolute: number,
  rentalIncomeAsPercent: boolean,
  rentalIncomePercent: number,
  rentGrowth: number,
  vacancyMonths: number,
): number {
  if (rentalIncomeAsPercent) {
    const monthlyGross = (propertyValue * rentalIncomePercent) / 12;
    return monthlyGross * (1 - vacancyMonths / 12);
  }
  const grossRental = rentalIncomeAbsolute * (1 - vacancyMonths / 12);
  return escalateByYear(grossRental, rentGrowth, month);
}

// ============================================================================
// Rental income tax (simplified Israeli model)
// ============================================================================

export function computeRentalTax(
  grossIncome: number,
  enabled: boolean,
  rate: number,
  exemptionAmount: number,
): number {
  if (!enabled) return 0;
  return Math.max(0, grossIncome - exemptionAmount) * rate;
}

// ============================================================================
// Capital gains tax — mas shevach (apartment)
// ============================================================================

export function computeMasShevach(
  capitalGain: number,
  exemption: boolean,
  taxRate: number,
): number {
  if (exemption) return 0;
  return Math.max(0, capitalGain) * taxRate;
}

// ============================================================================
// S&P 500 capital gains tax (Israeli real-gain rule)
// ============================================================================

export function computeSP500Tax(
  portfolio: number,
  indexedContributions: number,
  enabled: boolean,
  rate: number,
): number {
  if (!enabled) return 0;
  const realGain = portfolio - Math.max(0, indexedContributions);
  return Math.max(0, realGain) * rate;
}

// ============================================================================
// Portfolio monthly growth
// ============================================================================

export function growPortfolio(
  portfolio: number,
  monthlyRate: number,
  deposit: number,
): number {
  return portfolio * (1 + monthlyRate) + deposit;
}

/** CPI-index existing contributions, then add new deposit at face value. */
export function indexContributions(
  indexed: number,
  rInflation: number,
  newDeposit: number,
): number {
  return indexed * (1 + rInflation) + newDeposit;
}

// ============================================================================
// Property value
// ============================================================================

export function computePropertyValue(
  marketPrice: number,
  appreciation: number,
  month: number,
): number {
  return marketPrice * Math.pow(1 + appreciation, month / 12);
}

// ============================================================================
// Construction-phase monthly step
// ============================================================================

interface ConstructionStepInput {
  month: number;
  constructionMonths: number;
  purchasePrice: number;
  signingPct: number;
  constructionMode: ConstructionMode;

  rMort: number;
  termMonths: number;
  mortgageAmount: number;
  equityRemaining: number;
  drawnBalance: number;
  contractorObligation: number;

  purchaseTax: number;
  legalFees: number;
  upgrades: number;
  madad: number;
  furniture: number;

  marketPrice: number;
  appreciation: number;
  oneTimeCosts: number;

  currentRent: number;
  rentGrowth: number;

  rSp: number;
  rInflation: number;

  portfolioB: number;
  portfolioC: number;
  contributionsB: number;
  contributionsC: number;
  contributionsBIndexed: number;
  contributionsCIndexed: number;

  sp500TaxEnabled: boolean;
  sp500TaxRate: number;
}

interface ConstructionStepOutput {
  row: MonthlyRow;
  equityRemaining: number;
  drawnBalance: number;
  contractorObligation: number;
  portfolioB: number;
  portfolioC: number;
  contributionsB: number;
  contributionsC: number;
  contributionsBIndexed: number;
  contributionsCIndexed: number;
}

function constructionStep(
  inp: ConstructionStepInput,
): ConstructionStepOutput {
  const {
    month, constructionMonths, purchasePrice, signingPct, constructionMode,
    rMort, termMonths, mortgageAmount, equityRemaining, drawnBalance,
    contractorObligation, purchaseTax, legalFees, upgrades, madad, furniture,
    marketPrice, appreciation, oneTimeCosts, currentRent, rentGrowth,
    rSp, rInflation,
    portfolioB, portfolioC, contributionsB, contributionsC,
    contributionsBIndexed, contributionsCIndexed,
    sp500TaxEnabled, sp500TaxRate,
  } = inp;

  const due = contractorDue(month, constructionMonths, purchasePrice, signingPct);
  const costsDue = oneTimeCostsDue(
    month, constructionMonths, purchaseTax, legalFees, upgrades, madad, furniture,
  );
  const totalDue = due + costsDue;

  // Equity covers outflow first, then mortgage drawdown.
  const equityUsed = Math.min(equityRemaining, totalDue);
  const remainingEquity = equityRemaining - equityUsed;
  const mortgageDrawn = totalDue - equityUsed;
  const cappedDraw = Math.min(mortgageDrawn, mortgageAmount - drawnBalance);
  const newDrawnBalance = drawnBalance + cappedDraw;
  const newContractorObligation = Math.max(0, contractorObligation - due);

  // Construction-phase mortgage behaviour.
  let interestThisMonth = newDrawnBalance * rMort;
  let principalThisMonth = 0;
  let paymentThisMonth = 0;
  let finalDrawnBalance = newDrawnBalance;

  if (constructionMode === "interest_only") {
    paymentThisMonth = interestThisMonth;
  } else if (constructionMode === "full_grace") {
    finalDrawnBalance = newDrawnBalance + interestThisMonth;
    paymentThisMonth = 0;
    interestThisMonth = 0;
  } else {
    const partialPmt = pmt(newDrawnBalance, rMort, termMonths);
    paymentThisMonth = partialPmt;
    principalThisMonth = Math.max(0, partialPmt - interestThisMonth);
    finalDrawnBalance = Math.max(0, newDrawnBalance - principalThisMonth);
  }

  const rentPaid = escalateByYear(currentRent, rentGrowth, month);
  const propertyValue = computePropertyValue(marketPrice, appreciation, month);
  const liabilities = finalDrawnBalance + newContractorObligation;
  const homeEquity = propertyValue - liabilities;
  const capitalGain = propertyValue - (purchasePrice + oneTimeCosts);

  const housingCostA = rentPaid + paymentThisMonth;
  const housingCostB = housingCostA;
  const housingCostC = rentPaid;

  // During construction B is identical to A: both bought, neither has the
  // apartment yet, neither earns rental income, both pay rent on their own
  // place. So B's investable differential is 0 — the previous `-rentPaid`
  // formula drove B's portfolio massively negative through the build period.
  //
  // C invests the housing-cost differential. paymentThisMonth ≥ 0 by
  // construction, so the floor at 0 below is just a guard.
  const portfolioCDeposit = Math.max(0, housingCostA - housingCostC);
  const portfolioBDeposit = 0;
  const newPortfolioC = growPortfolio(portfolioC, rSp, portfolioCDeposit);
  const newPortfolioB = growPortfolio(portfolioB, rSp, portfolioBDeposit);
  const newContributionsB = contributionsB + portfolioBDeposit;
  const newContributionsC = contributionsC + portfolioCDeposit;
  const newContributionsBIndexed = indexContributions(
    contributionsBIndexed, rInflation, portfolioBDeposit,
  );
  const newContributionsCIndexed = indexContributions(
    contributionsCIndexed, rInflation, portfolioCDeposit,
  );

  const sp500TaxBNow = computeSP500Tax(
    newPortfolioB, newContributionsBIndexed, sp500TaxEnabled, sp500TaxRate,
  );
  const sp500TaxCNow = computeSP500Tax(
    newPortfolioC, newContributionsCIndexed, sp500TaxEnabled, sp500TaxRate,
  );

  const netWorthA = homeEquity;
  const netWorthB = homeEquity + newPortfolioB - sp500TaxBNow;
  const netWorthC = newPortfolioC - sp500TaxCNow;

  return {
    row: {
      month,
      year: Math.ceil(month / 12),
      phase: "construction",
      contractorPayment: due,
      oneTimeCostsPaid: costsDue,
      equityUsed,
      mortgageDrawn: cappedDraw,
      drawnBalance: finalDrawnBalance,
      constructionInterestPaid: interestThisMonth,
      constructionPrincipalPaid: principalThisMonth,
      constructionPayment: paymentThisMonth,
      mortgagePayment: 0,
      interestPaid: 0,
      principalPaid: 0,
      remainingBalance: finalDrawnBalance,
      rentPaid,
      rentalIncome: 0,
      rentalTax: 0,
      netRentalIncome: 0,
      insurancePaid: 0,
      hoaPaid: 0,
      propertyValue,
      contractorObligation: newContractorObligation,
      homeEquity,
      capitalGain,
      masShevach: 0,
      housingCostA,
      housingCostB,
      housingCostC,
      portfolioBDeposit,
      portfolioCDeposit,
      portfolioB: newPortfolioB,
      portfolioC: newPortfolioC,
      contributionsB: newContributionsB,
      contributionsC: newContributionsC,
      contributionsBIndexed: newContributionsBIndexed,
      contributionsCIndexed: newContributionsCIndexed,
      sp500TaxB: sp500TaxBNow,
      sp500TaxC: sp500TaxCNow,
      netWorthA,
      netWorthB,
      netWorthC,
    },
    equityRemaining: remainingEquity,
    drawnBalance: finalDrawnBalance,
    contractorObligation: newContractorObligation,
    portfolioB: newPortfolioB,
    portfolioC: newPortfolioC,
    contributionsB: newContributionsB,
    contributionsC: newContributionsC,
    contributionsBIndexed: newContributionsBIndexed,
    contributionsCIndexed: newContributionsCIndexed,
  };
}

// ============================================================================
// Post-handover monthly step
// ============================================================================

interface PostHandoverStepInput {
  month: number;
  handoverMonth: number;
  constructionMonths: number;

  remainingBalance: number;
  shpitzerPMT: number;
  rMort: number;

  marketPrice: number;
  appreciation: number;
  purchasePrice: number;
  oneTimeCosts: number;

  currentRent: number;
  rentGrowth: number;
  rentalIncome: number;
  rentalIncomeAsPercent: boolean;
  rentalIncomePercent: number;
  vacancyMonths: number;

  rentalTaxEnabled: boolean;
  rentalTaxRate: number;
  rentalTaxExemption: number;

  taxRate: number;
  exemption: boolean;
  insurance: number;
  hoa: number;

  rSp: number;
  rInflation: number;

  portfolioB: number;
  portfolioC: number;
  contributionsB: number;
  contributionsC: number;
  contributionsBIndexed: number;
  contributionsCIndexed: number;

  sp500TaxEnabled: boolean;
  sp500TaxRate: number;

  oneTimeCostsDue: number;
}

interface PostHandoverStepOutput {
  row: MonthlyRow;
  remainingBalance: number;
  portfolioB: number;
  portfolioC: number;
  contributionsB: number;
  contributionsC: number;
  contributionsBIndexed: number;
  contributionsCIndexed: number;
}

function postHandoverStep(
  inp: PostHandoverStepInput,
): PostHandoverStepOutput {
  const {
    month, handoverMonth, constructionMonths,
    remainingBalance: prevBalance, shpitzerPMT, rMort,
    marketPrice, appreciation, purchasePrice, oneTimeCosts,
    currentRent, rentGrowth, rentalIncome, rentalIncomeAsPercent,
    rentalIncomePercent, vacancyMonths,
    rentalTaxEnabled, rentalTaxRate, rentalTaxExemption,
    taxRate, exemption, insurance, hoa,
    rSp, rInflation,
    portfolioB, portfolioC, contributionsB, contributionsC,
    contributionsBIndexed, contributionsCIndexed,
    sp500TaxEnabled, sp500TaxRate,
    oneTimeCostsDue: oneTimeCostsPaid,
  } = inp;

  const amort = amortizeOneMonth(prevBalance, rMort, shpitzerPMT);
  const mortgagePayment = amort.interest + amort.principal;
  const remainingBalance = amort.newBalance;

  const rentPaid = escalateByYear(currentRent, rentGrowth, month);
  const propertyValue = computePropertyValue(marketPrice, appreciation, month);

  const rentalIncomeThisMonth = computeRentalIncome(
    month, propertyValue, rentalIncome, rentalIncomeAsPercent,
    rentalIncomePercent, rentGrowth, vacancyMonths,
  );
  const rentalTaxThisMonth = computeRentalTax(
    rentalIncomeThisMonth, rentalTaxEnabled, rentalTaxRate, rentalTaxExemption,
  );
  const netRentalIncome = rentalIncomeThisMonth - rentalTaxThisMonth;

  const homeEquity = propertyValue - remainingBalance;
  const capitalGain = propertyValue - (purchasePrice + oneTimeCosts);
  const masShevach = computeMasShevach(capitalGain, exemption, taxRate);

  const housingCostA = mortgagePayment + insurance + hoa;
  const housingCostB = mortgagePayment + insurance + hoa - netRentalIncome;
  const housingCostC = rentPaid;

  // C is a non-investor in this comparison — they never sell stocks to top
  // up rent. Floor C's deposit at 0.
  const portfolioCDeposit = Math.max(0, housingCostA - housingCostC);
  const newPortfolioC = growPortfolio(portfolioC, rSp, portfolioCDeposit);
  const newContributionsC = contributionsC + portfolioCDeposit;
  const newContributionsCIndexed = indexContributions(
    contributionsCIndexed, rInflation, portfolioCDeposit,
  );

  // B is actively running a rental business — they ARE invested. If net
  // rental income falls short of their own rent (rental tax + vacancy +
  // own residence rent ≈ rental income), the shortfall comes from B's
  // savings each month. portfolioB CAN go slightly negative, representing
  // out-of-pocket subsidy. That's what differentiates B from A.
  const portfolioBDeposit = netRentalIncome - rentPaid;
  const newPortfolioB = growPortfolio(portfolioB, rSp, portfolioBDeposit);
  const newContributionsB = contributionsB + portfolioBDeposit;
  const newContributionsBIndexed = indexContributions(
    contributionsBIndexed, rInflation, portfolioBDeposit,
  );

  const sp500TaxBNow = computeSP500Tax(
    newPortfolioB, newContributionsBIndexed, sp500TaxEnabled, sp500TaxRate,
  );
  const sp500TaxCNow = computeSP500Tax(
    newPortfolioC, newContributionsCIndexed, sp500TaxEnabled, sp500TaxRate,
  );

  const netWorthA = homeEquity - masShevach;
  const netWorthB = homeEquity - masShevach + newPortfolioB - sp500TaxBNow;
  const netWorthC = newPortfolioC - sp500TaxCNow;

  const isZeroConstructionFirstPost = constructionMonths === 0 && (month - handoverMonth) === 1;

  return {
    row: {
      month,
      year: Math.ceil(month / 12),
      phase: "post",
      contractorPayment: 0,
      oneTimeCostsPaid: isZeroConstructionFirstPost ? oneTimeCostsPaid : 0,
      equityUsed: 0,
      mortgageDrawn: 0,
      drawnBalance: remainingBalance,
      constructionInterestPaid: 0,
      constructionPrincipalPaid: 0,
      constructionPayment: 0,
      mortgagePayment,
      interestPaid: amort.interest,
      principalPaid: amort.principal,
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
      portfolioB: newPortfolioB,
      portfolioC: newPortfolioC,
      contributionsB: newContributionsB,
      contributionsC: newContributionsC,
      contributionsBIndexed: newContributionsBIndexed,
      contributionsCIndexed: newContributionsCIndexed,
      sp500TaxB: sp500TaxBNow,
      sp500TaxC: sp500TaxCNow,
      netWorthA,
      netWorthB,
      netWorthC,
    },
    remainingBalance,
    portfolioB: newPortfolioB,
    portfolioC: newPortfolioC,
    contributionsB: newContributionsB,
    contributionsC: newContributionsC,
    contributionsBIndexed: newContributionsBIndexed,
    contributionsCIndexed: newContributionsCIndexed,
  };
}

// ============================================================================
// Main simulation
// ============================================================================

export function runSimulation(inputs: SimulationInputs): SimulationResult {
  const {
    purchasePrice, marketPrice, appreciation, holdingYears,
    constructionMonths, signingPct, constructionMode,
    equity, mortgageAmount, termYears, mortgageRate,
    madadPercent, isSingleResidence, legalFeesPercent, upgrades, furniture,
    insurance, hoa,
    currentRent, rentGrowth, rentalIncome, rentalIncomeAsPercent,
    rentalIncomePercent, vacancyMonths,
    taxRate, exemption,
    rentalTaxEnabled, rentalTaxRate, rentalTaxExemption,
    sp500TaxEnabled, sp500TaxRate, inflation, sp500Return,
  } = inputs;

  // Derived values
  const madad = purchasePrice * madadPercent;
  const purchaseTax = computePurchaseTax(purchasePrice, isSingleResidence);
  const legalFees = purchasePrice * legalFeesPercent;
  const oneTimeCosts = madad + purchaseTax + legalFees + upgrades + furniture;
  const handoverMonth = constructionMonths;
  const postHandoverMonths = holdingYears * 12;
  const totalMonths = handoverMonth + postHandoverMonths;

  const rMort = toMonthly(mortgageRate);
  const rSp = toMonthlyCompound(sp500Return);
  const termMonths = termYears * 12;
  const shpitzerPMT = pmt(mortgageAmount, rMort, termMonths);
  const rInflation = toMonthlyCompound(inflation);

  // Pre-compute the one-time costs breakdown for the zero-construction case
  const oneTimeCostsAtHandover = oneTimeCostsDue(
    1, 0, purchaseTax, legalFees, upgrades, madad, furniture,
  );

  const monthlyRows: MonthlyRow[] = [];

  // Mutable state across months
  let equityRemaining = equity;
  let drawnBalance = 0;
  let contractorObligation = purchasePrice;
  let portfolioB = 0;
  let portfolioC = equity;
  let contributionsB = 0;
  let contributionsC = equity;
  let contributionsBIndexed = 0;
  let contributionsCIndexed = equity;
  let remainingBalance = mortgageAmount;

  // ===== CONSTRUCTION PHASE =====
  for (let m = 1; m <= constructionMonths; m++) {
    const result = constructionStep({
      month: m,
      constructionMonths,
      purchasePrice,
      signingPct,
      constructionMode,
      rMort,
      termMonths,
      mortgageAmount,
      equityRemaining,
      drawnBalance,
      contractorObligation,
      purchaseTax,
      legalFees,
      upgrades,
      madad,
      furniture,
      marketPrice,
      appreciation,
      oneTimeCosts,
      currentRent,
      rentGrowth,
      rSp,
      rInflation,
      portfolioB,
      portfolioC,
      contributionsB,
      contributionsC,
      contributionsBIndexed,
      contributionsCIndexed,
      sp500TaxEnabled,
      sp500TaxRate,
    });

    monthlyRows.push(result.row);
    equityRemaining = result.equityRemaining;
    drawnBalance = result.drawnBalance;
    contractorObligation = result.contractorObligation;
    portfolioB = result.portfolioB;
    portfolioC = result.portfolioC;
    contributionsB = result.contributionsB;
    contributionsC = result.contributionsC;
    contributionsBIndexed = result.contributionsBIndexed;
    contributionsCIndexed = result.contributionsCIndexed;
  }

  // ===== HANDOVER TOP-UP =====
  if (drawnBalance < mortgageAmount) {
    drawnBalance = mortgageAmount;
  }
  remainingBalance = drawnBalance;

  // ===== POST-HANDOVER PHASE =====
  for (let k = 1; k <= postHandoverMonths; k++) {
    const m = handoverMonth + k;
    const result = postHandoverStep({
      month: m,
      handoverMonth,
      constructionMonths,
      remainingBalance,
      shpitzerPMT,
      rMort,
      marketPrice,
      appreciation,
      purchasePrice,
      oneTimeCosts,
      currentRent,
      rentGrowth,
      rentalIncome,
      rentalIncomeAsPercent,
      rentalIncomePercent,
      vacancyMonths,
      rentalTaxEnabled,
      rentalTaxRate,
      rentalTaxExemption,
      taxRate,
      exemption,
      insurance,
      hoa,
      rSp,
      rInflation,
      portfolioB,
      portfolioC,
      contributionsB,
      contributionsC,
      contributionsBIndexed,
      contributionsCIndexed,
      sp500TaxEnabled,
      sp500TaxRate,
      oneTimeCostsDue: oneTimeCostsAtHandover,
    });

    monthlyRows.push(result.row);
    remainingBalance = result.remainingBalance;
    portfolioB = result.portfolioB;
    portfolioC = result.portfolioC;
    contributionsB = result.contributionsB;
    contributionsC = result.contributionsC;
    contributionsBIndexed = result.contributionsBIndexed;
    contributionsCIndexed = result.contributionsCIndexed;
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
