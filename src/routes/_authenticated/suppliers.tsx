import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listDaftraSuppliers } from "@/lib/daftra.functions";
import { EntityTable, Pager, type Column } from "@/components/daftra/EntityTable";
import { AddPartyForm } from "@/components/daftra/AddPartyForm";

interface SupplierRow {
  id: string;
  number: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  createdAt: string;
}

const suppliersOptions = (page: number) => ({
  queryKey: ["daftra", "suppliers", page],
  queryFn: () => listDaftraSuppliers({ data: { page } }),
});

export const Route = createFileRoute("/_authenticated/suppliers")({
  loader: ({ context }) => context.queryClient.ensureQueryData(suppliersOptions(1)),
  head: () => ({
    meta: [
      { title: "Suppliers | Meridian Control Tower" },
      {
        name: "description",
        content: "Live supplier list synced from the company's Daftra account, with search and instant add.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Suppliers | Meridian Control Tower" },
      { property: "og:description", content: "Live supplier list synced from the company's Daftra account, with search and instant add." },
    ],
  }),
  component: SuppliersPage,
});

function SuppliersPage() {
  const [page, setPage] = useState(1);
  const { data, isFetching } = useQuery({ ...suppliersOptions(page), placeholderData: (p) => p });

  const columns: Column<SupplierRow>[] = [
    { key: "number", header: "#", render: (r) => r.number || "—" },
    { key: "name", header: "Supplier", sortValue: (r) => r.name },
    { key: "email", header: "Email", render: (r) => r.email || "—" },
    { key: "phone", header: "Phone", render: (r) => r.phone || "—" },
    { key: "city", header: "City", render: (r) => r.city || "—" },
    { key: "createdAt", header: "Since", render: (r) => r.createdAt.slice(0, 10) },
  ];

  return (
    <section className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow">daftra · suppliers</p>
          <h2 className="text-lg font-semibold tracking-tight">
            Suppliers <span className="num text-sm text-muted-foreground">{data?.total ?? "…"}</span>
            {isFetching && <span className="ml-2 text-xs text-muted-foreground">syncing…</span>}
          </h2>
        </div>
        <AddPartyForm
          title="Add supplier"
          cta="Save supplier"
          queryKeyPrefix="suppliers"
          action={async (input) => {
            "use server";
            const { createDaftraSupplier } = await import("@/lib/daftra.functions");
            return createDaftraSupplier({ data: input });
          }}
        />
      </div>
      <EntityTable columns={columns} rows={data?.rows ?? []} searchKeys={["name", "email", "phone", "number", "city"]} empty="No suppliers found." />
      <Pager page={data?.page ?? 1} pageCount={data?.pageCount ?? 1} onPage={setPage} />
    </section>
  );
}
