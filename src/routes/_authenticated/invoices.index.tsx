import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listDaftraInvoices } from "@/lib/daftra.functions";
import { EntityTable, Pager, type Column } from "@/components/daftra/EntityTable";
import { money, paymentState, stateColor, STATE_LABEL, type PaymentState } from "@/lib/daftra.orders";

interface InvoiceRow {
  id: string;
  no: string;
  client: string;
  draft: boolean;
  total: number;
  paid: number;
  unpaid: number;
  currency: string;
  date: string;
  dueDate: string;
  orderId: string;
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
        content:
          "Live invoices from the company's Daftra account — totals, payment status, due dates and outstanding balances.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Invoices | Meridian Control Tower" },
      {
        property: "og:description",
        content: "Live invoices with payment status, due dates and outstanding balances.",
      },
    ],
  }),
  component: InvoicesPage,
});

const FILTERS: { key: "all" | PaymentState; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "unpaid", label: "Unpaid" },
  { key: "partial", label: "Partly paid" },
  { key: "paid", label: "Paid" },
  { key: "draft", label: "Draft" },
];

function InvoicesPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | PaymentState>("all");
  const { data, isFetching, error } = useQuery({
    ...invoicesOptions(page),
    placeholderData: (p) => p,
  });

  const rows = useMemo(() => {
    const all = (data?.rows ?? []).map((r) => ({
      ...r,
      state: paymentState(r),
    }));
    return filter === "all" ? all : all.filter((r) => r.state === filter);
  }, [data, filter]);

  const outstanding = rows.reduce((sum, r) => sum + r.unpaid, 0);
  const billed = rows.reduce((sum, r) => sum + r.total, 0);
  const overdue = rows.filter((r) => r.state === "overdue").length;

  const columns: Column<InvoiceRow & { state: PaymentState }>[] = [
    {
      key: "no",
      header: "Invoice",
      sortValue: (r) => r.no,
      render: (r) => (
        <Link
          to="/invoices/$id"
          params={{ id: r.id }}
          className="font-medium underline-offset-2 hover:underline"
          style={{ color: "var(--primary)" }}
        >
          {r.no || `#${r.id}`}
        </Link>
      ),
    },
    { key: "client", header: "Client", sortValue: (r) => r.client },
    {
      key: "state",
      header: "Status",
      sortValue: (r) => r.state,
      render: (r) => (
        <span className="font-medium" style={{ color: stateColor(r.state) }}>
          {STATE_LABEL[r.state]}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      numeric: true,
      sortValue: (r) => r.total,
      render: (r) => money(r.total, r.currency),
    },
    {
      key: "unpaid",
      header: "Outstanding",
      numeric: true,
      sortValue: (r) => r.unpaid,
      render: (r) =>
        r.unpaid > 0 ? (
          <span style={{ color: "var(--critical)" }}>{money(r.unpaid)}</span>
        ) : (
          "0"
        ),
    },
    { key: "date", header: "Issued", sortValue: (r) => r.date, render: (r) => r.date || "—" },
    { key: "dueDate", header: "Due", sortValue: (r) => r.dueDate, render: (r) => r.dueDate || "—" },
  ];

  return (
    <section className="panel p-4">
      <div className="mb-3">
        <p className="eyebrow">daftra · invoices</p>
        <h2 className="text-lg font-semibold tracking-tight">
          Invoices <span className="num text-sm text-muted-foreground">{data?.total ?? "…"}</span>
          {isFetching && <span className="ml-2 text-xs text-muted-foreground">syncing…</span>}
        </h2>
      </div>

      {error ? (
        <p className="mb-3 text-sm" style={{ color: "var(--critical)" }}>
          Could not load invoices. {(error as Error).message}
        </p>
      ) : null}

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Kpi label="billed (page)" value={money(billed)} />
        <Kpi label="outstanding (page)" value={money(outstanding)} tone="var(--critical)" />
        <Kpi label="overdue (page)" value={String(overdue)} tone={overdue ? "var(--critical)" : undefined} />
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className="rounded-[var(--radius-xs)] border px-2.5 py-1 text-xs font-medium"
            style={
              filter === f.key
                ? { borderColor: "var(--primary)", color: "var(--primary)", backgroundColor: "var(--primary-soft)" }
                : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <EntityTable
        columns={columns}
        rows={rows}
        searchKeys={["no", "client"]}
        empty="No invoices match this filter."
      />
      <Pager page={data?.page ?? 1} pageCount={data?.pageCount ?? 1} onPage={setPage} />
    </section>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-border px-3 py-2">
      <p className="eyebrow">{label}</p>
      <p className="num text-base font-semibold" style={tone ? { color: tone } : undefined}>
        {value}
      </p>
    </div>
  );
}
