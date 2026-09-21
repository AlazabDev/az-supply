import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listDaftraOrders } from "@/lib/daftra.functions";
import { EntityTable, Pager, type Column } from "@/components/daftra/EntityTable";
import { isPast, money } from "@/lib/daftra.orders";

interface OrderRow {
  id: string;
  number: string;
  title: string;
  client: string;
  startDate: string;
  deliveryDate: string;
  budget: number;
  currency: string;
  statusId: string;
}

const ordersOptions = (page: number) => ({
  queryKey: ["daftra", "orders", page],
  queryFn: () => listDaftraOrders({ data: { page } }),
});

export const Route = createFileRoute("/_authenticated/orders/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(ordersOptions(1)),
  head: () => ({
    meta: [
      { title: "Order tracking | Meridian Control Tower" },
      {
        name: "description",
        content:
          "Track live customer orders from the company's Daftra account — delivery dates, budgets and invoicing progress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Order tracking | Meridian Control Tower" },
      {
        property: "og:description",
        content: "Live customer orders with delivery dates, budgets and invoicing progress.",
      },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const [page, setPage] = useState(1);
  const { data, isFetching, error } = useQuery({ ...ordersOptions(page), placeholderData: (p) => p });

  const rows = data?.rows ?? [];
  const pipeline = rows.reduce((sum, r) => sum + r.budget, 0);
  const late = rows.filter((r) => r.deliveryDate && isPast(r.deliveryDate)).length;

  const columns: Column<OrderRow>[] = [
    {
      key: "number",
      header: "Order",
      sortValue: (r) => r.number,
      render: (r) => (
        <Link
          to="/orders/$id"
          params={{ id: r.id }}
          className="font-medium underline-offset-2 hover:underline"
          style={{ color: "var(--primary)" }}
        >
          {r.number}
        </Link>
      ),
    },
    { key: "title", header: "Description", sortValue: (r) => r.title },
    { key: "client", header: "Client", sortValue: (r) => r.client },
    { key: "startDate", header: "Start", sortValue: (r) => r.startDate, render: (r) => r.startDate || "—" },
    {
      key: "deliveryDate",
      header: "Delivery",
      sortValue: (r) => r.deliveryDate,
      render: (r) =>
        r.deliveryDate ? (
          <span style={isPast(r.deliveryDate) ? { color: "var(--critical)" } : undefined}>
            {r.deliveryDate}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "budget",
      header: "Value",
      numeric: true,
      sortValue: (r) => r.budget,
      render: (r) => (r.budget ? money(r.budget, r.currency) : "—"),
    },
  ];

  return (
    <section className="panel p-4">
      <div className="mb-3">
        <p className="eyebrow">daftra · orders</p>
        <h2 className="text-lg font-semibold tracking-tight">
          Order tracking <span className="num text-sm text-muted-foreground">{data?.total ?? "…"}</span>
          {isFetching && <span className="ml-2 text-xs text-muted-foreground">syncing…</span>}
        </h2>
      </div>

      {error ? (
        <p className="mb-3 text-sm" style={{ color: "var(--critical)" }}>
          Could not load orders. {(error as Error).message}
        </p>
      ) : null}

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-[var(--radius-sm)] border border-border px-3 py-2">
          <p className="eyebrow">orders (page)</p>
          <p className="num text-base font-semibold">{rows.length}</p>
        </div>
        <div className="rounded-[var(--radius-sm)] border border-border px-3 py-2">
          <p className="eyebrow">contracted value</p>
          <p className="num text-base font-semibold">{money(pipeline)}</p>
        </div>
        <div className="rounded-[var(--radius-sm)] border border-border px-3 py-2">
          <p className="eyebrow">past delivery date</p>
          <p
            className="num text-base font-semibold"
            style={late ? { color: "var(--critical)" } : undefined}
          >
            {late}
          </p>
        </div>
      </div>

      <EntityTable
        columns={columns}
        rows={rows}
        searchKeys={["number", "title", "client"]}
        empty="No orders found."
      />
      <Pager page={data?.page ?? 1} pageCount={data?.pageCount ?? 1} onPage={setPage} />
    </section>
  );
}
