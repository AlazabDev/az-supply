import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface Props {
  title: string;
  cta: string;
  queryKeyPrefix: string;
  action: (input: {
    businessName?: string;
    email?: string;
    phone?: string;
    city?: string;
    notes?: string;
  }) => Promise<{ id: string | null }>;
}

/** Shared "add a client / supplier" form — writes straight to Daftra. */
export function AddPartyForm({ title, cta, queryKeyPrefix, action }: Props) {
  const run = useServerFn(action);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: run,
    onSuccess: async () => {
      setError(null);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["daftra", queryKeyPrefix] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to save."),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutation.mutate({
      businessName: String(fd.get("businessName") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      city: String(fd.get("city") ?? ""),
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-semibold"
        style={{ backgroundColor: "var(--primary-soft)", color: "var(--primary)" }}
      >
        + {title}
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="panel mb-3 space-y-3 p-4">
      <p className="eyebrow">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow">name *</span>
          <input
            name="businessName"
            required
            maxLength={200}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
          />
        </label>
        <label className="block">
          <span className="eyebrow">email</span>
          <input
            name="email"
            type="email"
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
          />
        </label>
        <label className="block">
          <span className="eyebrow">phone</span>
          <input
            name="phone"
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
          />
        </label>
        <label className="block">
          <span className="eyebrow">city</span>
          <input
            name="city"
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
          />
        </label>
      </div>
      {error && (
        <p className="text-sm" style={{ color: "var(--critical)" }}>
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-[var(--radius-sm)] px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground, #fff)" }}
        >
          {mutation.isPending ? "Saving…" : cta}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-[var(--radius-sm)] border border-border px-4 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
