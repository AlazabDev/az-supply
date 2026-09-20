import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listDaftraClients } from "@/lib/daftra.functions";
import { EntityTable, Pager, type Column } from "@/components/daftra/EntityTable";
import { AddPartyForm } from "@/components/daftra/AddPartyForm";

interface ClientRow {
  id: string;
  number: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  createdAt: string;
}

const clientsOptions = (page: number) => ({
  queryKey: ["daftra", "clients", page],
  queryFn: () => listDaftraClients({ data: { page } }),
});

export const Route = createFileRoute("/_authenticated/clients")({
  loader: ({ context }) => context.queryClient.ensureQueryData(clientsOptions(1)),
  head: () => ({
    meta: [
      { title: "Clients | Meridian Control Tower" },
      {
        name: "description",
        content: "Live client list synced from the company's Daftra account, with search and instant add.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Clients | Meridian Control Tower" },
      { property: "og:description", content: "Live client list synced from the company's Daftra account, with search and instant add." },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const [page, setPage] = useState(1);
  const { data, isFetching } = useQuery({ ...clientsOptions(page), placeholderData: (p) => p });

  const columns: Column<ClientRow>[] = [
    { key: "number", header: "#", render: (r) => r.number || "—" },
    { key: "name", header: "Client", sortValue: (r) => r.name },
    { key: "email", header: "Email", render: (r) => r.email || "—" },
    { key: "phone", header: "Phone", render: (r) => r.phone || "—" },
    { key: "city", header: "City", render: (r) => r.city || "—" },
    { key: "createdAt", header: "Since", render: (r) => r.createdAt.slice(0, 10) },
  ];

  return (
    <section className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow">daftra · clients</p>
          <h2 className="text-lg font-semibold tracking-tight">
            Clients <span className="num text-sm text-muted-foreground">{data?.total ?? "…"}</span>
            {isFetching && <span className="ml-2 text-xs text-muted-foreground">syncing…</span>}
          </h2>
        </div>
        <AddPartyForm kind="clients" title="Add client" cta="Save client" />
      </div>
      <EntityTable columns={columns} rows={data?.rows ?? []} searchKeys={["name", "email", "phone", "number", "city"]} empty="No clients found." />
      <Pager page={data?.page ?? 1} pageCount={data?.pageCount ?? 1} onPage={setPage} />
    </section>
  );
}
