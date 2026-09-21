/** Shared, client-safe helpers for presenting Daftra order/invoice data. */

export type PaymentState = "paid" | "partial" | "unpaid" | "overdue" | "draft";

export function paymentState(input: {
  draft: boolean;
  total: number;
  paid: number;
  unpaid: number;
  dueDate?: string;
}): PaymentState {
  if (input.draft) return "draft";
  if (input.total > 0 && input.paid >= input.total) return "paid";
  if (input.unpaid > 0 && isPast(input.dueDate)) return "overdue";
  if (input.paid > 0) return "partial";
  return "unpaid";
}

export function isPast(date?: string): boolean {
  if (!date) return false;
  const t = Date.parse(date);
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

export const STATE_LABEL: Record<PaymentState, string> = {
  paid: "Paid",
  partial: "Partly paid",
  unpaid: "Unpaid",
  overdue: "Overdue",
  draft: "Draft",
};

export function stateColor(state: PaymentState): string {
  switch (state) {
    case "paid":
      return "var(--nominal)";
    case "partial":
      return "var(--caution)";
    case "overdue":
      return "var(--critical)";
    case "unpaid":
      return "var(--caution)";
    default:
      return "var(--muted-foreground)";
  }
}

export function money(amount: number, currency = ""): string {
  return `${Math.round(amount).toLocaleString("en-US")}${currency ? ` ${currency}` : ""}`;
}

/** Daftra returns dates as YYYY-MM-DD or DD-MM-YYYY depending on endpoint. */
export function normalizeDate(value?: string | null): string {
  if (!value) return "";
  const v = value.slice(0, 10);
  if (/^\d{2}-\d{2}-\d{4}$/.test(v)) {
    const [d, m, y] = v.split("-");
    return `${y}-${m}-${d}`;
  }
  if (v.startsWith("0000")) return "";
  return v;
}
