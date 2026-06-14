import * as React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShekels, formatShekelsCompact } from "@/lib/format";
import type { SimulationResult } from "@/lib/simulation";

interface ChartViewProps {
  result: SimulationResult;
}

interface ChartPoint {
  month: number;
  year: number;
  A: number;
  B: number;
  C: number;
}

const COLORS = {
  A: "#2563eb",
  B: "#059669",
  C: "#d97706",
};

export function ChartView({ result }: ChartViewProps) {
  const data = React.useMemo<ChartPoint[]>(
    () =>
      result.monthly.map((r) => ({
        month: r.month,
        year: r.year,
        A: Math.round(r.netWorthA),
        B: Math.round(r.netWorthB),
        C: Math.round(r.netWorthC),
      })),
    [result],
  );

  if (data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>גרף — הון נטו לאורך זמן</CardTitle>
        <p className="text-sm text-muted-foreground">
          הקו האנכי מסמן את חודש המסירה. ציר ה-X בחודשים מתחילת החתימה.
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[420px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 16, right: 24, left: 8, bottom: 16 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                tickFormatter={(m) =>
                  m % 12 === 0 ? `שנה ${m / 12}` : ""
                }
                label={{
                  value: "חודשים מתחילת התהליך",
                  position: "insideBottom",
                  offset: -8,
                  style: { fontSize: 12 },
                }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => formatShekelsCompact(v as number)}
                width={88}
              />
              <Tooltip
                formatter={(value: number, name) => [
                  formatShekels(value),
                  String(name),
                ]}
                labelFormatter={(m) =>
                  `חודש ${m} (שנה ${Math.ceil(Number(m) / 12)})`
                }
                contentStyle={{ direction: "rtl" }}
              />
              <Legend
                wrapperStyle={{ direction: "rtl", paddingTop: 8 }}
                formatter={(value) => {
                  const map: Record<string, string> = {
                    A: "A – קונה וגר",
                    B: "B – קונה ומשכיר",
                    C: "C – משקיע ב-S&P",
                  };
                  return map[value] ?? value;
                }}
              />
              {result.summary.handoverMonth > 0 ? (
                <ReferenceLine
                  x={result.summary.handoverMonth}
                  stroke="#64748b"
                  strokeDasharray="4 4"
                  label={{
                    value: "מסירה",
                    position: "top",
                    fill: "#64748b",
                    fontSize: 11,
                  }}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="A"
                stroke={COLORS.A}
                dot={false}
                strokeWidth={2.5}
              />
              <Line
                type="monotone"
                dataKey="B"
                stroke={COLORS.B}
                dot={false}
                strokeWidth={2.5}
              />
              <Line
                type="monotone"
                dataKey="C"
                stroke={COLORS.C}
                dot={false}
                strokeWidth={2.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
