import * as React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { SliderInput } from "@/components/SliderInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatShekels } from "@/lib/format";
import {
  computeOneTimeCosts,
  computePurchaseTax,
  legalHoldingMonthsAfterHandover,
  LOCKUP_YEARS_FROM_HANDOVER,
  LOCKUP_YEARS_FROM_RAFFLE,
  purchaseTaxEffectiveRate,
} from "@/lib/simulation";
import type {
  SimulationInputs,
  ConstructionMode,
} from "@/lib/simulation";

interface InputsPanelProps {
  inputs: SimulationInputs;
  setInputs: React.Dispatch<React.SetStateAction<SimulationInputs>>;
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between p-4 text-start"
          >
            <span className="font-semibold">{title}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                open ? "rotate-180" : "",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-5 pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function InputsPanel({ inputs, setInputs }: InputsPanelProps) {
  const set = <K extends keyof SimulationInputs>(
    key: K,
    value: SimulationInputs[K],
  ) => setInputs((p) => ({ ...p, [key]: value }));

  // Effective equity used downstream (matches the logic in App.tsx).
  const effectiveEquity = inputs.equityAsPercent
    ? inputs.purchasePrice * inputs.equityPercent
    : Math.min(inputs.equity, inputs.purchasePrice);

  return (
    <div className="space-y-4">
      <Section title="הדירה">
        <SliderInput
          label="מחיר רכישה (מחיר מטרה)"
          value={inputs.purchasePrice}
          onChange={(n) => set("purchasePrice", n)}
          min={500_000}
          max={5_000_000}
          step={50_000}
          unit="₪"
        />
        <SliderInput
          label="מחיר שוק נוכחי"
          value={inputs.marketPrice}
          onChange={(n) => set("marketPrice", n)}
          min={500_000}
          max={6_000_000}
          step={50_000}
          unit="₪"
        />
        <SliderInput
          label="עליית ערך שנתית"
          value={inputs.appreciation}
          onChange={(n) => set("appreciation", n)}
          min={-0.05}
          max={0.1}
          step={0.001}
          asPercent
          helper="ערך שלילי = ירידת ערך שנתית"
        />
        <HoldingPeriodRow constructionMonths={inputs.constructionMonths} />
      </Section>

      <Section title="שלב הבנייה">
        <SliderInput
          label="חודשים עד מסירה"
          value={inputs.constructionMonths}
          onChange={(n) => set("constructionMonths", n)}
          min={0}
          max={60}
          step={1}
          unit="months"
          helper="0 = מסירה מיידית"
        />
        <SliderInput
          label="אחוז ששולם בחתימה"
          value={inputs.signingPct}
          onChange={(n) => set("signingPct", n)}
          min={0.05}
          max={0.5}
          step={0.01}
          asPercent
        />
        <div className="space-y-2">
          <Label>אופן תשלום משכנתא בזמן הבנייה</Label>
          <Select
            value={inputs.constructionMode}
            onValueChange={(v) =>
              set("constructionMode", v as ConstructionMode)
            }
          >
            <SelectTrigger dir="rtl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="interest_only">
                ריבית בלבד על היתרה שנמשכה
              </SelectItem>
              <SelectItem value="full_grace">
                גרייס מלא — ריבית נצברת ליתרה
              </SelectItem>
              <SelectItem value="interest_principal">
                ריבית + קרן על היתרה שנמשכה
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      <Section title="המשכנתא (אחרי המסירה)">
        <div className="rounded-md border border-dashed border-border p-3 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-primary"
              checked={inputs.equityAsPercent}
              onChange={(e) => set("equityAsPercent", e.target.checked)}
            />
            <span className="text-sm font-medium">
              חשב הון עצמי כאחוז ממחיר הרכישה
            </span>
          </label>

          {inputs.equityAsPercent ? (
            <>
              <SliderInput
                label="הון עצמי (% ממחיר הרכישה)"
                value={inputs.equityPercent}
                onChange={(n) => set("equityPercent", n)}
                min={0.10}
                max={1.0}
                step={0.01}
                asPercent
              />
              <div className="rounded bg-muted/60 px-3 py-2 text-sm flex items-center justify-between">
                <span className="text-muted-foreground">סכום הון עצמי:</span>
                <span className="font-semibold tabular-nums">
                  {formatShekels(inputs.purchasePrice * inputs.equityPercent)}
                </span>
              </div>
            </>
          ) : (
            <>
              <SliderInput
                label="הון עצמי (מקדמה)"
                value={inputs.equity}
                onChange={(n) => set("equity", n)}
                min={50_000}
                max={inputs.purchasePrice}
                step={10_000}
                unit="₪"
              />
              <div className="rounded bg-muted/60 px-3 py-2 text-sm flex items-center justify-between">
                <span className="text-muted-foreground">אחוז ממחיר הרכישה:</span>
                <span className="font-semibold tabular-nums">
                  {inputs.purchasePrice > 0
                    ? `${((inputs.equity / inputs.purchasePrice) * 100).toFixed(1)}%`
                    : "—"}
                </span>
              </div>
            </>
          )}
        </div>
        {(() => {
          const oneTimeCosts = computeOneTimeCosts(inputs);
          const remainingApt = Math.max(0, inputs.purchasePrice - effectiveEquity);
          const mortgageAmt = remainingApt + oneTimeCosts;
          const baseTotal = inputs.purchasePrice + oneTimeCosts;
          const equityPct =
            baseTotal > 0 ? (effectiveEquity / baseTotal) * 100 : 0;
          const mortgagePct =
            baseTotal > 0 ? (mortgageAmt / baseTotal) * 100 : 0;
          return (
            <div className="rounded-md border border-dashed border-border p-3 bg-muted/30 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">סכום המשכנתא (מחושב)</span>
                <span className="text-lg font-semibold tabular-nums">
                  {formatShekels(mortgageAmt)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between tabular-nums">
                  <span>מחיר רכישה</span>
                  <span>{formatShekels(inputs.purchasePrice)}</span>
                </div>
                <div className="flex justify-between tabular-nums">
                  <span>פחות הון עצמי</span>
                  <span>−{formatShekels(effectiveEquity)}</span>
                </div>
                <div className="flex justify-between tabular-nums">
                  <span>פלוס עלויות חד-פעמיות</span>
                  <span>+{formatShekels(oneTimeCosts)}</span>
                </div>
                <div className="mt-1 border-t pt-1.5 space-y-1">
                  <div className="flex justify-between tabular-nums items-center">
                    <span>הון עצמי</span>
                    <span className="flex items-center gap-2">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                        {equityPct.toFixed(1)}%
                      </span>
                      <span>{formatShekels(effectiveEquity)}</span>
                    </span>
                  </div>
                  <div className="flex justify-between tabular-nums items-center">
                    <span>משכנתא</span>
                    <span className="flex items-center gap-2">
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                        {mortgagePct.toFixed(1)}%
                      </span>
                      <span>{formatShekels(mortgageAmt)}</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="flex h-full w-full">
                  <div
                    className="bg-primary"
                    style={{ width: `${equityPct}%` }}
                    title={`הון עצמי ${equityPct.toFixed(1)}%`}
                  />
                  <div
                    className="bg-amber-500"
                    style={{ width: `${mortgagePct}%` }}
                    title={`משכנתא ${mortgagePct.toFixed(1)}%`}
                  />
                </div>
              </div>
            </div>
          );
        })()}
        <SliderInput
          label="תקופה (שנים)"
          value={inputs.termYears}
          onChange={(n) => set("termYears", n)}
          min={5}
          max={30}
          step={1}
          unit="years"
        />
        <SliderInput
          label="ריבית שנתית"
          value={inputs.mortgageRate}
          onChange={(n) => set("mortgageRate", n)}
          min={0}
          max={0.1}
          step={0.001}
          asPercent
        />
      </Section>

      <Section title="עלויות חד-פעמיות" defaultOpen={false}>
        <PercentCostRow
          label="מדד תשומות הבנייה"
          value={inputs.madadPercent}
          onChange={(n) => set("madadPercent", n)}
          purchasePrice={inputs.purchasePrice}
          min={0}
          max={0.15}
          step={0.001}
          helper="ברירת מחדל 4%: ממוצע מצטבר על תקופת בנייה של ~24 חודש"
        />
        <PurchaseTaxRow
          purchasePrice={inputs.purchasePrice}
          isSingleResidence={inputs.isSingleResidence}
          onToggle={(v) => set("isSingleResidence", v)}
        />
        <PercentCostRow
          label="עו״ד"
          value={inputs.legalFeesPercent}
          onChange={(n) => set("legalFeesPercent", n)}
          purchasePrice={inputs.purchasePrice}
          min={0}
          max={0.03}
          step={0.001}
          helper="שכ״ט עו״ד טיפוסי: 0.5%-1.5%"
        />
        <SliderInput
          label="שדרוגים"
          value={inputs.upgrades}
          onChange={(n) => set("upgrades", n)}
          min={0}
          max={300_000}
          step={5_000}
          unit="₪"
        />
        <SliderInput
          label="ריהוט"
          value={inputs.furniture}
          onChange={(n) => set("furniture", n)}
          min={0}
          max={200_000}
          step={5_000}
          unit="₪"
        />
        <CostsTotalRow inputs={inputs} />
      </Section>

      <Section title="הוצאות חודשיות אחרי המסירה" defaultOpen={false}>
        <SliderInput
          label="ביטוח (מבנה + חיים)"
          value={inputs.insurance}
          onChange={(n) => set("insurance", n)}
          min={0}
          max={1000}
          step={25}
          unit="₪"
        />
        <SliderInput
          label="ועד בית / תחזוקה"
          value={inputs.hoa}
          onChange={(n) => set("hoa", n)}
          min={0}
          max={2000}
          step={25}
          unit="₪"
        />
      </Section>

      <Section title="שכירות">
        <SliderInput
          label="שכר דירה נוכחי (משולם בכל התרחישים בזמן הבנייה)"
          value={inputs.currentRent}
          onChange={(n) => set("currentRent", n)}
          min={2000}
          max={20000}
          step={100}
          unit="₪"
        />
        <SliderInput
          label="עליית שכר דירה שנתית"
          value={inputs.rentGrowth}
          onChange={(n) => set("rentGrowth", n)}
          min={0}
          max={0.1}
          step={0.001}
          asPercent
        />
        <div className="rounded-md border border-dashed border-border p-3 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-primary"
              checked={inputs.rentalIncomeAsPercent}
              onChange={(e) =>
                set("rentalIncomeAsPercent", e.target.checked)
              }
            />
            <span className="text-sm font-medium">
              חשב הכנסה משכירות כאחוז משווי הדירה
            </span>
          </label>

          {inputs.rentalIncomeAsPercent ? (
            <>
              <SliderInput
                label="תשואה שנתית משכירות (% משווי הדירה)"
                value={inputs.rentalIncomePercent}
                onChange={(n) => set("rentalIncomePercent", n)}
                min={0.01}
                max={0.10}
                step={0.001}
                asPercent
              />
              <div className="rounded bg-muted/60 px-3 py-2 text-sm flex items-center justify-between">
                <span className="text-muted-foreground">
                  שכר דירה חודשי (לפי שווי נוכחי {formatShekels(inputs.marketPrice)}):
                </span>
                <span className="font-semibold tabular-nums">
                  {formatShekels(
                    (inputs.marketPrice * inputs.rentalIncomePercent) / 12,
                  )}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                החישוב נעשה חודש-בחודש על שווי הדירה המתעדכן עם עליית הערך
                — לכן עליית שכר הדירה השנתית לא מוחלת בנוסף.
              </p>
            </>
          ) : (
            <SliderInput
              label="הכנסה משכירות (תרחיש B אחרי המסירה)"
              value={inputs.rentalIncome}
              onChange={(n) => set("rentalIncome", n)}
              min={2000}
              max={20000}
              step={100}
              unit="₪"
            />
          )}
        </div>

        <SliderInput
          label="חודשי וקאנסי בשנה"
          value={inputs.vacancyMonths}
          onChange={(n) => set("vacancyMonths", n)}
          min={0}
          max={6}
          step={0.5}
          unit="months"
        />
      </Section>

      <Section title="מס שבח (דירה)" defaultOpen={false}>
        <SliderInput
          label="שיעור מס על הרווח"
          value={inputs.taxRate}
          onChange={(n) => set("taxRate", n)}
          min={0}
          max={0.5}
          step={0.01}
          asPercent
        />
        <div className="flex items-center justify-between">
          <Label htmlFor="exemption-switch">פטור דירה יחידה</Label>
          <Switch
            id="exemption-switch"
            checked={inputs.exemption}
            onCheckedChange={(v) => set("exemption", v)}
          />
        </div>
      </Section>

      <Section title="מס על שכ״ד (תרחיש B)" defaultOpen={false}>
        <div className="flex items-center justify-between">
          <Label htmlFor="rental-tax-switch">הפעל מס על דמי שכירות</Label>
          <Switch
            id="rental-tax-switch"
            checked={inputs.rentalTaxEnabled}
            onCheckedChange={(v) => set("rentalTaxEnabled", v)}
          />
        </div>
        {inputs.rentalTaxEnabled ? (
          <>
            <SliderInput
              label="שיעור מס על הכנסה משכירות"
              value={inputs.rentalTaxRate}
              onChange={(n) => set("rentalTaxRate", n)}
              min={0}
              max={0.5}
              step={0.01}
              asPercent
              helper="ברירת מחדל: 10% (מסלול 10%)"
            />
            <SliderInput
              label="פטור חודשי (סף חיוב במס)"
              value={inputs.rentalTaxExemption}
              onChange={(n) => set("rentalTaxExemption", n)}
              min={0}
              max={10_000}
              step={100}
              unit="₪"
              helper="2024: ~5,654 ₪ במסלול הפטור"
            />
          </>
        ) : null}
      </Section>

      <Section title="מס רווח הון על S&P (תרחישים B + C)" defaultOpen={false}>
        <div className="flex items-center justify-between">
          <Label htmlFor="sp500-tax-switch">הפעל מס רווח הון</Label>
          <Switch
            id="sp500-tax-switch"
            checked={inputs.sp500TaxEnabled}
            onCheckedChange={(v) => set("sp500TaxEnabled", v)}
          />
        </div>
        {inputs.sp500TaxEnabled ? (
          <>
            <SliderInput
              label="שיעור מס רווח הון"
              value={inputs.sp500TaxRate}
              onChange={(n) => set("sp500TaxRate", n)}
              min={0}
              max={0.5}
              step={0.01}
              asPercent
              helper="ברירת מחדל: 25% (ישראל, על רווח ריאלי)"
            />
            <SliderInput
              label="אינפלציה שנתית (להצמדת בסיס המס)"
              value={inputs.inflation}
              onChange={(n) => set("inflation", n)}
              min={0}
              max={0.15}
              step={0.001}
              asPercent
              helper="25 שנים: ~2-3% · 10 שנים: ~1.5% · 50 שנה: ~7-10% (כולל משבר אינפלציוני)"
            />
            <div className="rounded bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              המס מחושב על הרווח <span className="font-medium text-foreground">הריאלי</span>:
              שווי תיק פחות הסכום שהושקע מוצמד למדד. אם האינפלציה גבוהה, חלק
              גדול יותר מהתשואה מוגן מהמס.
            </div>
          </>
        ) : null}
      </Section>

      <Section title="S&P 500">
        <SliderInput
          label="תשואה שנתית ממוצעת"
          value={inputs.sp500Return}
          onChange={(n) => set("sp500Return", n)}
          min={0}
          max={0.2}
          step={0.005}
          asPercent
        />
      </Section>
    </div>
  );
}

interface PercentCostRowProps {
  label: string;
  value: number;
  onChange: (n: number) => void;
  purchasePrice: number;
  min: number;
  max: number;
  step: number;
  helper?: string;
}

function PercentCostRow({
  label,
  value,
  onChange,
  purchasePrice,
  min,
  max,
  step,
  helper,
}: PercentCostRowProps) {
  return (
    <div className="space-y-1.5">
      <SliderInput
        label={label}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        asPercent
        helper={helper}
      />
      <div className="flex items-center justify-between rounded bg-muted/60 px-3 py-1.5 text-xs">
        <span className="text-muted-foreground">סכום מחושב:</span>
        <span className="font-medium tabular-nums">
          {formatShekels(purchasePrice * value)}
        </span>
      </div>
    </div>
  );
}

function CostsTotalRow({ inputs }: { inputs: SimulationInputs }) {
  const total = computeOneTimeCosts(inputs);
  return (
    <div className="rounded-md border border-dashed border-primary/50 bg-primary/5 p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">סך עלויות חד-פעמיות</span>
        <span className="text-lg font-semibold tabular-nums">
          {formatShekels(total)}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        הסכום הזה ממומן בתוך המשכנתא (מוסיף ליתרת ההלוואה ולתשלום החודשי).
        תרחישים A ו-B מרגישים את ההשפעה כתשלום שפיצר גבוה יותר; תרחיש C
        חוסך את ההפרש ומשקיע אותו ב-S&P.
      </p>
    </div>
  );
}

interface PurchaseTaxRowProps {
  purchasePrice: number;
  isSingleResidence: boolean;
  onToggle: (v: boolean) => void;
}

function PurchaseTaxRow({
  purchasePrice,
  isSingleResidence,
  onToggle,
}: PurchaseTaxRowProps) {
  const tax = computePurchaseTax(purchasePrice, isSingleResidence);
  const effectiveRate = purchaseTaxEffectiveRate(
    purchasePrice,
    isSingleResidence,
  );
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">מס רכישה (חישוב לפי מדרגות)</Label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onToggle(true)}
          className={`rounded-md border px-3 py-2 text-xs text-center transition-colors ${
            isSingleResidence
              ? "border-primary bg-primary/10 font-medium text-primary"
              : "border-input bg-background text-muted-foreground hover:bg-accent"
          }`}
        >
          דירה יחידה
        </button>
        <button
          type="button"
          onClick={() => onToggle(false)}
          className={`rounded-md border px-3 py-2 text-xs text-center transition-colors ${
            !isSingleResidence
              ? "border-primary bg-primary/10 font-medium text-primary"
              : "border-input bg-background text-muted-foreground hover:bg-accent"
          }`}
        >
          דירה נוספת / משקיע
        </button>
      </div>
      <div className="flex items-center justify-between rounded bg-muted/60 px-3 py-1.5 text-xs">
        <span className="text-muted-foreground">
          סכום מחושב (שיעור אפקטיבי {(effectiveRate * 100).toFixed(2)}%):
        </span>
        <span className="font-medium tabular-nums">{formatShekels(tax)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        מדרגות לפי החוק (2024-2025). מתעדכן אחת לשנה לפי המדד — לעדכון יש לערוך
        את הקבועים ב-<code className="font-mono text-[10px]">simulation.ts</code>.
      </p>
    </div>
  );
}

function HoldingPeriodRow({
  constructionMonths,
}: {
  constructionMonths: number;
}) {
  const holdingMonths = legalHoldingMonthsAfterHandover(constructionMonths);
  const yearsFromRaffle = LOCKUP_YEARS_FROM_RAFFLE * 12;
  const yearsFromHandover = LOCKUP_YEARS_FROM_HANDOVER * 12;
  const raffleBinding =
    yearsFromRaffle - constructionMonths <= yearsFromHandover;

  const yearsLabel = (holdingMonths / 12).toFixed(
    holdingMonths % 12 === 0 ? 0 : 1,
  );

  return (
    <div className="space-y-2">
      <Label className="text-sm">תקופת החזקה אחרי המסירה (מחושב)</Label>
      <div className="rounded-md border border-dashed border-primary/50 bg-primary/5 p-3 space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm">המוקדם בין שתי החסימות:</span>
          <span className="text-lg font-semibold tabular-nums">
            {yearsLabel} שנים ({holdingMonths} חודשים)
          </span>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between items-center">
            <span>7 שנים מהגרלה</span>
            <span className="flex items-center gap-2 tabular-nums">
              {raffleBinding ? (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                  קובע
                </span>
              ) : null}
              <span>
                {yearsFromRaffle - constructionMonths} חודשים אחרי מסירה
              </span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>5 שנים ממסירה</span>
            <span className="flex items-center gap-2 tabular-nums">
              {!raffleBinding ? (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                  קובע
                </span>
              ) : null}
              <span>{yearsFromHandover} חודשים אחרי מסירה</span>
            </span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground border-t pt-2">
          לפי תקנון מחיר מטרה: ״לא ניתן למכור לפני שעברו 7 שנים מהגרלה או 5
          שנים מקבלת חזקה — המוקדם מבין השניים״. בנייה ארוכה יותר מקצרת את
          תקופת ההחזקה אחרי המסירה.
        </p>
      </div>
    </div>
  );
}
