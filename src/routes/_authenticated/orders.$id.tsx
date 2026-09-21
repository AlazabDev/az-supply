import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDaftraOrder } from "@/lib/daftra.functions";
import { isPast, money, paymentState, stateColor, STATE_LABEL } from "@/lib/daftra.orders";

const orderOptions = (id: string) => ({
  queryKey: ["daftra", "order", id],
  queryFn: () => getDaftraOrder({ data: { id } }),
});

export const Route = createFileRoute("/_authenticated/orders/$id")({
  head: () => ({
    meta: [
      { title: "Order detail | Meridian Control Tower" },
      {
        name: "description",
        content: "Single order progress: client, delivery date, contracted value and every invoice raised against it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Order detail | Meridian Control Tower" },
      {
        property: "og:description",
        content: "Client, delivery date, contracted value and invoicing progress for one order.",
      },
    ],
  }),
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useQuery(orderOptions(id));

  if (isLoading) return <section className="panel p-4 text-sm text-muted-foreground">Loading order…</section>;
  if (error || !data)
    return (
      <section className="panel p-4 text-sm" style={{ color: "var(--critical)" }}>
        Could not load this order. {(error as Error | null)?.message}
      </section>
    );

  const invoiced = data.invoices.reduce((s, i) => s + i.total, 0);
  const collected = data.invoices.reduce((s, i) => s + i.paid, 0);
  const outstanding = data.invoices.reduce((s, i) => s + i.unpaid, 0);
  const progress = data.budget > 0 ? Math.min(100, Math.round((invoiced / data.budget) * 100)) : 0;

  return (
    <div className="space-y-2">
      <section className="panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">daftra · order</p>
            <h2 className="text-lg font-semibold tracking-tight">
              {data.number} <span className="text-sm font-normal text-muted-foreground">{data.title}</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.client.name}
              {data.client.city ? ` · ${data.client.city}` : ""}
              {data.client.phone ? ` · ${data.client.phone}` : ""}
            </p>
          </div>
          <Link to="/orders" className="panel px-3 py-1.5 text-xs">
            Back to orders
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="start" value={data.startDate || "—"} />
          <Field
            label="delivery"
            value={data.deliveryDate || "—"}
            tone={data.deliveryDate && isPast(data.deliveryDate) ? "var(--critical)" : undefined}
          />
          <Field label="contracted" value={data.budget ? money(data.budget, data.currency) : "—"} />
          <Field
            label="outstanding"
            value={money(outstanding, data.currency)}
            tone={outstanding > 0 ? "var(--critical)" : undefined}
          />
        </div>

        {data.budget > 0 ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>invoiced {money(invoiced, data.currency)}</span>
              <span className="num">{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-2)" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${progress}%`, backgroundColor: "var(--primary)" }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              collected {money(collected, data.currency)} of {money(invoiced, data.currency)} invoiced
            </p>
          </div>
        ) : null}
      </section>

      <section className="panel p-4">
        <h3 className="mb-2 text-sm font-semibold">Invoices on this order</h3>
        {data.invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices raised against this order yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.invoices.map((inv) => {
              const state = paymentState(inv);
              return (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border px-3 py-2"
                >
                  <Link
                    to="/invoices/$id"
                    params={{ id: inv.id }}
                    className="font-medium underline-offset-2 hover:underline"
                    style={{ color: "var(--primary)" }}
                  >
                    {inv.no || `#${inv.id}`}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {inv.date || "—"}
                    {inv.dueDate ? ` · due ${inv.dueDate}` : ""}
                  </span>
                  <span className="text-xs font-medium" style={{ color: stateColor(state) }}>
                    {STATE_LABEL[state]}
                  </span>
                  <span className="num font-medium">{money(inv.total, inv.currency)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {data.description ? (
        <section className="panel p-4">
          <h3 className="mb-2 text-sm font-semibold">Scope</h3>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{data.description}</p>
        </section>
      ) : null}
    </div>
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
