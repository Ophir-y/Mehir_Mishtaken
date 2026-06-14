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

interface PostHandoverTableProps {
  result: SimulationResult;
}

export function PostHandoverTable({ result }: PostHandoverTableProps) {
  const [open, setOpen] = React.useState(false);
  const rows = result.monthly.filter((r) => r.phase === "post");
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
              פירוט אחרי המסירה ({rows.length} חודשים)
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
                  <TableHead className="text-end">שנה</TableHead>
                  <TableHead className="text-end">תשלום משכנתא</TableHead>
                  <TableHead className="text-end">ריבית</TableHead>
                  <TableHead className="text-end">קרן</TableHead>
                  <TableHead className="text-end">יתרת קרן</TableHead>
                  <TableHead className="text-end">שכ״ד משולם</TableHead>
                  <TableHead className="text-end">הכנסה משכ״ד</TableHead>
                  <TableHead className="text-end">שווי דירה</TableHead>
                  <TableHead className="text-end">הון בנכס</TableHead>
                  <TableHead className="text-end">מס שבח</TableHead>
                  <TableHead className="text-end">הון נטו A</TableHead>
                  <TableHead className="text-end">הון נטו B</TableHead>
                  <TableHead className="text-end">הון נטו C</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.month}>
                    <TableCell className="font-medium">{r.month}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.year}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatShekels(r.mortgagePayment)}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatShekels(r.interestPaid)}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatShekels(r.principalPaid)}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatShekels(r.remainingBalance)}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatShekels(r.rentPaid)}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatShekels(r.rentalIncome)}
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground">
                      {formatShekels(r.propertyValue)}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatShekels(r.homeEquity)}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatShekels(r.masShevach)}
                    </TableCell>
                    <TableCell className="text-end font-medium">
                      {formatShekels(r.netWorthA)}
                    </TableCell>
                    <TableCell className="text-end font-medium">
                      {formatShekels(r.netWorthB)}
                    </TableCell>
                    <TableCell className="text-end font-medium">
                      {formatShekels(r.netWorthC)}
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
