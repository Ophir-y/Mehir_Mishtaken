import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShekels, formatShekelsCompact } from "@/lib/format";
import type { SimulationResult } from "@/lib/simulation";
import { cn } from "@/lib/utils";

const SCENARIO_LABEL: Record<"A" | "B" | "C", string> = {
  A: "A – קונה וגר",
  B: "B – קונה ומשכיר",
  C: "C – לא קונה, משקיע ב-S&P",
};

const SCENARIO_COLOR: Record<"A" | "B" | "C", string> = {
  A: "text-blue-600 dark:text-blue-400",
  B: "text-emerald-600 dark:text-emerald-400",
  C: "text-amber-600 dark:text-amber-500",
};

interface SummaryCardProps {
  result: SimulationResult;
}

export function SummaryCard({ result }: SummaryCardProps) {
  const { summary } = result;
  const { winner, finalA, finalB, finalC, gapBvsA, gapCvsA, breakevenMonthCvsA } =
    summary;

  return (
    <Card>
      <CardHeader>
        <CardTitle>סיכום סופי</CardTitle>
        <p className="text-sm text-muted-foreground">
          הון נטו בסוף התקופה ({summary.totalMonths} חודשים סך הכל,{" "}
          {summary.handoverMonth} חודשי בנייה)
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <ScenarioBox
            label={SCENARIO_LABEL.A}
            value={finalA}
            color={SCENARIO_COLOR.A}
            isWinner={winner === "A"}
          />
          <ScenarioBox
            label={SCENARIO_LABEL.B}
            value={finalB}
            color={SCENARIO_COLOR.B}
            isWinner={winner === "B"}
            note={
              gapBvsA === 0
                ? null
                : `${gapBvsA > 0 ? "+" : ""}${formatShekelsCompact(gapBvsA)} מול A`
            }
          />
          <ScenarioBox
            label={SCENARIO_LABEL.C}
            value={finalC}
            color={SCENARIO_COLOR.C}
            isWinner={winner === "C"}
            note={
              gapCvsA === 0
                ? null
                : `${gapCvsA > 0 ? "+" : ""}${formatShekelsCompact(gapCvsA)} מול A`
            }
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-md bg-muted/50 p-3 text-sm">
          <span className="font-medium">תרחיש מנצח:</span>
          <span className={cn("font-semibold", SCENARIO_COLOR[winner])}>
            {SCENARIO_LABEL[winner]}
          </span>
          {breakevenMonthCvsA !== null ? (
            <span className="text-muted-foreground">
              • נקודת איזון C מול A: חודש {breakevenMonthCvsA} (שנה{" "}
              {Math.ceil(breakevenMonthCvsA / 12)})
            </span>
          ) : (
            <span className="text-muted-foreground">
              • C לא עוקף את A בטווח שהוגדר
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ScenarioBox({
  label,
  value,
  color,
  isWinner,
  note,
}: {
  label: string;
  value: number;
  color: string;
  isWinner: boolean;
  note?: string | null;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        isWinner ? "border-primary ring-1 ring-primary" : "",
      )}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold tabular-nums", color)}>
        {formatShekels(value)}
      </div>
      {note ? (
        <div className="mt-1 text-xs text-muted-foreground tabular-nums">
          {note}
        </div>
      ) : null}
      {isWinner ? (
        <div className="mt-2 inline-block rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          מנצח
        </div>
      ) : null}
    </div>
  );
}
