// Kleine weergave-helpers voor de koper-app (MS3). Puur formatteren, geen
// autorisatie-logica — die staat in koper-data.ts.

export function formatUsd(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  return `${Math.round(num)}%`;
}

export function formatM2(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  return `${num} m²`;
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function totalProgressPercent(
  tasks: readonly { percentWeight: string | number; doneAt: Date | string | null }[]
): number {
  return tasks.reduce((sum, t) => {
    if (!t.doneAt) return sum;
    const weight = typeof t.percentWeight === "string" ? Number(t.percentWeight) : t.percentWeight;
    return sum + (Number.isNaN(weight) ? 0 : weight);
  }, 0);
}
