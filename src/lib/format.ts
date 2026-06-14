const shekelFmt = new Intl.NumberFormat("he-IL", {
  maximumFractionDigits: 0,
});

const shekelFmtFraction = new Intl.NumberFormat("he-IL", {
  maximumFractionDigits: 2,
});

export function formatShekels(n: number, fraction = false): string {
  if (!Number.isFinite(n)) return "—";
  const fmt = fraction ? shekelFmtFraction : shekelFmt;
  return `${fmt.format(Math.round(n))} ₪`;
}

export function formatShekelsCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(2)} מיליון ₪`;
  }
  if (Math.abs(n) >= 1_000) {
    return `${Math.round(n / 1000).toLocaleString("he-IL")}K ₪`;
  }
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

export function formatPercent(decimal: number, fraction = 1): string {
  return `${(decimal * 100).toFixed(fraction)}%`;
}

export function formatNumberHe(n: number, maxFractionDigits = 0): string {
  return new Intl.NumberFormat("he-IL", {
    maximumFractionDigits: maxFractionDigits,
  }).format(n);
}
