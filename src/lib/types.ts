/** Data types for the city-selection page. */

export interface ProjectApartment {
  rooms: number;
  lotteryPrice: number;
  marketPrice: number;
  unitsOffered: number;
  /** Null until the lottery closes registration and the count is published. */
  applicants: number | null;
  estimatedRent: number;
}

/**
 * Per-m² economics for a project. Used by the table to compare lotteries
 * independently of apartment size. All ₪/m² values; the totals on
 * `ProjectApartment` are derived by multiplying by an assumed size.
 */
export interface ProjectPricePerSqm {
  /** Gov-set list price per m² ("המחיר המוצג"). Equals `PricePerUnit`. */
  listPricePerSqm: number;
  /** Discount fraction the regulations apply (0..1). Default 0.25. */
  discountPercent: number;
  /** Cap on the absolute ₪ discount, parsed from Notes (default 500K). */
  discountCapNIS: number;
  /** What the buyer actually pays per m² = list × (1 − discountPercent). */
  lotteryPricePerSqm: number;
  /** Resale (yad-2) average price per m² in this city. */
  cityFreeMarketPerSqm: number;
  /** New-construction market price per m² = cityFreeMarketPerSqm × 1.07. */
  marketPricePerSqm: number;
  /**
   * (market − lottery) / market — how much cheaper than buying an equivalent
   * new-construction apartment on the open market in this city.
   */
  savingsPercent: number;
}

export type ProjectStatus = "open" | "upcoming" | "closed" | "drawn";

export interface Project {
  id: string;
  city: string;
  projectName: string;
  developer?: string;
  estimatedHandoverMonths: number;
  apartments: ProjectApartment[];
  /**
   * Per-m² economics — the unit of comparison for the table. Optional only
   * because some legacy seed projects don't have it; live data always does.
   */
  pricePerSqm?: ProjectPricePerSqm;
  sourceUrl?: string;
  notes?: string;
  status: ProjectStatus;
  registrationClosesAt?: string;
  registrationOpensAt?: string;
}

export interface ProjectsResponse {
  projects: Project[];
  fetchedAt: string;
  source: "live" | "seed" | "merged";
  /** Populated when something went wrong but we still served seed data. */
  reason?: string;
}

export interface ScoredApartment {
  project: Project;
  apt: ProjectApartment;
  /** 0-100 composite. */
  score: number;
  /** Per-factor 0-100 sub-scores (transparency / explanation). */
  breakdown: {
    discount: number;
    realReturn: number;
    rentalYield: number;
    winProbability: number;
    equityBurden: number;
  };
  /** Cached metrics used both by scoring and the UI. */
  metrics: {
    discountFraction: number; // 0..1
    discountAbsolute: number; // ₪
    annualReturnPct: number; // decimal
    rentalYieldGross: number; // decimal
    winProbability: number; // 0..1
    requiredEquity: number; // ₪
    finalNetWorthA: number; // ₪ at end of holding
    monthlyMortgagePayment: number; // ₪
    monthlyCashFlowB: number; // ₪ (rental income - mortgage - opex, approx)
  };
}

export interface ScoredProject {
  project: Project;
  /** Best apartment in the project drives the city-level decision. */
  best: ScoredApartment;
  /** All apartment scores for the detail view. */
  apartments: ScoredApartment[];
  /** Convenience: same as best.score. */
  score: number;
}
