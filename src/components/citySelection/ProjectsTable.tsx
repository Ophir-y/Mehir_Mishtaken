import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";
import type { ScoredApartment, ScoredProject } from "@/lib/types";
import { ScoreBadge } from "@/components/citySelection/ScoreBadge";
import { DeadlineChip } from "@/components/citySelection/DeadlineChip";
import { daysUntilClose } from "@/lib/projectFilters";

type SortKey =
  | "score"
  | "savingsPct"
  | "winProb"
  | "annualReturn"
  | "rentalYield"
  | "listPerSqm"
  | "lotteryPerSqm"
  | "marketPerSqm"
  | "deadline";

interface ProjectsTableProps {
  projects: ScoredProject[];
  selectedCities: string[];
  highlightOnlySelected: boolean;
  /** Called when the user clicks a row to open the detail modal. */
  onSelectApartment: (projectId: string) => void;
}

interface Row {
  scored: ScoredProject;
  apt: ScoredApartment;
}

const sqmFmt = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
function formatPerSqm(n: number): string {
  return `${sqmFmt.format(Math.round(n))} ₪/מ״ר`;
}

export function ProjectsTable({
  projects,
  selectedCities,
  highlightOnlySelected,
  onSelectApartment,
}: ProjectsTableProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>("score");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const allRows: Row[] = React.useMemo(() => {
    const rows: Row[] = [];
    for (const p of projects) {
      for (const apt of p.apartments) {
        rows.push({ scored: p, apt });
      }
    }
    return rows;
  }, [projects]);

  const rows: Row[] = React.useMemo(() => {
    const filtered =
      highlightOnlySelected && selectedCities.length > 0
        ? allRows.filter((r) => selectedCities.includes(r.scored.project.city))
        : allRows;
    const sorted = [...filtered].sort((a, b) => {
      const va = readKey(a, sortKey);
      const vb = readKey(b, sortKey);
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return sorted;
  }, [allRows, sortKey, sortDir, highlightOnlySelected, selectedCities]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      // Lower-is-better defaults to ascending; higher-is-better to descending.
      setSortDir(
        key === "deadline" || key === "lotteryPerSqm" || key === "listPerSqm"
          ? "asc"
          : "desc",
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>טבלת השוואת הזדמנויות</CardTitle>
        <p className="text-sm text-muted-foreground">
          השוואה לכל מ״ר. לחצו על כותרת עמודה למיון. לחצו על שורה לפתיחת ניתוח
          מלא (סנדבוקס) — בניתוח המלא מניחים דירה של 95 מ״ר.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <Th label="עיר / פרויקט" />
              <SortableTh
                label="סגירת הרשמה"
                onClick={() => toggleSort("deadline")}
                active={sortKey === "deadline"}
                dir={sortDir}
              />
              <SortableTh
                label="מחירון ₪/מ״ר"
                onClick={() => toggleSort("listPerSqm")}
                active={sortKey === "listPerSqm"}
                dir={sortDir}
              />
              <SortableTh
                label="הגרלה ₪/מ״ר"
                onClick={() => toggleSort("lotteryPerSqm")}
                active={sortKey === "lotteryPerSqm"}
                dir={sortDir}
              />
              <SortableTh
                label="שוק חופשי (חדש) ₪/מ״ר"
                onClick={() => toggleSort("marketPerSqm")}
                active={sortKey === "marketPerSqm"}
                dir={sortDir}
              />
              <SortableTh
                label="חיסכון %"
                onClick={() => toggleSort("savingsPct")}
                active={sortKey === "savingsPct"}
                dir={sortDir}
              />
              <SortableTh
                label="תשואת שכ״ד"
                onClick={() => toggleSort("rentalYield")}
                active={sortKey === "rentalYield"}
                dir={sortDir}
              />
              <SortableTh
                label="תשואה שנתית"
                onClick={() => toggleSort("annualReturn")}
                active={sortKey === "annualReturn"}
                dir={sortDir}
              />
              <SortableTh
                label="סיכוי זכייה"
                onClick={() => toggleSort("winProb")}
                active={sortKey === "winProb"}
                dir={sortDir}
              />
              <SortableTh
                label="ציון"
                onClick={() => toggleSort("score")}
                active={sortKey === "score"}
                dir={sortDir}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ scored, apt }) => {
              const isCitySelected = selectedCities.includes(scored.project.city);
              const dim =
                selectedCities.length > 0 &&
                !isCitySelected &&
                !highlightOnlySelected;
              const info = scored.project.pricePerSqm;
              return (
                <TableRow
                  key={scored.project.id}
                  onClick={() => onSelectApartment(scored.project.id)}
                  className={cn(
                    "cursor-pointer",
                    dim && "opacity-50",
                    isCitySelected && "bg-primary/5",
                  )}
                >
                  <TableCell>
                    <div className="font-medium">{scored.project.city}</div>
                    <div className="text-xs text-muted-foreground">
                      {scored.project.projectName}
                    </div>
                  </TableCell>
                  <TableCell className="text-end">
                    <DeadlineChip project={scored.project} showDate />
                  </TableCell>
                  <TableCell className="text-end tabular-nums text-muted-foreground">
                    {info ? formatPerSqm(info.listPricePerSqm) : "—"}
                  </TableCell>
                  <TableCell className="text-end tabular-nums font-medium">
                    {info ? formatPerSqm(info.lotteryPricePerSqm) : "—"}
                    {info ? (
                      <div className="text-[10px] text-muted-foreground">
                        −{(info.discountPercent * 100).toFixed(0)}%
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-end tabular-nums text-muted-foreground">
                    {info ? formatPerSqm(info.marketPricePerSqm) : "—"}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {info ? (
                      <span
                        className={cn(
                          "font-semibold",
                          info.savingsPercent > 0.4
                            ? "text-emerald-600"
                            : info.savingsPercent > 0.2
                              ? "text-amber-600"
                              : "text-muted-foreground",
                        )}
                      >
                        {formatPercent(info.savingsPercent, 1)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatPercent(apt.metrics.rentalYieldGross, 1)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatPercent(apt.metrics.annualReturnPct, 1)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    <div>{formatPercent(apt.metrics.winProbability, 2)}</div>
                    <div className="text-xs text-muted-foreground">
                      {apt.apt.unitsOffered}/
                      {apt.apt.applicants ?? "?"}
                    </div>
                  </TableCell>
                  <TableCell className="text-end">
                    <ScoreBadge value={apt.score} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            אין שורות להצגה. נקו את הסינון או הוסיפו פרויקטים ל-seed JSON.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function readKey(row: Row, key: SortKey): number {
  const { apt, scored } = row;
  const info = scored.project.pricePerSqm;
  switch (key) {
    case "score":
      return apt.score;
    case "savingsPct":
      return info?.savingsPercent ?? 0;
    case "winProb":
      return apt.metrics.winProbability;
    case "annualReturn":
      return apt.metrics.annualReturnPct;
    case "rentalYield":
      return apt.metrics.rentalYieldGross;
    case "listPerSqm":
      return info?.listPricePerSqm ?? 0;
    case "lotteryPerSqm":
      return info?.lotteryPricePerSqm ?? 0;
    case "marketPerSqm":
      return info?.marketPricePerSqm ?? 0;
    case "deadline": {
      const d = daysUntilClose(scored.project);
      return d == null ? Number.POSITIVE_INFINITY : d;
    }
  }
}

function Th({ label, alignCenter }: { label: string; alignCenter?: boolean }) {
  return (
    <TableHead className={alignCenter ? "text-center" : "text-end"}>
      {label}
    </TableHead>
  );
}

function SortableTh({
  label,
  onClick,
  active,
  dir,
}: {
  label: string;
  onClick: () => void;
  active: boolean;
  dir: "asc" | "desc";
}) {
  return (
    <TableHead className="text-end">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          active ? "text-foreground font-medium" : "",
        )}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}
