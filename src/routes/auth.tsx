import { useState } from "react";
import { createFileRoute, useRouter, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in | Meridian Control Tower" },
      {
        name: "description",
        content:
          "Sign in to view live Daftra data — clients, invoices, suppliers and inventory — inside the Meridian control tower.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Sign in | Meridian Control Tower" },
      {
        property: "og:description",
        content:
          "Sign in to view live Daftra data — clients, invoices, suppliers and inventory — inside the Meridian control tower.",
      },
    ],
  }),
  component: AuthPage,
});

/** Same-origin relative path only; anything else falls back to /suppliers. */
function safeRedirect(raw?: string): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("://")) return raw;
  return "/suppliers";
}

function AuthPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const redirect = safeRedirect(Route.useSearch().redirect);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        if (!data.session) {
          setInfo("Account created — check your email to confirm, then sign in.");
          setMode("signin");
        } else {
          await navigate({ to: redirect, replace: true });
          router.invalidate();
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        await navigate({ to: redirect, replace: true });
        router.invalidate();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) setError(result.error.message);
    if (result.redirected) return;
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4">
      <div className="panel p-6">
        <p className="eyebrow">restricted area</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Live Daftra data is protected. Sign in to continue.
        </p>

        <div className="mt-4 flex gap-1 rounded-[var(--radius-sm)] border border-border p-1 text-sm">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
                setInfo(null);
              }}
              className="flex-1 rounded-[var(--radius-xs)] px-3 py-1.5 font-medium transition-colors"
              style={
                mode === m
                  ? { backgroundColor: "var(--primary-soft)", color: "var(--primary)" }
                  : { color: "var(--muted-foreground)" }
              }
            >
              {m === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="eyebrow">email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            />
          </label>
          <label className="block">
            <span className="eyebrow">password</span>
            <input
              name="password"
              type="password"
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            />
          </label>

          {error && (
            <p className="text-sm" style={{ color: "var(--critical)" }}>
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm" style={{ color: "var(--nominal)" }}>
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-[var(--radius-sm)] px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground, #fff)" }}
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>
        <button
          type="button"
          onClick={onGoogle}
          className="w-full rounded-[var(--radius-sm)] border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
