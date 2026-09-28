import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { daftraList, daftraGetOne, displayName } from "./daftra.server";
import { normalizeDate } from "./daftra.orders";

/** Quotes, purchases, party/product detail and dashboard. All require a session. */

type Raw = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const pageInput = (data: { page?: number } | undefined) => ({
  page: Math.max(1, Math.floor(Number(data?.page) || 1)),
});
const idInput = (data: { id: string }) => ({ id: String(data.id).replace(/[^0-9]/g, "").slice(0, 20) });

/** Summary row for any invoice-like document (invoice, quote, purchase). */
function docRow(d: Raw, party: "client" | "supplier") {
  return {
    id: s(d.id),
    no: s(d.no) || `#${s(d.id)}`,
    party: displayName(s(d[`${party}_business_name`]), s(d[`${party}_first_name`]), s(d[`${party}_last_name`])),
    partyId: s(d[`${party}_id`]),
    date: normalizeDate(s(d.date) || s(d.issue_date)),
    dueDate: normalizeDate(s(d.due_date) || s(d.stored_due_date)),
    total: n(d.summary_total),
    paid: n(d.summary_paid),
    unpaid: n(d.summary_unpaid) || Math.max(0, n(d.summary_total) - n(d.summary_paid)),
    currency: s(d.currency_code) || "EGP",
    draft: s(d.draft) === "1",
    orderId: d.work_order_id ? s(d.work_order_id) : "",
  };
}

function docDetail(d: Raw, party: "client" | "supplier") {
  const items = (Array.isArray(d.InvoiceItem) ? (d.InvoiceItem as Raw[]) : []).map((it, i) => {
    const item = s(it.item);
    const desc = s(it.description).trim();
    return {
      id: s(it.id) || `item-${i}`,
      description: (/^\d*$/.test(item) ? desc : item) || desc || "—",
      quantity: n(it.quantity),
      unitPrice: n(it.unit_price),
      subtotal: n(it.subtotal),
      productId: s(it.product_id),
    };
  });
  return {
    ...docRow(d, party),
    subtotal: n(d.summary_subtotal),
    discount: n(d.summary_discount),
    tax: n(d.summary_tax1) + n(d.summary_tax2),
    notes: s(d.notes),
    pdfUrl: s(d.invoice_pdf_url),
    contact: {
      email: s(d[`${party}_email`]),
      phone: s(d[`${party}_phone1`]) || s(d[`${party}_phone2`]),
      city: s(d[`${party}_city`]),
    },
    items,
  };
}

export const listDaftraEstimates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(pageInput)
  .handler(async ({ data }) => {
    const res = await daftraList<Raw>("estimates", data.page, 50);
    return { ...res, rows: res.rows.map((r) => docRow(r, "client")) };
  });

export const getDaftraEstimate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data }) => {
    const d = await daftraGetOne<Raw>("estimates", data.id);
    if (!d) throw new Error("Quote not found");
    return docDetail(d, "client");
  });

export const listDaftraPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(pageInput)
  .handler(async ({ data }) => {
    const res = await daftraList<Raw>("purchase_invoices", data.page, 50, { key: "PurchaseOrder" });
    return { ...res, rows: res.rows.map((r) => docRow(r, "supplier")) };
  });

export const getDaftraPurchase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data }) => {
    const d = await daftraGetOne<Raw>("purchase_invoices", data.id, "PurchaseOrder");
    if (!d) throw new Error("Purchase not found");
    return docDetail(d, "supplier");
  });

function party(p: Raw, numberKey: string) {
  return {
    id: s(p.id),
    number: s(p[numberKey]),
    name: displayName(s(p.business_name), s(p.first_name), s(p.last_name)),
    contact: [s(p.first_name), s(p.last_name)].filter(Boolean).join(" "),
    email: s(p.email),
    phone: s(p.phone1) || s(p.phone2),
    address: [s(p.address1), s(p.address2), s(p.city), s(p.state)].filter(Boolean).join("، "),
    notes: s(p.notes),
    since: s(p.created).slice(0, 10),
  };
}

async function allPages(entity: string, query: Record<string, string>, key?: string, max = 4) {
  const out: Raw[] = [];
  let page = 1;
  let count = 1;
  while (page <= count && page <= max) {
    const res = await daftraList<Raw>(entity, page, 50, { query, key });
    count = res.pageCount;
    out.push(...res.rows);
    page += 1;
  }
  return out;
}

export const getDaftraClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data }) => {
    const c = await daftraGetOne<Raw>("clients", data.id);
    if (!c) throw new Error("Client not found");
    const [invoices, quotes] = await Promise.all([
      allPages("invoices", { client_id: data.id }),
      allPages("estimates", { client_id: data.id }, undefined, 2),
    ]);
    const inv = invoices.filter((r) => s(r.client_id) === data.id).map((r) => docRow(r, "client"));
    const q = quotes.filter((r) => s(r.client_id) === data.id).map((r) => docRow(r, "client"));
    return { ...party(c, "client_number"), invoices: inv, quotes: q };
  });

export const getDaftraSupplier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data }) => {
    const p = await daftraGetOne<Raw>("suppliers", data.id);
    if (!p) throw new Error("Supplier not found");
    const rows = await allPages("purchase_invoices", { supplier_id: data.id }, "PurchaseOrder");
    const purchases = rows.filter((r) => s(r.supplier_id) === data.id).map((r) => docRow(r, "supplier"));
    return { ...party(p, "supplier_number"), purchases };
  });

export const getDaftraProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data }) => {
    const p = await daftraGetOne<Raw>("products", data.id);
    if (!p) throw new Error("Product not found");
    const cats = Array.isArray(p.ProductCategory) ? (p.ProductCategory as Raw[]) : [];
    const stocks = Array.isArray(p.ProductStock) ? (p.ProductStock as Raw[]) : [];
    const sell = n(p.unit_price);
    const cost = n(p.buy_price) || n(p.average_price);
    return {
      id: s(p.id),
      name: s(p.name).trim() || "—",
      description: s(p.description).trim(),
      code: s(p.product_code),
      barcode: s(p.barcode),
      supplierCode: s(p.supplier_code),
      brand: s(p.brand),
      categories: cats.map((c) => s(c.name)).filter(Boolean),
      sellPrice: sell,
      buyPrice: cost,
      margin: sell > 0 && cost > 0 ? Math.round(((sell - cost) / sell) * 100) : null,
      stock: n(p.stock_balance),
      threshold: n(p.low_stock_thershold),
      tracked: s(p.track_stock) === "1",
      stores: stocks.map((st, i) => ({
        id: s(st.id) || String(i),
        store: s(st.store_id),
        balance: n(st.balance),
      })),
      notes: s(p.notes),
      created: s(p.created).slice(0, 10),
      modified: s(p.modified).slice(0, 10),
    };
  });

export const getDaftraDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const [invoices, quotes, purchases, orders, clients, products] = await Promise.all([
      allPages("invoices", {}, undefined, 6),
      daftraList<Raw>("estimates", 1, 50),
      allPages("purchase_invoices", {}, "PurchaseOrder", 3),
      daftraList<Raw>("work_orders", 1, 50),
      daftraList<Raw>("clients", 1, 1),
      daftraList<Raw>("products", 1, 1),
    ]);
    const inv = invoices.map((r) => docRow(r, "client")).filter((r) => !r.draft);
    const pur = purchases.map((r) => docRow(r, "supplier"));
    const today = new Date().toISOString().slice(0, 10);
    const overdue = inv.filter((r) => r.unpaid > 0 && r.dueDate && r.dueDate < today);

    // Monthly sales & collections (last 6 months).
    const months: { month: string; billed: number; collected: number; purchases: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, billed: 0, collected: 0, purchases: 0 });
    }
    for (const r of inv) {
      const m = months.find((x) => r.date.startsWith(x.month));
      if (m) {
        m.billed += r.total;
        m.collected += r.paid;
      }
    }
    for (const r of pur) {
      const m = months.find((x) => r.date.startsWith(x.month));
      if (m) m.purchases += r.total;
    }

    const byClient = new Map<string, { name: string; id: string; total: number; unpaid: number }>();
    for (const r of inv) {
      const cur = byClient.get(r.partyId) ?? { name: r.party, id: r.partyId, total: 0, unpaid: 0 };
      cur.total += r.total;
      cur.unpaid += r.unpaid;
      byClient.set(r.partyId, cur);
    }

    return {
      billed: inv.reduce((a, r) => a + r.total, 0),
      collected: inv.reduce((a, r) => a + r.paid, 0),
      outstanding: inv.reduce((a, r) => a + r.unpaid, 0),
      overdueAmount: overdue.reduce((a, r) => a + r.unpaid, 0),
      overdueCount: overdue.length,
      purchasesTotal: pur.reduce((a, r) => a + r.total, 0),
      counts: {
        invoices: inv.length,
        quotes: quotes.total,
        purchases: pur.length,
        orders: orders.total,
        clients: clients.total,
        products: products.total,
      },
      months,
      topClients: [...byClient.values()].sort((a, b) => b.total - a.total).slice(0, 6),
      overdueList: overdue.sort((a, b) => b.unpaid - a.unpaid).slice(0, 8),
      recent: [...inv].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    };
  });
