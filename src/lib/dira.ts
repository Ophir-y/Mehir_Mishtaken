// Shared upstream URL + headers + parser for the official Mehir Matara
// projects endpoint at dira.moch.gov.il.
// Imported by both the Vercel serverless function (api/projects.ts) and the
// Vite dev middleware (vite.config.ts) so the dev experience matches prod.

// Relative imports (not `@/...`) because vite.config.ts loads this module
// directly through Node, before Vite's alias resolver is active.
import type {
  Project,
  ProjectPricePerSqm,
  ProjectStatus,
} from "./types";
import yieldsJson from "../data/city-rental-yields.json";
import marketJson from "../data/city-market-prices.json";

const CITY_YIELDS = yieldsJson as {
  yields: Record<string, number>;
  _meta: { defaultYield: number };
};
const CITY_MARKET = marketJson as {
  pricesPerSqm: Record<string, number>;
  _meta: {
    defaultPricePerSqm: number;
    newConstructionPremium: number;
  };
};
const DEFAULT_RENTAL_YIELD = CITY_YIELDS._meta.defaultYield;
const DEFAULT_FREE_MARKET_PER_SQM = CITY_MARKET._meta.defaultPricePerSqm;
const NEW_CONSTRUCTION_PREMIUM = CITY_MARKET._meta.newConstructionPremium;

export function rentalYieldForCity(city: string): number {
  const direct = CITY_YIELDS.yields[city];
  if (typeof direct === "number") return direct;
  const trimmed = city.trim();
  const fuzzy = CITY_YIELDS.yields[trimmed];
  return typeof fuzzy === "number" ? fuzzy : DEFAULT_RENTAL_YIELD;
}

export function freeMarketPerSqmForCity(city: string): number {
  const direct = CITY_MARKET.pricesPerSqm[city];
  if (typeof direct === "number") return direct;
  const trimmed = city.trim();
  const fuzzy = CITY_MARKET.pricesPerSqm[trimmed];
  return typeof fuzzy === "number" ? fuzzy : DEFAULT_FREE_MARKET_PER_SQM;
}

const LIVE_ENDPOINT_PARAMS =
  "?firstApplicantIdentityNumber=&secondApplicantIdentityNumber=" +
  "&ProjectStatus=4&Entitlement=1&PageNumber=1&PageSize=200&IsInit=true&";

/** Official endpoint backing dira.moch.gov.il/ProjectsList. */
export const LIVE_ENDPOINT =
  "https://dira.moch.gov.il/api/Invoker?method=Projects&param=" +
  encodeURIComponent(LIVE_ENDPOINT_PARAMS);

/** Browser-like headers — the site is behind a WAF that filters obvious bots. */
export const LIVE_HEADERS: Record<string, string> = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9,he;q=0.8",
  referer: "https://dira.moch.gov.il/ProjectsList",
  "sec-ch-ua":
    '"Microsoft Edge";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0",
};

/**
 * Per-m² derivation:
 *   - listPricePerSqm = `PricePerUnit × (1 + VAT)`. The API exposes the
 *     pre-VAT gov-set price; buyers pay the VAT-inclusive list ("המחיר
 *     המוצג כולל מע״מ"), which is also what the discount applies to.
 *   - discountPercent parsed from Notes HTML (e.g. "25%"), default 25%.
 *   - discountCapNIS parsed from Notes (e.g. "500,000 ₪"), default 500K.
 *   - lotteryPricePerSqm = list × (1 − discountPercent). The cap doesn't
 *     enter per-m² math directly; for a 95 m² apartment the cap binds only
 *     when 25% × 95 × listPerSqm > cap (rarely in the current data).
 *   - cityFreeMarketPerSqm looked up in `city-market-prices.json`.
 *   - marketPricePerSqm = cityFreeMarketPerSqm × (1 + newConstructionPremium),
 *     since this is *new* construction and new typically commands ~7% over
 *     comparable resale.
 *   - savingsPercent = (market − lottery) / market — the meaningful number.
 *
 * For the simulation engine (which needs total ₪, not ₪/m²) we still emit
 * ONE apartment per lottery at a representative size of 95 m² (typical
 * 4-room). The detail modal can adjust this; the table doesn't depend on it.
 */
const REPRESENTATIVE_SQM = 110;
const DEFAULT_DISCOUNT_PCT = 0.25;
const DEFAULT_DISCOUNT_CAP_NIS = 500_000;
const DEFAULT_HANDOVER_MONTHS = 30;
/**
 * Israeli VAT on new construction. The API's `PricePerUnit` is the gov-set
 * ₪/m² BEFORE VAT; buyers actually pay `PricePerUnit × (1 + VAT)`. The
 * regulation discount is applied to the displayed (VAT-inclusive) price
 * per Notes: "25% ממחיר הדירה המוצג (כולל מע״מ)".
 * Israel raised VAT from 17% to 18% on 2025-01-01.
 */
const VAT_RATE = 0.18;

export function liveToProjects(live: unknown): Project[] {
  if (!live || typeof live !== "object") return [];
  const root = live as {
    ProjectItems?: unknown[];
    Data?: unknown[];
    data?: unknown[];
  };
  const rows = Array.isArray(root.ProjectItems)
    ? root.ProjectItems
    : Array.isArray(root.Data)
      ? root.Data
      : Array.isArray(root.data)
        ? root.data
        : [];

  const out: Project[] = [];
  const nowMs = Date.now();
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;

    const lotteryNumber = firstString(r.LotteryNumber);
    if (!lotteryNumber) continue;

    // Keep only Mehir Matara tracks. ResponsibilityCode:
    //   23 = "מחיר מטרה" (developer-managed)
    //   24 = "מחיר מטרה – ר.מ.י" (ILA-managed land)
    const responsibilityCode = numberOrNull(r.ResponsibilityCode);
    const responsibilityDesc = firstString(r.ResponsibilityDescription) ?? "";
    const isMehirMatara =
      responsibilityCode === 23 ||
      responsibilityCode === 24 ||
      responsibilityDesc.includes("מחיר מטרה");
    if (!isMehirMatara) continue;

    const city = String(r.CityDescription ?? "").trim();
    const projectName = String(r.ProjectName ?? "").trim();
    const neighborhood = String(r.NeighborhoodName ?? "").trim();
    const opensAt = firstString(r.ApplicationStartDate);
    const closesAt = firstString(r.ApplicationEndDate);
    const developer = firstString(r.ContractorDescription)?.trim();
    const isReligious = r.IsReligious === true;
    const permitStatus = firstString(r.PermitStatus)?.trim();
    const housingUnits = numberOrNull(r.HousingUnits);

    const pricePerSqm = numberOrNull(r.PricePerUnit);
    const lotteryApartmentsCount = numberOrNull(r.LotteryApparmentsNum);
    const totalSubscribers = numberOrNull(r.TotalSubscribers);
    const deliveryAt = firstString(r.LotDeliveryDate);
    const notesHtml = firstString(r.Notes) ?? "";

    // ----- Per-m² economics -----
    const discountPercent =
      parseDiscountPercent(notesHtml) ?? DEFAULT_DISCOUNT_PCT;
    const discountCapNIS =
      parseDiscountCapNIS(notesHtml) ?? DEFAULT_DISCOUNT_CAP_NIS;

    // API value is pre-VAT; bring it up to the buyer-facing list price.
    const listPricePerSqm = Math.round((pricePerSqm ?? 0) * (1 + VAT_RATE));
    const lotteryPricePerSqm = Math.round(
      listPricePerSqm * (1 - discountPercent),
    );
    const cityFreeMarketPerSqm = freeMarketPerSqmForCity(city);
    const marketPricePerSqm = Math.round(
      cityFreeMarketPerSqm * (1 + NEW_CONSTRUCTION_PREMIUM),
    );
    const savingsPercent =
      marketPricePerSqm > 0
        ? (marketPricePerSqm - lotteryPricePerSqm) / marketPricePerSqm
        : 0;

    const pricePerSqmInfo: ProjectPricePerSqm = {
      listPricePerSqm,
      discountPercent,
      discountCapNIS,
      lotteryPricePerSqm,
      cityFreeMarketPerSqm,
      marketPricePerSqm,
      savingsPercent,
    };

    // ----- Total prices at the representative size (simulation seed only) -----
    const marketPrice = marketPricePerSqm * REPRESENTATIVE_SQM;
    const lotteryPrice = lotteryPricePerSqm * REPRESENTATIVE_SQM;
    const annualYield = rentalYieldForCity(city);
    const estimatedRent = Math.round((marketPrice * annualYield) / 12);
    const apartments = [
      {
        rooms: 4, // legacy placeholder for the simulation engine
        marketPrice,
        lotteryPrice,
        unitsOffered: lotteryApartmentsCount ?? 0,
        applicants: totalSubscribers ?? null,
        estimatedRent,
      },
    ];

    let status: ProjectStatus = "open";
    if (closesAt) {
      const closeMs = Date.parse(closesAt);
      if (Number.isFinite(closeMs) && closeMs < nowMs) status = "closed";
    }
    if (status === "open" && opensAt) {
      const openMs = Date.parse(opensAt);
      if (Number.isFinite(openMs) && openMs > nowMs) status = "upcoming";
    }

    let estimatedHandoverMonths = DEFAULT_HANDOVER_MONTHS;
    if (deliveryAt) {
      const deliveryMs = Date.parse(deliveryAt);
      if (Number.isFinite(deliveryMs) && deliveryMs > nowMs) {
        estimatedHandoverMonths = Math.max(
          1,
          Math.round((deliveryMs - nowMs) / (1000 * 60 * 60 * 24 * 30.4375)),
        );
      } else if (Number.isFinite(deliveryMs)) {
        estimatedHandoverMonths = 0;
      }
    }

    const isTrivialName = !projectName || projectName.length <= 2;
    const displayProjectName = isTrivialName
      ? neighborhood
        ? `${neighborhood} (הגרלה ${lotteryNumber})`
        : `הגרלה ${lotteryNumber}`
      : neighborhood
        ? `${neighborhood} · ${projectName}`
        : projectName;

    const notesParts: (string | null)[] = [
      `הגרלה ${lotteryNumber}`,
      `מחירון: ${formatNum(listPricePerSqm)} ₪/מ״ר → ${formatNum(lotteryPricePerSqm)} ₪/מ״ר אחרי הנחה ${(discountPercent * 100).toFixed(0)}%`,
      `שוק חופשי (חדש): ${formatNum(marketPricePerSqm)} ₪/מ״ר → חיסכון ${(savingsPercent * 100).toFixed(1)}%`,
      housingUnits ? `${housingUnits} יח״ד בפרויקט` : null,
      isReligious ? "ייעוד דתי" : null,
      permitStatus ? `היתר: ${permitStatus}` : null,
      developer ? `יזם: ${developer}` : null,
    ];

    out.push({
      id: `lottery-${lotteryNumber}`,
      city,
      projectName: displayProjectName,
      developer,
      estimatedHandoverMonths,
      apartments,
      pricePerSqm: pricePerSqmInfo,
      sourceUrl: `https://dira.moch.gov.il/ProjectsList`,
      notes: notesParts.filter((p): p is string => Boolean(p)).join(" · "),
      status,
      registrationClosesAt: closesAt,
      registrationOpensAt: opensAt,
    });
  }
  return out;
}

function firstString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function numberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function formatNum(n: number): string {
  return new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 }).format(n);
}

/**
 * Parse the discount cap (₪) from the Notes HTML. Examples found in real
 * responses: "ב. 500,000 ₪", "ב. 600,000 ₪", "עד 550,000 ₪".
 */
function parseDiscountCapNIS(html: string): number | null {
  if (!html) return null;
  const match = html.match(/([0-9]{3}(?:,[0-9]{3})+)\s*₪/);
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse the discount percentage from Notes. Real text:
 *   "א. 25% ממחיר הדירה המוצג (כולל מע\"מ)"
 *   "1. 25% ממחיר הדירה המוצג (כולל מע\"מ)"
 * Default is 25% across the current 82 open Mehir Matara lotteries — but
 * we parse instead of hardcoding so a future regulation change is picked up
 * automatically.
 */
function parseDiscountPercent(html: string): number | null {
  if (!html) return null;
  // Find a NN% appearing before "ממחיר הדירה" (the regulation phrase).
  const match = html.match(/(\d+(?:\.\d+)?)\s*%\s*ממחיר הדירה/);
  if (!match) return null;
  const n = Number(match[1]) / 100;
  if (!Number.isFinite(n) || n <= 0 || n >= 1) return null;
  return n;
}
