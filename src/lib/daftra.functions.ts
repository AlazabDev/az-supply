import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { daftraList, daftraCreate, daftraGetOne, displayName } from "./daftra.server";
import { normalizeDate } from "./daftra.orders";

/** Auth gate + Daftra reads. Every function here requires a signed-in session. */

export interface PageMeta {
  page: number;
  pageCount: number;
  total: number;
}

export const listDaftraClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { page?: number } | undefined) => ({
    page: Math.max(1, Math.floor(Number(data?.page) || 1)),
  }))
  .handler(async ({ data }) => {
    const res = await daftraList<Record<string, string | null>>("clients", data.page, 50);
    const rows = res.rows.map((c) => ({
      id: String(c.id),
      number: c.client_number ?? "",
      name: displayName(c.business_name, c.first_name, c.last_name),
      email: c.email ?? "",
      phone: c.phone1 ?? "",
      city: c.city ?? "",
      createdAt: c.created ?? "",
    }));
    return { rows, page: res.page, pageCount: res.pageCount, total: res.total };
  });

export const listDaftraSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { page?: number } | undefined) => ({
    page: Math.max(1, Math.floor(Number(data?.page) || 1)),
  }))
  .handler(async ({ data }) => {
    const res = await daftraList<Record<string, string | null>>("suppliers", data.page, 50);
    const rows = res.rows.map((s) => ({
      id: String(s.id),
      number: s.supplier_number ?? "",
      name: displayName(s.business_name, s.first_name, s.last_name),
      email: s.email ?? "",
      phone: s.phone1 ?? "",
      city: s.city ?? "",
      createdAt: s.created ?? "",
    }));
    return { rows, page: res.page, pageCount: res.pageCount, total: res.total };
  });

export const listDaftraProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { page?: number } | undefined) => ({
    page: Math.max(1, Math.floor(Number(data?.page) || 1)),
  }))
  .handler(async ({ data }) => {
    const res = await daftraList<Record<string, string | null>>("products", data.page, 100);
    const rows = res.rows.map((p) => {
      const stock = Number(p.stock_balance ?? 0);
      const threshold = Number(p.low_stock_thershold ?? 0);
      return {
        id: String(p.id),
        name: (p.name ?? "").trim() || "—",
        code: p.product_code ?? "",
        brand: p.brand ?? "",
        category: p.category ?? "",
        unitPrice: Number(p.unit_price ?? 0),
        buyPrice: Number(p.buy_price ?? 0),
        stock,
        threshold,
        tracked: String(p.tracking_type ?? "").includes("quantity"),
        low: threshold > 0 && stock <= threshold,
      };
    });
    return { rows, page: res.page, pageCount: res.pageCount, total: res.total };
  });

export const listDaftraInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { page?: number } | undefined) => ({
    page: Math.max(1, Math.floor(Number(data?.page) || 1)),
  }))
  .handler(async ({ data }) => {
    const res = await daftraList<Record<string, string | null>>("invoices", data.page, 50);
    const rows = res.rows.map((inv) => ({
      id: String(inv.id),
      no: inv.no ?? "",
      client: displayName(inv.client_business_name, inv.client_first_name, inv.client_last_name),
      draft: inv.draft === "1",
      total: Number(inv.summary_total ?? 0),
      paid: Number(inv.summary_paid ?? 0),
      unpaid: Number(inv.summary_unpaid ?? 0),
      currency: inv.currency_code ?? "",
      date: normalizeDate(inv.issue_date || inv.date || inv.created),
      dueDate: normalizeDate(inv.due_date ?? inv.stored_due_date),
      orderId: inv.work_order_id ? String(inv.work_order_id) : "",
    }));
    return { rows, page: res.page, pageCount: res.pageCount, total: res.total };
  });

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export const createDaftraClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { businessName?: string; email?: string; phone?: string; city?: string; notes?: string }) => data)
  .handler(async ({ data }) => {
    const businessName = str(data.businessName, 200);
    if (!businessName) throw new Error("Client name is required");
    const payload: Record<string, unknown> = { business_name: businessName };
    const email = str(data.email, 200);
    if (email) payload.email = email;
    const phone = str(data.phone, 40);
    if (phone) payload.phone1 = phone;
    const city = str(data.city, 80);
    if (city) payload.city = city;
    const notes = str(data.notes, 500);
    if (notes) payload.notes = notes;
    return daftraCreate("clients", payload);
  });

export const createDaftraSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { businessName?: string; email?: string; phone?: string; city?: string; notes?: string }) => data)
  .handler(async ({ data }) => {
    const businessName = str(data.businessName, 200);
    if (!businessName) throw new Error("Supplier name is required");
    const payload: Record<string, unknown> = { business_name: businessName };
    const email = str(data.email, 200);
    if (email) payload.email = email;
    const phone = str(data.phone, 40);
    if (phone) payload.phone1 = phone;
    const city = str(data.city, 80);
    if (city) payload.city = city;
    const notes = str(data.notes, 500);
    if (notes) payload.notes = notes;
    return daftraCreate("suppliers", payload);
  });

/* ------------------------------------------------------------------ */
/* Orders (Daftra work orders / projects) and invoice detail           */
/* ------------------------------------------------------------------ */

type Raw = Record<string, unknown>;

function s(v: unknown): string {
  return v == null ? "" : String(v);
}
function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export const listDaftraOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { page?: number } | undefined) => ({
    page: Math.max(1, Math.floor(Number(data?.page) || 1)),
  }))
  .handler(async ({ data }) => {
    const res = await daftraList<Raw>("work_orders", data.page, 50);
    const rows = res.rows.map((o) => ({
      id: s(o.id),
      number: s(o.number) || `#${s(o.id)}`,
      title: s(o.title) || "—",
      client: s((o.client_data as Raw | undefined)?.["business_name"]) || s(o.client_id),
      startDate: normalizeDate(s(o.start_date)),
      deliveryDate: normalizeDate(s(o.delivery_date)),
      budget: n(o.budget),
      currency: s(o.budget_currency) || "EGP",
      statusId: s(o.follow_up_status_id),
    }));
    return { rows, page: res.page, pageCount: res.pageCount, total: res.total };
  });

export const getDaftraOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => ({ id: String(data.id).slice(0, 20) }))
  .handler(async ({ data }) => {
    const o = await daftraGetOne<Raw>("work_orders", data.id);
    if (!o) throw new Error("Order not found");

    // Invoices linked to this work order (Daftra has no filter param for it).
    const linked: {
      id: string;
      no: string;
      date: string;
      dueDate: string;
      total: number;
      paid: number;
      unpaid: number;
      currency: string;
      draft: boolean;
    }[] = [];
    let page = 1;
    let pageCount = 1;
    while (page <= pageCount && page <= 6) {
      const res = await daftraList<Raw>("invoices", page, 50);
      pageCount = res.pageCount;
      for (const inv of res.rows) {
        if (s(inv.work_order_id) !== data.id) continue;
        linked.push({
          id: s(inv.id),
          no: s(inv.no),
          date: normalizeDate(s(inv.issue_date) || s(inv.date)),
          dueDate: normalizeDate(s(inv.due_date) || s(inv.stored_due_date)),
          total: n(inv.summary_total),
          paid: n(inv.summary_paid),
          unpaid: n(inv.summary_unpaid),
          currency: s(inv.currency_code),
          draft: s(inv.draft) === "1",
        });
      }
      page += 1;
    }

    const client = o.client_data as Raw | undefined;
    return {
      id: s(o.id),
      number: s(o.number) || `#${s(o.id)}`,
      title: s(o.title) || "—",
      description: s(o.description),
      startDate: normalizeDate(s(o.start_date)),
      deliveryDate: normalizeDate(s(o.delivery_date)),
      budget: n(o.budget),
      currency: s(o.budget_currency) || "EGP",
      client: {
        name: displayName(
          s(client?.["business_name"]),
          s(client?.["first_name"]),
          s(client?.["last_name"]),
        ),
        email: s(client?.["email"]),
        phone: s(client?.["phone1"]),
        city: s(client?.["city"]),
      },
      invoices: linked,
    };
  });

export const getDaftraInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => ({ id: String(data.id).slice(0, 20) }))
  .handler(async ({ data }) => {
    const inv = await daftraGetOne<Raw>("invoices", data.id);
    if (!inv) throw new Error("Invoice not found");

    const items = (Array.isArray(inv.InvoiceItem) ? (inv.InvoiceItem as Raw[]) : []).map((it, i) => ({
      id: s(it.id) || `item-${i}`,
      description: s(it.item) || s(it.description) || "—",
      quantity: n(it.quantity),
      unitPrice: n(it.unit_price),
      subtotal: n(it.subtotal),
      unit: s(it.unit_name),
    }));

    const payments = (Array.isArray(inv.InvoicePayment) ? (inv.InvoicePayment as Raw[]) : []).map(
      (p, i) => ({
        id: s(p.id) || `pay-${i}`,
        date: normalizeDate(s(p.date)),
        amount: n(p.amount),
        method: s(p.payment_method) || "—",
        transaction: s(p.transaction_id),
        currency: s(p.currency_code),
      }),
    );

    return {
      id: s(inv.id),
      no: s(inv.no),
      draft: s(inv.draft) === "1",
      date: normalizeDate(s(inv.issue_date) || s(inv.date)),
      dueDate: normalizeDate(s(inv.due_date) || s(inv.stored_due_date)),
      currency: s(inv.currency_code),
      subtotal: n(inv.summary_subtotal),
      discount: n(inv.summary_discount),
      tax: n(inv.summary_tax1) + n(inv.summary_tax2),
      shipping: n(inv.shipping_amount),
      total: n(inv.summary_total),
      paid: n(inv.summary_paid),
      unpaid: n(inv.summary_unpaid),
      notes: s(inv.notes),
      orderId: inv.work_order_id ? s(inv.work_order_id) : "",
      pdfUrl: s(inv.invoice_pdf_url),
      client: {
        name: displayName(
          s(inv.client_business_name),
          s(inv.client_first_name),
          s(inv.client_last_name),
        ),
        email: s(inv.client_email),
        phone: s(inv.client_phone1) || s(inv.client_phone2),
        city: s(inv.client_city),
        address: [s(inv.client_address1), s(inv.client_address2)].filter(Boolean).join(", "),
      },
      items,
      payments,
    };
  });
