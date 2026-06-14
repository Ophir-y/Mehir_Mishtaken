import * as React from "react";
import {
  defaultInputs,
  defaultRentalIncome,
  deriveInputs,
  runSimulation,
  type SimulationInputs,
} from "@/lib/simulation";
import { InputsPanel } from "@/components/InputsPanel";
import { SummaryCard } from "@/components/SummaryCard";
import { ChartView } from "@/components/ChartView";
import { YearlyTable } from "@/components/YearlyTable";
import { ConstructionTable } from "@/components/ConstructionTable";
import { PostHandoverTable } from "@/components/PostHandoverTable";
import { ExplanationsPanel } from "@/components/ExplanationsPanel";

export function SandboxPage() {
  const [inputs, setInputs] = React.useState<SimulationInputs>(() => {
    const base = { ...defaultInputs };
    base.rentalIncome = defaultRentalIncome(base);
    base.mortgageAmount = base.purchasePrice - base.equity;
    return base;
  });

  const computedInputs = React.useMemo(() => deriveInputs(inputs), [inputs]);
  const result = React.useMemo(
    () => runSimulation(computedInputs),
    [computedInputs],
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-[420px_1fr] lg:items-start">
        <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pe-2">
          <InputsPanel inputs={inputs} setInputs={setInputs} />
        </aside>

        <div className="space-y-6">
          <SummaryCard result={result} />
          <ChartView result={result} />
          <YearlyTable result={result} />
          <ConstructionTable result={result} />
          <PostHandoverTable result={result} />
          <ExplanationsPanel />
        </div>
      </div>
    </main>
  );
}
