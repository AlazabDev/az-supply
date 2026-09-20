import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listDaftraProducts } from "@/lib/daftra.functions";
import { EntityTable, Pager, type Column } from "@/components/daftra/EntityTable";

interface ProductRow {
  id: string;
  name: string;
  code: string;
  brand: string;
  category: string;
  unitPrice: number;
  buyPrice: number;
  stock: number;
  threshold: number;
  tracked: boolean;
  low: boolean;
}

const productsOptions = (page: number) => ({
  queryKey: ["daftra", "products", page],
  queryFn: () => listDaftraProducts({ data: { page } }),
});

export const Route = createFileRoute("/_authenticated/inventory")({
  loader: ({ context }) => context.queryClient.ensureQueryData(productsOptions(1)),
  head: () => ({
    meta: [
      { title: "Inventory | Meridian Control Tower" },
      {
        name: "description",
        content: "Live product inventory from the company's Daftra account — prices, stock levels and low-stock warnings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Inventory | Meridian Control Tower" },
      { property: "og:description", content: "Live product inventory from the company's Daftra account — prices, stock levels and low-stock warnings." },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const [page, setPage] = useState(1);
  const { data, isFetching } = useQuery({ ...productsOptions(page), placeholderData: (p) => p });

  const lowCount = (data?.rows ?? []).filter((p) => p.low).length;

  const columns: Column<ProductRow>[] = [
    { key: "code", header: "Code", render: (r) => r.code || "—" },
    { key: "name", header: "Product", sortValue: (r) => r.name },
    { key: "brand", header: "Brand", render: (r) => r.brand || "—" },
    { key: "unitPrice", header: "Sell price", numeric: true, sortValue: (r) => r.unitPrice, render: (r) => r.unitPrice.toLocaleString() },
    { key: "buyPrice", header: "Cost", numeric: true, sortValue: (r) => r.buyPrice, render: (r) => r.buyPrice.toLocaleString() },
    {
      key: "stock",
      header: "Stock",
      numeric: true,
      sortValue: (r) => r.stock,
      render: (r) =>
        r.low ? (
          <span style={{ color: "var(--caution)" }} className="font-semibold">
            {r.stock} · low
          </span>
        ) : (
          r.tracked
            ? r.stock.toLocaleString()
            : "—"
        ),
    },
  ];

  return (
    <section className="panel p-4">
      <div className="mb-3">
        <p className="eyebrow">daftra · inventory</p>
        <h2 className="text-lg font-semibold tracking-tight">
          Products <span className="num text-sm text-muted-foreground">{data?.total ?? "…"}</span>
          {lowCount > 0 && (
            <span className="ml-2 text-xs font-medium" style={{ color: "var(--caution)" }}>
              {lowCount} low stock on this page
            </span>
          )}
          {isFetching && <span className="ml-2 text-xs text-muted-foreground">syncing…</span>}
        </h2>
      </div>
      <EntityTable columns={columns} rows={data?.rows ?? []} searchKeys={["name", "code", "brand", "category"]} empty="No products found." />
      <Pager page={data?.page ?? 1} pageCount={data?.pageCount ?? 1} onPage={setPage} />
    </section>
  );
}
