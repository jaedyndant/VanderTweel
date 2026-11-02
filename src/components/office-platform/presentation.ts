import type { OfficePage, OfficePayment, OfficeVilla } from "./types";
import { safeDocumentUrl } from "../client-platform/presentation";

const routes = {
  overview: "/office",
  villas: "/office/villas",
  buyers: "/office/kopers",
  payments: "/office/betalingen",
  updates: "/office/updates",
  documents: "/office/documenten",
} as const;

export function officeHref(page: OfficePage, projectId?: string | null) {
  const route = routes[page as keyof typeof routes] ?? routes.overview;
  return projectId
    ? `${route}?projectId=${encodeURIComponent(projectId)}`
    : route;
}

export function villaHref(
  villa: Pick<OfficeVilla, "code" | "projectId">,
  section = "",
) {
  return `/office/villas/${encodeURIComponent(villa.code)}${section ? `/${section}` : ""}?projectId=${encodeURIComponent(villa.projectId)}`;
}

export function numberLabel(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(
    value,
  );
}

export function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Not available";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function dateLabel(value: string | null, monthOnly = false) {
  if (!value) return "To be confirmed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "To be confirmed";
  return new Intl.DateTimeFormat("en-GB", {
    ...(monthOnly ? {} : { day: "numeric" as const }),
    month: "short",
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
    open: "Open",
    paid: "Paid",
  };
  return (
    known[value] ??
    value
      .replaceAll("_", " ")
      .replace(/^./, (character) => character.toUpperCase())
  );
}

export function paymentAmount(payment: OfficePayment, villa?: OfficeVilla) {
  if (payment.amountUsd !== null && Number.isFinite(payment.amountUsd))
    return payment.amountUsd;
  const total = villa?.priceTotalUsd;
  return total !== undefined &&
    total !== null &&
    Number.isFinite(total) &&
    Number.isFinite(payment.percent)
    ? Math.round(total * payment.percent) / 100
    : null;
}

export function paymentTotals(
  payments: OfficePayment[],
  villas: OfficeVilla[],
) {
  const lookup = new Map(villas.map((villa) => [villa.id, villa]));
  const paid = payments.filter((payment) => payment.status === "paid");
  const open = payments.filter((payment) => payment.status !== "paid");
  function sum(items: OfficePayment[]) {
    if (!payments.length) return null;
    const amounts = items.map((payment) =>
      paymentAmount(payment, lookup.get(payment.villaId)),
    );
    return amounts.some((amount) => amount === null)
      ? null
      : Math.round(
          amounts.reduce<number>((total, amount) => total + (amount ?? 0), 0) *
            100,
        ) / 100;
  }
  return {
    paid: sum(paid),
    remaining: sum(open),
    paidCount: paid.length,
    openCount: open.length,
    next: open[0] ?? null,
  };
}

/** Preserve recorded status and unknown amounts; neutralize spreadsheet formulas. */
export function paymentCsv(payments: OfficePayment[], villas: OfficeVilla[]) {
  const lookup = new Map(villas.map((villa) => [villa.id, villa]));
  const rows: (string | number)[][] = [
    [
      "Residence",
      "Milestone",
      "Share (%)",
      "Amount USD",
      "Status",
      "Recorded paid",
      "Expected date",
      "Amount basis",
    ],
    ...payments.map((payment) => [
      payment.villaCode,
      payment.dueLabel,
      payment.percent,
      paymentAmount(payment, lookup.get(payment.villaId)) ?? "Not available",
      humanLabel(payment.status),
      payment.paidAt ?? "",
      payment.expectedAt ?? "",
      payment.amountUsd !== null
        ? "Recorded amount"
        : lookup.get(payment.villaId)?.priceTotalUsd != null
          ? "Derived from agreement share"
          : "Not available",
    ]),
  ];
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value);
          const safe =
            typeof value === "string" && /^\s*[=+\-@]/.test(text)
              ? `'${text}`
              : text;
          return `"${safe.replaceAll('"', '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
}

export function safeFileUrl(value: string | null) {
  return value ? safeDocumentUrl(value) : null;
}
