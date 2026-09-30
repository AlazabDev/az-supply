import { daftraList, displayName } from "@/lib/daftra.server";
import { normalizeDate } from "@/lib/daftra.orders";

type Raw = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

async function pages(entity: string, max: number, key?: string) {
  const out: Raw[] = [];
  let page = 1;
  let count = 1;
  while (page <= count && page <= max) {
    const res = await daftraList<Raw>(entity, page, 50, { key });
    count = res.pageCount;
    out.push(...res.rows);
    page += 1;
  }
  return out;
}

function doc(d: Raw, party: "client" | "supplier") {
  const total = n(d.summary_total);
  const paid = n(d.summary_paid);
  return {
    id: s(d.id),
    no: s(d.no),
    [party]: displayName(s(d[`${party}_business_name`]), s(d[`${party}_first_name`]), s(d[`${party}_last_name`])),
    date: normalizeDate(s(d.issue_date) || s(d.date)),
    due: normalizeDate(s(d.due_date) || s(d.stored_due_date)),
    total,
    paid,
    unpaid: n(d.summary_unpaid) || Math.max(0, total - paid),
    cur: s(d.currency_code) || "EGP",
    draft: s(d.draft) === "1" || undefined,
    order: d.work_order_id ? s(d.work_order_id) : undefined,
  };
}

let cache: { at: number; text: string } | null = null;

/** Compact JSON snapshot of invoices, work orders and supplier purchases. Cached 2 min. */
export async function getDaftraSnapshot(): Promise<string> {
  if (cache && Date.now() - cache.at < 120_000) return cache.text;
  const [invoices, orders, purchases] = await Promise.all([
    pages("invoices", 6),
    pages("work_orders", 2),
    pages("purchase_invoices", 4, "PurchaseOrder"),
  ]);
  const snapshot = {
    today: new Date().toISOString().slice(0, 10),
    invoices: invoices.map((d) => doc(d, "client")),
    orders: orders.map((o) => ({
      id: s(o.id),
      no: s(o.number) || `#${s(o.id)}`,
      title: s(o.title),
      client: s((o.client_data as Raw | undefined)?.["business_name"]) || s(o.client_id),
      start: normalizeDate(s(o.start_date)),
      delivery: normalizeDate(s(o.delivery_date)),
      budget: n(o.budget),
      cur: s(o.budget_currency) || "EGP",
    })),
    supplierPurchases: purchases.map((d) => doc(d, "supplier")),
  };
  const text = JSON.stringify(snapshot);
  cache = { at: Date.now(), text };
  return text;
}
