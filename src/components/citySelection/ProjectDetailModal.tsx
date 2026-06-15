import * as React from "react";
import { X } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartView } from "@/components/ChartView";
import { SummaryCard } from "@/components/SummaryCard";
import { YearlyTable } from "@/components/YearlyTable";
import { SliderInput } from "@/components/SliderInput";
import { ScoreBadge } from "@/components/citySelection/ScoreBadge";
import { DeadlineChip } from "@/components/citySelection/DeadlineChip";
import { formatPercent, formatShekels } from "@/lib/format";
import { analyzeApartment } from "@/lib/projectAnalysis";
import type { UserPreferences } from "@/lib/userPreferences";
import type {
  ProjectApartment,
  ScoredApartment,
  ScoredProject,
} from "@/lib/types";

/** Size baked into the parser; modal slider defaults here and scales around it. */
const REPRESENTATIVE_SQM = 110;

interface ProjectDetailModalProps {
  scored: ScoredProject;
  prefs: UserPreferences;
  onClose: () => void;
}

export function ProjectDetailModal({ scored, prefs, onClose }: ProjectDetailModalProps) {
  const [sizeSqm, setSizeSqm] = React.useState(REPRESENTATIVE_SQM);

  // The parser emits one apartment per lottery at REPRESENTATIVE_SQM (95).
  // We linearly scale its totals to the user's chosen size for the sim.
  const baseApt: ScoredApartment = scored.best;
  const scaledApt: ProjectApartment = React.useMemo(() => {
    const k = sizeSqm / REPRESENTATIVE_SQM;
    return {
      ...baseApt.apt,
      marketPrice: Math.round(baseApt.apt.marketPrice * k),
      lotteryPrice: Math.round(baseApt.apt.lotteryPrice * k),
      estimatedRent: Math.round(baseApt.apt.estimatedRent * k),
    };
  }, [baseApt.apt, sizeSqm]);

  const { result } = React.useMemo(
    () =>
      analyzeApartment(scored.project, scaledApt, {
        equityAsPercent: true,
        equityPercent: prefs.equityPercent,
        currentRent: prefs.currentRent,
      }),
    [scored.project, scaledApt, prefs.equityPercent, prefs.currentRent],
  );

  // Close on Esc.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-8 px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl rounded-xl bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b p-5 sticky top-0 bg-background z-10 rounded-t-xl">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold">{scored.project.city}</h2>
              <ScoreBadge value={baseApt.score} size="md" label="ציון" />
              <DeadlineChip project={scored.project} size="md" showDate />
            </div>
            <p className="text-sm text-muted-foreground">
              {scored.project.projectName}
              {scored.project.developer
                ? ` · יזם: ${scored.project.developer}`
                : ""}
            </p>
            {scored.project.notes ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {scored.project.notes}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded hover:bg-muted"
            aria-label="סגור"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-5 space-y-6">
          <PerSqmCard scored={scored} sizeSqm={sizeSqm} scaledApt={scaledApt} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">גודל דירה לסימולציה</CardTitle>
              <p className="text-sm text-muted-foreground">
                שינוי הגודל ישפיע על כל הסכומים ועל הסימולציה למטה.
              </p>
            </CardHeader>
            <CardContent>
              <SliderInput
                label="גודל מ״ר"
                value={sizeSqm}
                onChange={setSizeSqm}
                min={50}
                max={200}
                step={1}
                unit=""
                formatValue={(n) => `${n.toFixed(0)} מ״ר`}
              />
            </CardContent>
          </Card>

          <ScoreBreakdownCard aptScore={baseApt} />

          <SummaryCard result={result} />
          <ChartView result={result} />
          <YearlyTable result={result} />
        </div>
      </div>
    </div>
  );
}

function PerSqmCard({
  scored,
  sizeSqm,
  scaledApt,
}: {
  scored: ScoredProject;
  sizeSqm: number;
  scaledApt: ProjectApartment;
}) {
  const info = scored.effectivePricePerSqm ?? scored.project.pricePerSqm;
  if (!info) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">השוואת מחירים</CardTitle>
        <p className="text-sm text-muted-foreground">
          ערכי ₪/מ״ר וסכום לדירה בגודל {sizeSqm} מ״ר.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <PriceBox
            label="מחירון (לפני הנחה)"
            perSqm={info.listPricePerSqm}
            total={info.listPricePerSqm * sizeSqm}
            tone="muted"
          />
          <PriceBox
            label={`מחיר הגרלה (אחרי הנחה ${(info.discountPercent * 100).toFixed(0)}%)`}
            perSqm={info.lotteryPricePerSqm}
            total={scaledApt.lotteryPrice}
            tone="primary"
          />
          <PriceBox
            label="שוק חופשי (דירה חדשה)"
            perSqm={info.marketPricePerSqm}
            total={scaledApt.marketPrice}
            tone="muted"
            sub={`מבוסס מחיר יד-2 בעיר: ${formatShekels(info.cityFreeMarketPerSqm)}/מ״ר + 7% פרמיית בנייה חדשה`}
          />
        </div>
        <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              חיסכון נטו מול שוק חופשי
            </span>
            <span className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatPercent(info.savingsPercent, 1)}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            (מחיר שוק חופשי − מחיר הגרלה) / מחיר שוק חופשי
          </div>
          <div className="mt-2 text-sm tabular-nums">
            חיסכון מוחלט בגודל {sizeSqm} מ״ר:{" "}
            <span className="font-semibold">
              {formatShekels(scaledApt.marketPrice - scaledApt.lotteryPrice)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PriceBox({
  label,
  perSqm,
  total,
  tone,
  sub,
}: {
  label: string;
  perSqm: number;
  total: number;
  tone: "primary" | "muted";
  sub?: string;
}) {
  return (
    <div
      className={`rounded-md border p-3 space-y-1 ${
        tone === "primary" ? "border-primary bg-primary/5" : ""
      }`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold tabular-nums">
        {formatShekels(perSqm)}{" "}
        <span className="text-xs font-normal text-muted-foreground">/מ״ר</span>
      </div>
      <div className="text-xs tabular-nums text-muted-foreground">
        סה״כ: {formatShekels(total)}
      </div>
      {sub ? <div className="text-[10px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function ScoreBreakdownCard({ aptScore }: { aptScore: ScoredApartment }) {
  const { breakdown, metrics } = aptScore;
  const items: { label: string; sub: string; value: number; raw: string }[] = [
    {
      label: "חיסכון",
      sub: "מחיר הגרלה מול שוק חופשי",
      value: breakdown.discount,
      raw: formatPercent(metrics.discountFraction, 1),
    },
    {
      label: "תשואה ריאלית",
      sub: "תשואה שנתית A על ההון העצמי",
      value: breakdown.realReturn,
      raw: formatPercent(metrics.annualReturnPct, 1),
    },
    {
      label: "תשואת שכ״ד",
      sub: "שכ״ד שנתי / שווי שוק",
      value: breakdown.rentalYield,
      raw: formatPercent(metrics.rentalYieldGross, 1),
    },
    {
      label: "סיכוי זכייה",
      sub: "דירות / נרשמים",
      value: breakdown.winProbability,
      raw: formatPercent(metrics.winProbability, 2),
    },
    {
      label: "הון נדרש",
      sub: "כמה הון עצמי",
      value: breakdown.equityBurden,
      raw: formatShekels(metrics.requiredEquity),
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>פירוט הציון</CardTitle>
        <p className="text-sm text-muted-foreground">
          כל גורם בסולם 0-100, משוקלל לציון הסופי.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((it) => (
            <div key={it.label} className="rounded-md border p-3 space-y-1">
              <div className="text-xs text-muted-foreground">{it.label}</div>
              <div className="font-semibold tabular-nums">{it.raw}</div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${it.value}%` }}
                />
              </div>
              <div className="text-[11px] text-muted-foreground">{it.sub}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
