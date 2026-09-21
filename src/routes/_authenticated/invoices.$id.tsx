import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDaftraInvoice } from "@/lib/daftra.functions";
import { money, paymentState, stateColor, STATE_LABEL } from "@/lib/daftra.orders";

const invoiceOptions = (id: string) => ({
  queryKey: ["daftra", "invoice", id],
  queryFn: () => getDaftraInvoice({ data: { id } }),
});

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  head: () => ({
    meta: [
      { title: "Invoice detail | Meridian Control Tower" },
      {
        name: "description",
        content: "Full invoice breakdown: line items, taxes, payments received and remaining balance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Invoice detail | Meridian Control Tower" },
      {
        property: "og:description",
        content: "Line items, payments received and the remaining balance for a single invoice.",
      },
    ],
  }),
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useQuery(invoiceOptions(id));

  if (isLoading) return <section className="panel p-4 text-sm text-muted-foreground">Loading invoice…</section>;
  if (error || !data)
    return (
      <section className="panel p-4 text-sm" style={{ color: "var(--critical)" }}>
        Could not load this invoice. {(error as Error | null)?.message}
      </section>
    );

  const state = paymentState(data);

  return (
    <div className="space-y-2">
      <section className="panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">daftra · invoice</p>
            <h2 className="text-lg font-semibold tracking-tight">
              {data.no || `#${data.id}`}{" "}
              <span className="ml-1 text-sm font-medium" style={{ color: stateColor(state) }}>
                {STATE_LABEL[state]}
              </span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.client.name}
              {data.client.city ? ` · ${data.client.city}` : ""}
              {data.client.phone ? ` · ${data.client.phone}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link to="/invoices" className="panel px-3 py-1.5">
              Back to invoices
            </Link>
            {data.orderId ? (
              <Link to="/orders/$id" params={{ id: data.orderId }} className="panel px-3 py-1.5">
                Linked order
              </Link>
            ) : null}
            {data.pdfUrl ? (
              <a href={data.pdfUrl} target="_blank" rel="noreferrer" className="panel px-3 py-1.5">
                PDF
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="issued" value={data.date || "—"} />
          <Field label="due" value={data.dueDate || "—"} />
          <Field label="paid" value={money(data.paid, data.currency)} tone="var(--nominal)" />
          <Field
            label="outstanding"
            value={money(data.unpaid, data.currency)}
            tone={data.unpaid > 0 ? "var(--critical)" : undefined}
          />
        </div>
      </section>

      <section className="panel p-4">
        <h3 className="mb-2 text-sm font-semibold">Line items</h3>
        <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--surface-2)" }}>
                <Th>Description</Th>
                <Th right>Qty</Th>
                <Th right>Unit price</Th>
                <Th right>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    No line items on this invoice.
                  </td>
                </tr>
              ) : (
                data.items.map((it) => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="px-3 py-2">{it.description}</td>
                    <td className="num px-3 py-2 text-right">
                      {it.quantity}
                      {it.unit ? ` ${it.unit}` : ""}
                    </td>
                    <td className="num px-3 py-2 text-right">{money(it.unitPrice)}</td>
                    <td className="num px-3 py-2 text-right">{money(it.subtotal)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto mt-3 max-w-xs space-y-1 text-sm">
          <Total label="Subtotal" value={money(data.subtotal, data.currency)} />
          {data.discount ? <Total label="Discount" value={`- ${money(data.discount)}`} /> : null}
          {data.tax ? <Total label="Tax" value={money(data.tax)} /> : null}
          {data.shipping ? <Total label="Shipping" value={money(data.shipping)} /> : null}
          <Total label="Total" value={money(data.total, data.currency)} strong />
        </dl>
      </section>

      <section className="panel p-4">
        <h3 className="mb-2 text-sm font-semibold">Payments received</h3>
        {data.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.payments.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border px-3 py-2"
              >
                <span>
                  {p.date || "—"} · {p.method}
                  {p.transaction ? <span className="text-muted-foreground"> · {p.transaction}</span> : null}
                </span>
                <span className="num font-medium" style={{ color: "var(--nominal)" }}>
                  {money(p.amount, p.currency || data.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {data.notes ? (
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{data.notes}</p>
        ) : null}
      </section>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-border px-3 py-2">
      <p className="eyebrow">{label}</p>
      <p className="num text-base font-semibold" style={tone ? { color: tone } : undefined}>
        {value}
      </p>
    </div>
  );
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</dt>
      <dd className={`num ${strong ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}
