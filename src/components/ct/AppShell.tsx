import { ThemeToggle } from "@/components/ct/ThemeToggle";
import { useControl } from "@/components/ct/ControlProvider";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useControl();
  const criticalShipments = state.shipments.filter((s) => s.level === "critical").length;

  const posture =
    state.kpis.exceptions > 22
      ? { label: "Degraded", color: "var(--critical)" }
      : state.kpis.exceptions > 14
        ? { label: "Watch", color: "var(--caution)" }
        : { label: "Stable", color: "var(--nominal)" };

  return (
    <div className="relative z-10 min-h-screen">
      <header
        className="relative z-30 border-b border-border backdrop-blur-md"
        style={{ backgroundColor: "var(--header-bg)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <div
              className="grid size-9 place-items-center rounded-[var(--radius-sm)] border"
              style={{ borderColor: "var(--primary)", backgroundColor: "var(--primary-soft)" }}
            >
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="1.6"
              >
                <path d="M12 2v20M2 12h20" strokeOpacity="0.45" />
                <circle cx="12" cy="12" r="4.5" />
                <circle cx="12" cy="12" r="9" strokeOpacity="0.5" strokeDasharray="2 4" />
              </svg>
            </div>
            <div>
              <h1 className="text-[15px] font-semibold leading-none tracking-tight">
                Shipping &amp; logistics simulator
              </h1>
              <p className="eyebrow mt-1">
                Meridian Freight &amp; Fulfillment · western region · 4 DC
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-xs text-muted-foreground">Network posture</span>
              <span
                className="rounded-[var(--radius-sm)] border px-2 py-1 text-xs font-medium"
                style={{
                  color: posture.color,
                  borderColor: posture.color,
                  backgroundColor: "var(--surface-2)",
                }}
              >
                {posture.label}
              </span>
            </div>
            <div className="panel px-3 py-1.5">
              <p className="eyebrow">critical shipments</p>
              <p
                className="num text-lg font-semibold leading-tight"
                style={{ color: "var(--critical)" }}
              >
                {criticalShipments}
                <span className="text-xs text-muted-foreground">/{state.shipments.length}</span>
              </p>
            </div>
            <ThemeToggle />
          </div>
        </div>

      </header>

      <main className="space-y-2 p-2 lg:p-3">
        <p className="flex flex-wrap items-center gap-x-2 px-1 pt-1 text-xs text-muted-foreground">
          <span>Flip a scenario, watch the inbound network react.</span>
          <span className="text-border">·</span>
          <span>
            <span className="num">{state.activeScenarios.length}</span> scenario
            {state.activeScenarios.length === 1 ? "" : "s"} active
          </span>
        </p>
        {children}

        <footer className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2 pt-1">
          <p className="text-xs text-muted-foreground">
            Fictional demo dataset · <span className="num">41</span> in transit ·{" "}
            <span className="num">72</span> forward book ·{" "}

            <span className="num">12</span> suppliers · <span className="num">200</span> SKUs
          </p>
          <p className="text-xs text-muted-foreground">
            demo dataset · seed <span className="num">20260723</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
