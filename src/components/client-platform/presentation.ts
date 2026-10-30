import type { ClientMilestone, ClientPage } from "./types";

const pages: Record<ClientPage, string> = {
  home: "/koper",
  villa: "/koper/villa",
  progress: "/koper/voortgang",
  payments: "/koper/betaalschema",
  documents: "/koper/documenten",
  updates: "/koper/updates",
};

export function clientHref(page: ClientPage, villaId: string) {
  return `${pages[page]}?villa=${encodeURIComponent(villaId)}`;
}

export function money(amount: number | null) {
  if (amount === null || !Number.isFinite(amount)) return "Not available";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function dateLabel(value: string | null, monthOnly = false) {
  if (!value) return "To be confirmed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "To be confirmed";
  return new Intl.DateTimeFormat("en-GB", {
    ...(monthOnly ? {} : { day: "numeric" as const }),
    month: monthOnly ? "long" : "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function humanLabel(value: string) {
  const known: Record<string, string> = {
    in_build: "Under construction",
    planned: "Planned",
    completed: "Completed",
    complete: "Completed",
    sold: "Sold",
    reserved: "Reserved",
  };
  return (
    known[value] ??
    value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())
  );
}

export function milestoneAmount(
  milestone: ClientMilestone,
  total: number | null,
): number | null {
  if (milestone.amountUsd !== null && Number.isFinite(milestone.amountUsd))
    return milestone.amountUsd;
  if (
    total === null ||
    !Number.isFinite(total) ||
    !Number.isFinite(milestone.percent)
  )
    return null;
  return Math.round(total * milestone.percent) / 100;
}

export function paymentSummary(
  milestones: ClientMilestone[],
  total: number | null,
) {
  const paidMilestones = milestones.filter((item) => item.status === "paid");
  const amounts = paidMilestones.map((item) => milestoneAmount(item, total));
  const paid =
    !milestones.length || amounts.some((amount) => amount === null)
      ? null
      : Math.round(
          amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0) * 100,
        ) / 100;
  const percent = !milestones.length
    ? null
    : total !== null && total > 0 && paid !== null
      ? (paid / total) * 100
      : paidMilestones.reduce((sum, item) => sum + item.percent, 0);
  return {
    paid,
    remaining:
      total !== null && paid !== null
        ? Math.max(0, Math.round((total - paid) * 100) / 100)
        : null,
    percent,
    paidCount: paidMilestones.length,
    next: milestones.find((item) => item.status !== "paid") ?? null,
  };
}

export function safeDocumentUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const reserved = [
      "example",
      "example.com",
      "example.org",
      "example.net",
      "invalid",
      "test",
      "localhost",
    ];
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      reserved.some(
        (name) => hostname === name || hostname.endsWith(`.${name}`),
      )
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Quote every field and neutralize formula-leading strings before spreadsheet import. */
export function csvCell(value: string | number) {
  const raw = String(value);
  const safe =
    typeof value === "string" && /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function paymentCsv(
  milestones: ClientMilestone[],
  total: number | null,
) {
  return [
    [
      "Milestone",
      "Share (%)",
      "Amount USD",
      "Status",
      "Recorded paid",
      "Expected date",
      "Amount basis",
    ],
    ...milestones.map((item) => [
      item.dueLabel,
      item.percent,
      milestoneAmount(item, total) ?? "Not available",
      item.status === "paid" ? "Paid" : "Scheduled",
      item.paidAt ?? "",
      item.expectedAt ?? "",
      item.amountUsd !== null
        ? "Recorded amount"
        : total !== null
          ? "Derived from agreement share"
          : "Not available",
    ]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
