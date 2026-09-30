import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const threadsQuery = {
  queryKey: ["ai-threads"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("ai_threads")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  },
};

export function useCreateThread() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function create() {
    setBusy(true);
    setError(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setBusy(false);
    const { data, error } = await supabase
      .from("ai_threads")
      .insert({ user_id: u.user.id })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) return setError("تعذر إنشاء محادثة");
    await qc.invalidateQueries({ queryKey: ["ai-threads"] });
    navigate({ to: "/assistant/$threadId", params: { threadId: data.id } });
  }
  return { create, busy, error };
}

export function AssistantMark({ className = "size-9" }: { className?: string }) {
  return (
    <div
      className={`grid place-items-center rounded-[var(--radius-sm)] border ${className}`}
      style={{ borderColor: "var(--primary)", backgroundColor: "var(--primary-soft)" }}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="var(--primary)" strokeWidth="1.6">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h5M8 16h3" />
        <circle cx="16.5" cy="15.5" r="2.5" />
        <path d="M18.3 17.3 20 19" />
      </svg>
    </div>
  );
}

export function ThreadList({ activeId }: { activeId?: string }) {
  const { data, isLoading } = useQuery(threadsQuery);
  const { create, busy, error } = useCreateThread();
  return (
    <aside className="panel flex flex-col gap-2 p-3">
      <button
        type="button"
        onClick={create}
        disabled={busy}
        className="rounded-[var(--radius-sm)] px-3 py-2 text-sm font-semibold"
        style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        {busy ? "جارٍ الإنشاء…" : "+ سؤال جديد"}
      </button>
      {error && <p className="text-xs" style={{ color: "var(--critical)" }}>{error}</p>}
      <p className="eyebrow mt-2">المحادثات السابقة</p>
      <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
        {isLoading && <p className="text-xs text-muted-foreground">جارٍ التحميل…</p>}
        {data?.length === 0 && <p className="text-xs text-muted-foreground">لا توجد محادثات بعد.</p>}
        {data?.map((t) => (
          <Link
            key={t.id}
            to="/assistant/$threadId"
            params={{ threadId: t.id }}
            className="truncate rounded-[var(--radius-xs)] px-2 py-1.5 text-sm"
            style={
              t.id === activeId
                ? { color: "var(--primary)", backgroundColor: "var(--primary-soft)" }
                : { color: "var(--muted-foreground)" }
            }
          >
            {t.title}
          </Link>
        ))}
      </div>
    </aside>
  );
}
