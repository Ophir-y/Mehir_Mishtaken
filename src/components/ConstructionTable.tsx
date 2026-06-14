import * as React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
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
import { formatShekels } from "@/lib/format";
import type { SimulationResult } from "@/lib/simulation";
import { cn } from "@/lib/utils";

interface ConstructionTableProps {
  result: SimulationResult;
}

export function ConstructionTable({ result }: ConstructionTableProps) {
  const [open, setOpen] = React.useState(false);
  const rows = result.monthly.filter((r) => r.phase === "construction");
  if (rows.length === 0) return null;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between p-4 text-start"
          >
            <CardTitle className="text-base">
              פירוט שלב הבנייה ({rows.length} חודשים)
            </CardTitle>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                open ? "rotate-180" : "",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-end">חודש</TableHead>
                  <TableHead className="text-end">תשלום קבלן</TableHead>
                  <TableHead className="text-end">עלויות חד-פעמיות</TableHead>
                  <TableHead className="text-end">הון עצמי שנוצל</TableHead>
                  <TableHead className="text-end">משכנתא נמשכה</TableHead>
                  <TableHead className="text-end">יתרה נמשכת</TableHead>
                  <TableHead className="text-end">ריבית שולמה</TableHead>
                  <TableHead className="text-end">שכ״ד</TableHead>
                  <TableHead className="text-end">שווי דירה</TableHead>
                  <TableHead className="text-end">הון בנכס</TableHead>
                  <TableHead className="text-end">הפקדה לC</TableHead>
                  <TableHead className="text-end">הפקדה לB</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.month}>
                    <TableCell className="font-medium">{r.month}</TableCell>
                    <TableCell className="text-end">
                      {formatShekels(r.contractorPayment)}
                    </TableCell>
                    <TableCell className="text-end">
                      {r.oneTimeCostsPaid > 0
                        ? formatShekels(r.oneTimeCostsPaid)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatShekels(r.equityUsed)}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatShekels(r.mortgageDrawn)}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatShekels(r.drawnBalance)}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatShekels(r.constructionInterestPaid)}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatShekels(r.rentPaid)}
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground">
                      {formatShekels(r.propertyValue)}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatShekels(r.homeEquity)}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatShekels(r.portfolioCDeposit)}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatShekels(r.portfolioBDeposit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
