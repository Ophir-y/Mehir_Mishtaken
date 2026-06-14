import * as React from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SliderInputUnit = "₪" | "%" | "months" | "years" | "";

export interface SliderInputProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: SliderInputUnit;
  /**
   * Format helper for display value when the input is NOT focused.
   * Defaults to a locale he-IL integer for ₪, fixed-decimal for %, and
   * raw number for the rest.
   */
  formatValue?: (n: number) => string;
  /** Show value as percentage (multiply/divide by 100 for display). */
  asPercent?: boolean;
  /** Helper text shown below the label. */
  helper?: string;
  disabled?: boolean;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function snapToStep(n: number, min: number, step: number): number {
  if (step <= 0) return n;
  const steps = Math.round((n - min) / step);
  return Math.min(Number.MAX_SAFE_INTEGER, min + steps * step);
}

function roundForStep(n: number, step: number): number {
  // Reduce floating point noise from snap math (e.g. 0.025 → 0.0250000001).
  if (step >= 1) return Math.round(n);
  const decimals = Math.max(
    0,
    -Math.floor(Math.log10(step)) + (step.toString().includes("5") ? 0 : 0),
  );
  // Up to 6 decimals is enough for our percent steps (0.001 = 0.1%).
  const d = Math.min(6, Math.max(decimals, 0));
  return Number(n.toFixed(d));
}

function defaultFormat(
  n: number,
  unit: SliderInputUnit,
  asPercent: boolean,
  step: number,
): string {
  if (asPercent) {
    const decimals = step < 0.01 ? 1 : 0;
    return `${(n * 100).toFixed(decimals)}%`;
  }
  if (unit === "₪") {
    return `${Math.round(n).toLocaleString("he-IL")} ₪`;
  }
  if (unit === "%") {
    return `${n}%`;
  }
  if (unit === "months") {
    const decimals = step < 1 ? 1 : 0;
    return `${n.toFixed(decimals)} חודשים`;
  }
  if (unit === "years") {
    return `${n} שנים`;
  }
  return `${n}`;
}

export function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit = "",
  formatValue,
  asPercent = false,
  helper,
  disabled,
}: SliderInputProps) {
  const id = React.useId();
  const [focused, setFocused] = React.useState(false);
  const [rawValue, setRawValue] = React.useState("");

  const displayedValue = asPercent ? value * 100 : value;
  const displayedMin = asPercent ? min * 100 : min;
  const displayedMax = asPercent ? max * 100 : max;
  const displayedStep = asPercent ? step * 100 : step;

  const formatted = React.useMemo(() => {
    if (formatValue) return formatValue(value);
    return defaultFormat(value, unit, asPercent, step);
  }, [value, unit, asPercent, formatValue, step]);

  function commitFromRaw(raw: string) {
    if (raw.trim() === "") {
      // empty → revert
      setRawValue("");
      return;
    }
    // Strip thousands separators and percent sign
    const cleaned = raw.replace(/[,\s₪%]/g, "").replace(/[^\d.\-]/g, "");
    const parsed = parseFloat(cleaned);
    if (!Number.isFinite(parsed)) {
      setRawValue("");
      return;
    }
    let internal = asPercent ? parsed / 100 : parsed;
    internal = clamp(internal, min, max);
    internal = snapToStep(internal, min, step);
    internal = roundForStep(internal, step);
    onChange(internal);
    setRawValue("");
  }

  function liveUpdate(raw: string) {
    setRawValue(raw);
    const cleaned = raw.replace(/[,\s₪%]/g, "").replace(/[^\d.\-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return;
    const parsed = parseFloat(cleaned);
    if (!Number.isFinite(parsed)) return;
    const internal = asPercent ? parsed / 100 : parsed;
    if (internal < min || internal > max) return; // wait for blur to clamp
    // Don't re-snap aggressively during typing; just commit raw if in-range.
    onChange(internal);
  }

  function handleSliderChange(values: number[]) {
    const v = values[0];
    if (v == null) return;
    let next = asPercent ? v / 100 : v;
    next = roundForStep(next, step);
    onChange(next);
  }

  const inputValue = focused
    ? rawValue !== ""
      ? rawValue
      : String(asPercent ? +(value * 100).toFixed(4) : value)
    : formatted;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        {helper ? (
          <span className="text-xs text-muted-foreground">{helper}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <Slider
          value={[displayedValue]}
          min={displayedMin}
          max={displayedMax}
          step={displayedStep}
          onValueChange={handleSliderChange}
          disabled={disabled}
          dir="rtl"
          className="flex-1"
        />
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={inputValue}
          disabled={disabled}
          onFocus={() => {
            setFocused(true);
            setRawValue(
              String(asPercent ? +(value * 100).toFixed(4) : value),
            );
          }}
          onBlur={(e) => {
            commitFromRaw(e.target.value);
            setFocused(false);
          }}
          onChange={(e) => liveUpdate(e.target.value)}
          className="w-32 text-end font-medium tabular-nums"
          aria-label={label}
        />
      </div>
    </div>
  );
}
