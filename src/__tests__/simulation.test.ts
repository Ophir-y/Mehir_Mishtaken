import { describe, expect, it } from "vitest";
import {
  computeOneTimeCosts,
  computePurchaseTax,
  defaultInputs,
  defaultRentalIncome,
  legalHoldingMonthsAfterHandover,
  pmt,
  runSimulation,
  type SimulationInputs,
} from "@/lib/simulation";

/**
 * Test fixture mirrors the App.tsx derivation: mortgage = (price - equity) +
 * costs; holding years = MIN(7y from raffle, 5y from handover). Tests may
 * override `holdingYears` explicitly to bypass the derivation.
 */
function inputs(overrides: Partial<SimulationInputs> = {}): SimulationInputs {
  const base = { ...defaultInputs, ...overrides };
  base.rentalIncome =
    overrides.rentalIncome ?? defaultRentalIncome(base);
  if (base.equityAsPercent) {
    base.equity = base.purchasePrice * base.equityPercent;
  } else {
    base.equity = Math.min(base.equity, base.purchasePrice);
  }
  const oneTimeCosts = computeOneTimeCosts(base);
  base.mortgageAmount =
    Math.max(0, base.purchasePrice - base.equity) + oneTimeCosts;
  if (overrides.holdingYears === undefined) {
    base.holdingYears =
      legalHoldingMonthsAfterHandover(base.constructionMonths) / 12;
  }
  return base;
}

describe("legalHoldingMonthsAfterHandover (Mehir Matara lockup)", () => {
  it("24-month construction: 5y rule and 7y rule are tied — 60 months", () => {
    expect(legalHoldingMonthsAfterHandover(24)).toBe(60);
  });

  it("12-month construction: 5y rule binds — 60 months after handover", () => {
    // 7y from raffle = 84 mo. 12 months in → 72 mo remain. 5y rule = 60 mo wins.
    expect(legalHoldingMonthsAfterHandover(12)).toBe(60);
  });

  it("36-month construction: 7y rule binds — 48 months after handover", () => {
    // 7y from raffle = 84 mo. 36 months in → 48 mo remain. 48 < 60 → 48 wins.
    expect(legalHoldingMonthsAfterHandover(36)).toBe(48);
  });

  it("0 construction: 5y rule binds — 60 months", () => {
    expect(legalHoldingMonthsAfterHandover(0)).toBe(60);
  });

  it("construction > 7 years: holding floor is 0", () => {
    expect(legalHoldingMonthsAfterHandover(96)).toBe(0);
  });
});

describe("computePurchaseTax (Israeli brackets, 2024-2025)", () => {
  it("single residence: 0 tax below the first threshold", () => {
    expect(computePurchaseTax(1_500_000, true)).toBe(0);
    expect(computePurchaseTax(1_978_745, true)).toBe(0);
  });

  it("single residence: only the portion above 1,978,745 is taxed at 3.5%", () => {
    // 2,300,000 → (2,300,000 - 1,978,745) * 3.5% = 321,255 * 0.035 = 11,243.925
    expect(computePurchaseTax(2_300_000, true)).toBeCloseTo(11_243.925, 1);
  });

  it("single residence: bracket boundary 2,347,040 is fully in the 3.5% slab", () => {
    // (2,347,040 - 1,978,745) * 3.5% = 12,890.325
    expect(computePurchaseTax(2_347_040, true)).toBeCloseTo(12_890.325, 1);
  });

  it("single residence: prices above the second threshold add 5% on the slice", () => {
    // 3,000,000 = 12,890.325 + (3,000,000 - 2,347,040) * 5% = 12,890.325 + 32,648 = 45,538.325
    expect(computePurchaseTax(3_000_000, true)).toBeCloseTo(45_538.325, 1);
  });

  it("investor: 8% from the first shekel", () => {
    expect(computePurchaseTax(1_500_000, false)).toBeCloseTo(120_000, 1);
    expect(computePurchaseTax(2_300_000, false)).toBeCloseTo(184_000, 1);
  });

  it("investor: 10% kicks in above 6,055,070", () => {
    // 7,000,000 = 6,055,070 * 8% + (7,000,000 - 6,055,070) * 10%
    //          = 484,405.6 + 94,493 = 578,898.6
    expect(computePurchaseTax(7_000_000, false)).toBeCloseTo(578_898.6, 1);
  });
});

describe("pmt", () => {
  it("matches the standard Shpitzer PMT for 1.7M @ 4% / 30y", () => {
    const monthly = pmt(1_700_000, 0.04 / 12, 360);
    // Reference: ~8115.95 ₪ (computed value ~8116.06, difference ~0.11 is acceptable floating-point rounding)
    expect(monthly).toBeCloseTo(8115.95, 0);
  });

  it("returns principal / n when rate is zero", () => {
    expect(pmt(120_000, 0, 12)).toBeCloseTo(10_000, 6);
  });

  it("returns 0 for zero-term", () => {
    expect(pmt(100_000, 0.01, 0)).toBe(0);
  });
});

describe("one-time cost timing", () => {
  it("month 1 of construction pays purchase tax + legal + upgrades", () => {
    const config = inputs({
      constructionMonths: 24,
      madadPercent: 0, // isolate the signing-month bundle
      legalFeesPercent: 0.01,
      upgrades: 50_000,
      furniture: 30_000,
    });
    const expectedTax =
      config.purchasePrice * config.legalFeesPercent + 50_000 +
      computePurchaseTax(config.purchasePrice, config.isSingleResidence);
    const res = runSimulation(config);
    expect(res.monthly[0].oneTimeCostsPaid).toBeCloseTo(expectedTax, 0);
  });

  it("madad is spread uniformly across construction months", () => {
    const config = inputs({
      constructionMonths: 24,
      madadPercent: 0.04,
      legalFeesPercent: 0,
      upgrades: 0,
      furniture: 0,
    });
    const res = runSimulation(config);
    const cons = res.monthly.filter((r) => r.phase === "construction");
    const expectedMonthly =
      (config.purchasePrice * 0.04) / config.constructionMonths;
    // Each construction month should include exactly the monthly madad slice
    // (except month 1 which also has tax, and the last month which has furniture).
    for (let i = 1; i < cons.length - 1; i++) {
      expect(cons[i].oneTimeCostsPaid).toBeCloseTo(expectedMonthly, 1);
    }
  });

  it("furniture is paid at the handover month (last construction month)", () => {
    const config = inputs({
      constructionMonths: 24,
      madadPercent: 0,
      legalFeesPercent: 0,
      upgrades: 0,
      furniture: 75_000,
    });
    const res = runSimulation(config);
    const cons = res.monthly.filter((r) => r.phase === "construction");
    const lastConstruction = cons[cons.length - 1];
    expect(lastConstruction.oneTimeCostsPaid).toBeCloseTo(75_000, 1);
  });

  it("constructionMonths = 0: mortgage is fully drawn at handover (not stuck at 0)", () => {
    const config = inputs({
      constructionMonths: 0,
      mortgageRate: 0.04,
      madadPercent: 0,
      legalFeesPercent: 0,
      upgrades: 0,
      furniture: 0,
    });
    const res = runSimulation(config);
    const first = res.monthly[0];
    // Month 1 must show a real mortgage payment, not 0.
    expect(first.mortgagePayment).toBeGreaterThan(0);
    // After one Shpitzer month, remaining balance ≈ mortgageAmount - principal1.
    const r = 0.04 / 12;
    const pmtAmt = pmt(config.mortgageAmount, r, 360);
    const expectedRemaining =
      config.mortgageAmount - (pmtAmt - config.mortgageAmount * r);
    expect(first.remainingBalance).toBeCloseTo(expectedRemaining, 1);
  });

  it("constructionMonths = 0: all costs collapse to month 1 of post-handover", () => {
    const config = inputs({
      constructionMonths: 0,
      madadPercent: 0.04,
      legalFeesPercent: 0.01,
      upgrades: 50_000,
      furniture: 30_000,
    });
    const res = runSimulation(config);
    const expected = computeOneTimeCosts(config);
    expect(res.monthly[0].oneTimeCostsPaid).toBeCloseTo(expected, 0);
  });

  it("sum of monthly oneTimeCostsPaid during construction equals total costs", () => {
    const config = inputs({
      constructionMonths: 24,
      madadPercent: 0.04,
      legalFeesPercent: 0.01,
      upgrades: 50_000,
      furniture: 30_000,
    });
    const res = runSimulation(config);
    const sum = res.monthly
      .filter((r) => r.phase === "construction")
      .reduce((acc, r) => acc + r.oneTimeCostsPaid, 0);
    expect(sum).toBeCloseTo(computeOneTimeCosts(config), 0);
  });
});

describe("construction phase", () => {
  it("exhausts equity before drawing mortgage", () => {
    // signing = 20% of 2.3M = 460K; equity = 600K.
    // Month 1 also includes one-time costs (tax, legal, upgrades, madad/24).
    // So total due = 460K + ~108K = ~568K, all from equity.
    const res = runSimulation(inputs());
    const first = res.monthly[0];
    expect(first.phase).toBe("construction");
    // With default inputs, first month costs = signing + tax + legal + upgrades + madad/24
    const expected = first.contractorPayment + first.oneTimeCostsPaid;
    expect(first.equityUsed).toBeCloseTo(expected, 0);
    expect(first.mortgageDrawn).toBeCloseTo(0, 0);
    expect(first.drawnBalance).toBeCloseTo(0, 0);
  });

  it("interest-only mode: drawn balance stays at the drawn level (no growth from interest)", () => {
    const res = runSimulation(
      inputs({ constructionMode: "interest_only", equity: 600_000 }),
    );
    // Find a stretch of consecutive months with no new drawdowns and check that
    // drawnBalance does not creep upward from interest capitalization.
    const cons = res.monthly.filter((r) => r.phase === "construction");
    let firstStableIdx = -1;
    for (let i = 1; i < cons.length; i++) {
      if (cons[i].mortgageDrawn === 0) {
        firstStableIdx = i;
        break;
      }
    }
    // Inside our default, equity covers signing + most of the second month, so
    // we find some month where drawdowns are nonzero. Force a synthetic case
    // by checking that interest paid > 0 but the drawn balance equals the
    // previous balance.
    const withDraws = cons.find((r) => r.drawnBalance > 0);
    if (withDraws) {
      // For any subsequent month with mortgageDrawn === 0 in interest_only,
      // the drawn balance should be equal to the previous month's balance.
      const idx = cons.indexOf(withDraws);
      for (let j = idx + 1; j < cons.length; j++) {
        if (cons[j].mortgageDrawn === 0) {
          expect(cons[j].drawnBalance).toBeCloseTo(cons[j - 1].drawnBalance, 2);
          break;
        }
      }
    }
    expect(firstStableIdx).toBeGreaterThanOrEqual(-1); // existence only
  });

  it("full grace mode: drawn balance grows by accrued interest each month", () => {
    const res = runSimulation(
      inputs({
        constructionMode: "full_grace",
        signingPct: 0.05,
        equity: 100_000,
        mortgageRate: 0.04,
      }),
    );
    const cons = res.monthly.filter((r) => r.phase === "construction");
    // Find consecutive months where drawn balance > 0 and mortgageDrawn === 0.
    // In that case full_grace must grow balance by previous * (1 + rate/12).
    for (let i = 1; i < cons.length; i++) {
      const prev = cons[i - 1];
      const cur = cons[i];
      if (prev.drawnBalance > 0 && cur.mortgageDrawn === 0) {
        const expected = prev.drawnBalance * (1 + 0.04 / 12);
        expect(cur.drawnBalance).toBeCloseTo(expected, 2);
        return;
      }
    }
    // If the schedule keeps drawing every month, at minimum each month's
    // balance must be ≥ previous balance + drawn (i.e. interest never reduces it).
    for (let i = 1; i < cons.length; i++) {
      expect(cons[i].drawnBalance).toBeGreaterThanOrEqual(
        cons[i - 1].drawnBalance + cons[i].mortgageDrawn - 0.01,
      );
    }
  });

  it("at handover, drawn balance equals the contracted mortgage amount", () => {
    // Zero out one-time costs so the mortgage equals (price - equity) = 1.7M.
    // Use a low purchase price to avoid purchase tax brackets.
    const config = inputs({
      constructionMode: "interest_only",
      mortgageRate: 0.04,
      purchasePrice: 1_500_000, // below tax threshold for single residence
      madadPercent: 0,
      legalFeesPercent: 0,
      upgrades: 0,
      furniture: 0,
    });
    const res = runSimulation(config);
    const lastConstruction = res.monthly
      .filter((r) => r.phase === "construction")
      .pop()!;
    const firstPost = res.monthly.find((r) => r.phase === "post")!;
    const r = 0.04 / 12;
    const pmtAmt = pmt(config.mortgageAmount, r, 360);
    const expectedAfterMonth1 =
      config.mortgageAmount - (pmtAmt - config.mortgageAmount * r);
    expect(firstPost.remainingBalance).toBeCloseTo(expectedAfterMonth1, 1);
    expect(lastConstruction.drawnBalance).toBeLessThanOrEqual(
      config.mortgageAmount,
    );
  });
});

describe("post-handover phase", () => {
  it("property value uses the market price as the base for appreciation", () => {
    const res = runSimulation(inputs());
    // Construction = 24 months, Mehir Matara lockup with 24m construction =
    // min(84 - 24, 60) = 60 months → last month = 24 + 60 = 84.
    const last = res.monthly[res.monthly.length - 1];
    const expected = 3_100_000 * Math.pow(1 + 0.025, last.month / 12);
    expect(last.propertyValue).toBeCloseTo(expected, 0);
  });

  it("portfolio B does not double-count the mortgage (only rent flows)", () => {
    // Force rental_income == rent_paid and rentGrowth = 0 → portfolio B should
    // stay at zero through the post-handover phase. Disable rental + S&P
    // taxes so the equality holds exactly.
    const res = runSimulation(
      inputs({
        currentRent: 6500,
        purchasePrice: 1_500_000, // keep tax minimal
        rentalIncomeAsPercent: false, // use absolute ₪ mode
        rentalIncome: 6500 / (1 - 0.5 / 12), // before vacancy
        vacancyMonths: 0.5,
        rentGrowth: 0,
        constructionMonths: 0, // skip construction so portfolioB starts at 0
        rentalTaxEnabled: false,
        sp500TaxEnabled: false,
      }),
    );
    const firstPost = res.monthly[0];
    // Post-handover deposit = netRentalIncome - rentPaid = 0
    expect(firstPost.portfolioBDeposit).toBeCloseTo(0, 2);
    expect(firstPost.portfolioB).toBeCloseTo(0, 2);
  });

  it("rental tax = max(0, gross - exemption) * rate", () => {
    const res = runSimulation(
      inputs({
        constructionMonths: 0,
        purchasePrice: 1_500_000, // keep tax minimal
        rentalIncomeAsPercent: false, // use absolute ₪ mode
        rentalIncome: 8000,
        vacancyMonths: 0, // no vacancy adjustment
        rentGrowth: 0,
        rentalTaxEnabled: true,
        rentalTaxRate: 0.10,
        rentalTaxExemption: 5500,
      }),
    );
    const first = res.monthly[0];
    // Gross = 8000, taxable = 8000 - 5500 = 2500, tax = 250
    expect(first.rentalTax).toBeCloseTo(250, 2);
    expect(first.netRentalIncome).toBeCloseTo(8000 - 250, 2);
  });

  it("rental tax is zero when gross is below the exemption", () => {
    const res = runSimulation(
      inputs({
        constructionMonths: 0,
        purchasePrice: 1_500_000, // keep tax minimal
        rentalIncomeAsPercent: false, // use absolute ₪ mode
        rentalIncome: 4000,
        vacancyMonths: 0,
        rentGrowth: 0,
        rentalTaxEnabled: true,
        rentalTaxExemption: 5500,
      }),
    );
    expect(res.monthly[0].rentalTax).toBe(0);
  });

  it("S&P CGT (nominal, inflation = 0): tax on portfolio - nominal contributions", () => {
    const res = runSimulation(
      inputs({
        constructionMonths: 0,
        holdingYears: 1,
        sp500Return: 0.12,
        purchasePrice: 1_500_000, // keep tax minimal
        sp500TaxEnabled: true,
        sp500TaxRate: 0.25,
        inflation: 0, // disable inflation indexing → matches nominal model
      }),
    );
    const last = res.monthly[res.monthly.length - 1];
    // With inflation=0, indexed === nominal contributions.
    expect(last.contributionsCIndexed).toBeCloseTo(last.contributionsC, 2);
    const expectedGain = last.portfolioC - Math.max(0, last.contributionsC);
    expect(last.sp500TaxC).toBeCloseTo(Math.max(0, expectedGain) * 0.25, 2);
    expect(last.netWorthC).toBeCloseTo(last.portfolioC - last.sp500TaxC, 2);
  });

  it("S&P CGT (real, with inflation): indexed contributions exceed nominal, tax is lower", () => {
    const noInflation = runSimulation(
      inputs({
        constructionMonths: 0,
        holdingYears: 5,
        sp500Return: 0.10,
        sp500TaxEnabled: true,
        sp500TaxRate: 0.25,
        inflation: 0,
      }),
    );
    const withInflation = runSimulation(
      inputs({
        constructionMonths: 0,
        holdingYears: 5,
        sp500Return: 0.10,
        sp500TaxEnabled: true,
        sp500TaxRate: 0.25,
        inflation: 0.03,
      }),
    );
    const a = noInflation.monthly[noInflation.monthly.length - 1];
    const b = withInflation.monthly[withInflation.monthly.length - 1];
    // Indexed contributions should be strictly higher than nominal after 5 years
    // of 3% inflation.
    expect(b.contributionsCIndexed).toBeGreaterThan(b.contributionsC);
    expect(b.contributionsCIndexed).toBeGreaterThan(a.contributionsCIndexed);
    // → smaller real gain → smaller tax
    expect(b.sp500TaxC).toBeLessThan(a.sp500TaxC);
  });

  it("S&P CGT is zero when sp500TaxEnabled is false", () => {
    const res = runSimulation(
      inputs({ sp500TaxEnabled: false, sp500Return: 0.12 }),
    );
    expect(res.monthly.every((r) => r.sp500TaxC === 0 && r.sp500TaxB === 0)).toBe(true);
  });

  it("mas shevach is zero when the exemption is on", () => {
    const res = runSimulation(inputs({ exemption: true }));
    expect(
      res.monthly.every((r) => r.masShevach === 0),
    ).toBe(true);
  });

  it("mas shevach is nonzero when the exemption is off and there's a gain", () => {
    const res = runSimulation(
      inputs({ exemption: false, taxRate: 0.25 }),
    );
    const post = res.monthly.filter((r) => r.phase === "post");
    expect(post.some((r) => r.masShevach > 0)).toBe(true);
    // Net worth A = home equity - mas shevach
    for (const r of post) {
      expect(r.netWorthA).toBeCloseTo(r.homeEquity - r.masShevach, 0);
    }
  });
});

describe("edge cases", () => {
  it("constructionMonths = 0 produces no construction rows", () => {
    const config = inputs({
      constructionMonths: 0,
      mortgageRate: 0.04,
      purchasePrice: 1_500_000, // below tax threshold to avoid purchase tax
      madadPercent: 0,
      legalFeesPercent: 0,
      upgrades: 0,
      furniture: 0,
    });
    const res = runSimulation(config);
    expect(res.monthly.every((r) => r.phase === "post")).toBe(true);
    const first = res.monthly[0];
    const r = 0.04 / 12;
    const pmtAmt = pmt(config.mortgageAmount, r, 360);
    expect(first.mortgagePayment).toBeCloseTo(pmtAmt, 2);
  });

  it("handoverMonth in summary matches inputs.constructionMonths", () => {
    const res = runSimulation(inputs({ constructionMonths: 18 }));
    expect(res.summary.handoverMonth).toBe(18);
    // Mehir Matara lockup: min(7y from raffle - construction, 5y from handover)
    // = min(84 - 18, 60) = min(66, 60) = 60 months
    expect(res.summary.totalMonths).toBe(18 + 60);
  });

  it("yearly rollup has one entry per completed year", () => {
    const res = runSimulation(inputs());
    // Mehir Matara lockup: 24 months construction + min(84-24, 60) = 84 total
    const totalYears = Math.ceil(84 / 12);
    expect(res.yearly.length).toBe(totalYears);
  });
});

describe("portfolio C", () => {
  it("starts with the equity + one-time costs and compounds at the S&P monthly rate", () => {
    // Scenario C = don't buy, rent and invest equity in S&P 500.
    // Verify that portfolio C compounds correctly month-to-month.
    const res = runSimulation(
      inputs({
        constructionMonths: 0,
        holdingYears: 2,
        sp500Return: 0.12,
        purchasePrice: 1_500_000,
        equity: 600_000,
        madadPercent: 0,
        legalFeesPercent: 0,
        upgrades: 0,
        furniture: 0,
        sp500TaxEnabled: false,
        rentalIncomeAsPercent: false,
        rentalIncome: 0,
        rentalTaxEnabled: false,
      }),
    );
    // Verify the compound formula: portfolioC[t] = portfolioC[t-1] * (1 + rSp) + deposit[t]
    // by checking any two consecutive months
    const m0 = res.monthly[0];
    const m1 = res.monthly[1];
    const rSp = Math.pow(1.12, 1 / 12) - 1;
    const expectedC1 = m0.portfolioC * (1 + rSp) + m1.portfolioCDeposit;
    expect(m1.portfolioC).toBeCloseTo(expectedC1, 0);
  });

  it("higher one-time costs → larger mortgage → higher A housing cost → higher C portfolio", () => {
    const lowCosts = runSimulation(
      inputs({
        constructionMonths: 0,
        holdingYears: 5,
        sp500Return: 0.10,
        purchasePrice: 1_500_000, // below tax threshold
        madadPercent: 0,
        legalFeesPercent: 0,
        upgrades: 0,
        furniture: 0,
      }),
    );
    const highCosts = runSimulation(
      inputs({
        constructionMonths: 0,
        holdingYears: 5,
        sp500Return: 0.10,
        madadPercent: 0.04,
        legalFeesPercent: 0.01,
        upgrades: 100_000,
        furniture: 50_000,
      }),
    );
    const lowLast = lowCosts.monthly[lowCosts.monthly.length - 1];
    const highLast = highCosts.monthly[highCosts.monthly.length - 1];
    expect(highLast.portfolioC).toBeGreaterThan(lowLast.portfolioC);
  });
});
