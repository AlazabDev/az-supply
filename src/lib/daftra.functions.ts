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
