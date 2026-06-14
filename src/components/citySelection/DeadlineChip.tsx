import { daysUntilClose } from "@/lib/projectFilters";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

interface DeadlineChipProps {
  project: Project;
  size?: "sm" | "md";
  showDate?: boolean;
}

/** Small pill showing "X days left" with color escalation as the deadline nears. */
export function DeadlineChip({
  project,
  size = "sm",
  showDate = false,
}: DeadlineChipProps) {
  const days = daysUntilClose(project);
  if (days == null) return null;

  const tone =
    days <= 0
      ? "bg-destructive/15 text-destructive ring-destructive/30"
      : days < 3
        ? "bg-red-500/15 text-red-700 dark:text-red-400 ring-red-500/30"
        : days < 7
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/30"
          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-500/30";

  const px = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";

  const label =
    days <= 0
      ? "סגור היום"
      : days === 1
        ? "סגירה מחר"
        : `סגירה בעוד ${days} ימים`;

  const dateLabel =
    showDate && project.registrationClosesAt
      ? ` · ${dateFmt.format(new Date(project.registrationClosesAt))}`
      : "";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium ring-1 tabular-nums",
        tone,
        px,
      )}
      title={
        project.registrationClosesAt
          ? `סגירת הרשמה: ${new Date(project.registrationClosesAt).toLocaleString("he-IL")}`
          : undefined
      }
    >
      {label}
      {dateLabel}
    </span>
  );
}
