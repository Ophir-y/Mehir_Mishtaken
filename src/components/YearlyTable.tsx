import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatShekels } from "@/lib/format";
import type { SimulationResult } from "@/lib/simulation";
import { cn } from "@/lib/utils";

interface YearlyTableProps {
  result: SimulationResult;
}

export function YearlyTable({ result }: YearlyTableProps) {
  const handoverYear = Math.ceil(result.summary.handoverMonth / 12);

  return (
    <Card>
      <CardHeader>
        <CardTitle>טבלת סיכום שנתית</CardTitle>
        <p className="text-sm text-muted-foreground">
          הון נטו בסוף כל שנה. הפס המודגש מסמן את שנת המסירה.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-end">שנה</TableHead>
              <TableHead className="text-end">שלב</TableHead>
              <TableHead className="text-end">A – קונה וגר</TableHead>
              <TableHead className="text-end">B – קונה ומשכיר</TableHead>
              <TableHead className="text-end">C – משקיע ב-S&P</TableHead>
              <TableHead className="text-end">שווי דירה</TableHead>
              <TableHead className="text-end">יתרת משכנתא</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.yearly.map((row) => {
              const isHandover = row.year === handoverYear;
              return (
                <TableRow
                  key={row.year}
                  className={cn(
                    isHandover &&
                      "border-b-4 border-primary/40 bg-primary/5",
                  )}
                >
                  <TableCell className="font-medium">{row.year}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.phase === "construction"
                      ? "בנייה"
                      : row.phase === "post"
                        ? "אחרי מסירה"
                        : "מעורב"}
                  </TableCell>
                  <TableCell className="text-end">
                    {formatShekels(row.netWorthA)}
                  </TableCell>
                  <TableCell className="text-end">
                    {formatShekels(row.netWorthB)}
                  </TableCell>
                  <TableCell className="text-end">
                    {formatShekels(row.netWorthC)}
                  </TableCell>
                  <TableCell className="text-end text-muted-foreground">
                    {formatShekels(row.propertyValue)}
                  </TableCell>
                  <TableCell className="text-end text-muted-foreground">
                    {formatShekels(row.remainingBalance)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
