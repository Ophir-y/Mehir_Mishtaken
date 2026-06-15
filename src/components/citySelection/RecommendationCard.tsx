import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent } from "@/lib/format";
import type { ScoredProject } from "@/lib/types";
import { ScoreBadge } from "@/components/citySelection/ScoreBadge";
import { DeadlineChip } from "@/components/citySelection/DeadlineChip";
import { Sparkles } from "lucide-react";

interface RecommendationCardProps {
  scored: ScoredProject[];
  selectedCities: string[];
  onOpenDetail: (projectId: string) => void;
}

export function RecommendationCard({
  scored,
  selectedCities,
  onOpenDetail,
}: RecommendationCardProps) {
  // Recommend top 3. Prefer projects in selected cities, then fill from rest.
  const inSelected = scored.filter((p) =>
    selectedCities.includes(p.project.city),
  );
  const others = scored.filter((p) => !selectedCities.includes(p.project.city));
  const recs = [...inSelected, ...others].slice(0, 3);

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle>שלוש ההמלצות הטובות ביותר</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          ציון משוקלל לפי הנחה, תשואה ריאלית, תשואת שכ״ד, סיכוי זכייה והון נדרש.
        </p>
      </CardHeader>
      <CardContent>
        {recs.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין נתונים להמליץ.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {recs.map((rec, i) => (
              <RecommendationBox
                key={rec.project.id}
                rank={i + 1}
                rec={rec}
                inSelected={selectedCities.includes(rec.project.city)}
                onOpen={() => onOpenDetail(rec.project.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecommendationBox({
  rank,
  rec,
  inSelected,
  onOpen,
}: {
  rank: number;
  rec: ScoredProject;
  inSelected: boolean;
  onOpen: () => void;
}) {
  const { project, best, score } = rec;
  const info = rec.effectivePricePerSqm ?? project.pricePerSqm;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-start rounded-lg border bg-card p-4 hover:border-primary transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">#{rank}</span>
        <ScoreBadge value={score} size="md" />
      </div>
      <div className="font-semibold leading-tight">{project.city}</div>
      <div className="text-sm text-muted-foreground">{project.projectName}</div>
      <div className="my-2">
        <DeadlineChip project={project} />
      </div>
      <div className="space-y-1 text-xs">
        <Row
          label="חיסכון מול שוק חופשי"
          value={info ? formatPercent(info.savingsPercent, 1) : "—"}
        />
        <Row
          label="מחיר הגרלה ₪/מ״ר"
          value={
            info
              ? `${Math.round(info.lotteryPricePerSqm).toLocaleString("he-IL")} ₪`
              : "—"
          }
        />
        <Row
          label="סיכוי זכייה"
          value={formatPercent(best.metrics.winProbability, 2)}
        />
        <Row
          label="תשואה שנתית (A)"
          value={formatPercent(best.metrics.annualReturnPct, 1)}
        />
      </div>
      {inSelected ? (
        <div className="mt-3 inline-block text-[10px] font-medium bg-primary/15 text-primary px-1.5 py-0.5 rounded">
          עיר נבחרת
        </div>
      ) : null}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between tabular-nums">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
