import { cn } from "@/lib/utils";

/** Colored 0-100 chip. >=70 emerald, >=50 amber, otherwise muted. */
export function ScoreBadge({
  value,
  size = "sm",
  label,
}: {
  value: number;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const tone =
    value >= 70
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-500/30"
      : value >= 50
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/30"
        : "bg-muted text-muted-foreground ring-border";
  const px =
    size === "lg" ? "px-3 py-1.5 text-base" : size === "md" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold tabular-nums ring-1",
        tone,
        px,
      )}
    >
      {label ? <span className="font-normal opacity-80">{label}</span> : null}
      {value.toFixed(0)}
    </span>
  );
}
