import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listDaftraInvoices } from "@/lib/daftra.functions";
import { EntityTable, Pager, type Column } from "@/components/daftra/EntityTable";

interface InvoiceRow {
  id: string;
  no: string;
  client: string;
  status: string;
  draft: boolean;
  total: number;
  paid: number;
  unpaid: number;
  currency: string;
  date: string;
}

const invoicesOptions = (page: number) => ({
  queryKey: ["daftra", "invoices", page],
  queryFn: () => listDaftraInvoices({ data: { page } }),
});

export const Route = createFileRoute("/_authenticated/invoices/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(invoicesOptions(1)),
  head: () => ({
    meta: [
      { title: "Invoices | Meridian Control Tower" },
      {
        name: "description",
        content: "Live invoices from the company's Daftra account — totals, payment status and outstanding balances.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Invoices | Meridian Control Tower" },
      { property: "og:description", content: "Live invoices from the company's Daftra account — totals, payment status and outstanding balances." },
    ],
  }),
  component: InvoicesPage,
});

function statusColor(status: string, draft: boolean): string {
  if (draft) return "var(--muted-foreground)";
  const s = status.toLowerCase();
  if (s.includes("paid") && !s.includes("unpaid") && !s.includes("partial")) return "var(--nominal)";
  if (s.includes("partial")) return "var(--caution)";
  if (s.includes("unpaid") || s.includes("overdue")) return "var(--critical)";
  return "var(--muted-foreground)";
}

function InvoicesPage() {
  const [page, setPage] = useState(1);
  const { data, isFetching } = useQuery({ ...invoicesOptions(page), placeholderData: (p) => p });

  const outstanding = (data?.rows ?? []).reduce((sum, r) => sum + r.unpaid, 0);

  const columns: Column<InvoiceRow>[] = [
    { key: "no", header: "Invoice", render: (r) => r.no || "—" },
    { key: "client", header: "Client", sortValue: (r) => r.client },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span className="font-medium" style={{ color: statusColor(r.status, r.draft) }}>
          {r.draft ? "draft" : r.status || "—"}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      numeric: true,
      sortValue: (r) => r.total,
      render: (r) => `${r.total.toLocaleString()} ${r.currency}`,
    },
    {
      key: "unpaid",
      header: "Outstanding",
      numeric: true,
      sortValue: (r) => r.unpaid,
      render: (r) =>
        r.unpaid > 0 ? (
          <span style={{ color: "var(--critical)" }}>{r.unpaid.toLocaleString()}</span>
        ) : (
          "0"
        ),
    },
    { key: "date", header: "Date", render: (r) => r.date.slice(0, 10) },
  ];

  return (
    <section className="panel p-4">
      <div className="mb-3">
        <p className="eyebrow">daftra · invoices</p>
        <h2 className="text-lg font-semibold tracking-tight">
          Invoices <span className="num text-sm text-muted-foreground">{data?.total ?? "…"}</span>
          <span className="ml-2 text-xs font-medium" style={{ color: "var(--critical)" }}>
            outstanding on this page: {outstanding.toLocaleString()}
          </span>
          {isFetching && <span className="ml-2 text-xs text-muted-foreground">syncing…</span>}
        </h2>
      </div>
      <EntityTable columns={columns} rows={data?.rows ?? []} searchKeys={["no", "client", "status"]} empty="No invoices found." />
      <Pager page={data?.page ?? 1} pageCount={data?.pageCount ?? 1} onPage={setPage} />
    </section>
  );
}
