import { SCENARIOS, STAGE_LABEL, scenarioFamily, type Stage } from "@/lib/ct/data";
import type { ControlState } from "@/lib/ct/engine";
import { usd } from "@/lib/ct/format";


const LEVEL_VAR: Record<string, string> = {
  nominal: "var(--nominal)",
  caution: "var(--caution)",
  critical: "var(--critical)",
};

interface Props {
  active: string[];
  onToggle: (id: string) => void;
  onReset: () => void;
  state: ControlState;
  revealed: string[];
}

export function Simulator({ active, onToggle, onReset, state, revealed }: Props) {
  return (
    <div className="panel flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Disruption Simulator</h2>
          <p className="eyebrow mt-0.5">flip a switch · watch it ripple</p>
        </div>
        <button
          onClick={onReset}
          disabled={active.length === 0}
          className="num shrink-0 rounded-sm border border-border px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-35"
        >
          reset
        </button>
      </header>

      <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-1">
        {SCENARIOS.filter((s) => scenarioFamily(s) === "Logistics").map((s) => {
          const on = active.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => onToggle(s.id)}
              aria-pressed={on}
              className="group flex items-center gap-3 rounded-sm border px-3 py-2.5 text-left transition-all duration-300"
              style={{
                borderColor: on ? "var(--primary)" : "var(--border)",
                backgroundColor: on ? "var(--primary-soft)" : "transparent",
              }}
            >
              {/* physical rocker switch */}
              <span
                className="relative flex h-7 w-4 shrink-0 items-start rounded-[3px] border p-0.5 transition-colors"
                style={{
                  borderColor: on ? "var(--primary)" : "var(--border)",
                  backgroundColor: "var(--switch-well)",
                }}
              >
                <span
                  className="block h-3 w-full rounded-[2px] transition-transform duration-300 ease-out"
                  style={{
                    backgroundColor: on ? "var(--primary)" : "var(--input)",
                    transform: on ? "translateY(12px)" : "translateY(0)",
                  }}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block text-xs font-semibold leading-snug transition-colors"
                  style={{ color: on ? "var(--primary)" : "var(--foreground)" }}
                >
                  {s.label}
                </span>
                <span className="eyebrow block normal-case leading-snug tracking-normal">
                  {s.detail}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* trade policy — these move landed cost first and transit time as a consequence */}
      <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2 xl:grid-cols-1">
        {SCENARIOS.filter((s) => scenarioFamily(s) === "Trade policy").map((s) => {
          const on = active.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => onToggle(s.id)}
              aria-pressed={on}
              className="flex w-full items-center gap-3 rounded-sm border px-3 py-2 text-left transition-all duration-300"
              style={{
                borderColor: on ? "var(--signal)" : "var(--border)",
                backgroundColor: on ? "var(--surface-2)" : "transparent",
              }}
            >
              <span
                className="num shrink-0 rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-widest"
                style={{
                  borderColor: on ? "var(--signal)" : "var(--border)",
                  color: on ? "var(--signal)" : "var(--muted-foreground)",
                }}
              >
                +{Math.round(s.magnitude * 100)}%
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block text-xs font-semibold leading-snug"
                  style={{ color: on ? "var(--signal)" : "var(--foreground)" }}
                >
                  {s.label}
                </span>
                <span className="eyebrow block normal-case leading-snug tracking-normal">
                  {s.detail}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* recovery plays */}
      <div className="grid gap-2 px-3 pb-3">
        {SCENARIOS.filter((s) => scenarioFamily(s) === "Recovery plays").map((s) => {
          const on = active.includes(s.id);
          const play = state.plays.find((p) => p.id === s.id);
          return (
            <button
              key={s.id}
              onClick={() => onToggle(s.id)}
              aria-pressed={on}
              className="flex w-full items-center gap-3 rounded-sm border border-dashed px-3 py-2 text-left transition-all duration-300"
              style={{
                borderColor: on ? "var(--nominal)" : "var(--border)",
                backgroundColor: on ? "var(--surface-2)" : "transparent",
              }}
            >
              <span
                className="num shrink-0 rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-widest"
                style={{
                  borderColor: on ? "var(--nominal)" : "var(--border)",
                  color: on ? "var(--nominal)" : "var(--muted-foreground)",
                }}
              >
                {s.kind === "expedite-air" ? "air" : "src"}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block text-xs font-semibold leading-snug"
                  style={{ color: on ? "var(--nominal)" : "var(--foreground)" }}
                >
                  {s.label}
                </span>
                <span className="eyebrow block normal-case leading-snug tracking-normal">
                  {s.detail}
                </span>
                {/* only pre-departure freight is actionable — say so rather than doing less silently */}
                {on && play && (
                  <span
                    className="num mt-1 block text-[10px] leading-snug"
                    style={{
                      color:
                        play.found < play.requested ? "var(--caution)" : "var(--muted-foreground)",
                    }}
                  >
                    {play.found}/{play.requested} eligible pre-departure loads
                    {play.found < play.requested ? " — options ran out" : ""}
                    {play.stranded > 0 && (
                      <>
                        {" · "}
                        {play.stranded} already sailed, {usd(play.strandedCash)} locked in
                      </>
                    )}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* order book: what is sailing versus what is still in play */}
      <div className="border-t border-border px-4 py-2.5">
        <div className="flex items-center justify-between">
          <p className="eyebrow">order book</p>
          <p className="num text-[10px] text-muted-foreground">{state.shipments.length} loads</p>
        </div>
        <ul className="mt-1.5 space-y-1">
          {(["transit", "booked", "planned"] as Stage[]).map((st) => {
            const rows = state.shipments.filter((s) => s.stage === st);
            const duty = rows.reduce((a, s) => a + s.dutyCost, 0);
            return (
              <li key={st} className="flex items-center gap-2 text-[11px]">
                <span
                  className={
                    st === "transit"
                      ? "flex-1 font-semibold"
                      : st === "booked"
                        ? "flex-1"
                        : "flex-1 italic text-muted-foreground"
                  }
                >
                  {STAGE_LABEL[st]}
                </span>
                <span className="num w-8 text-right text-muted-foreground">{rows.length}</span>
                <span className="num w-16 text-right tabular-nums">{usd(duty)}</span>
              </li>
            );
          })}
        </ul>
      </div>


      <div className="mt-auto border-t border-border">
        <div className="flex items-center justify-between px-4 py-2">
          <p className="eyebrow">projected stockouts</p>
          <p className="num text-[10px] text-muted-foreground">
            {state.stockouts.length} skus &lt; 26d
          </p>
        </div>
        <ul className="max-h-[248px] space-y-px overflow-y-auto px-2 pb-2">
          {state.stockouts.map((s, i) => {
            const revealedNode = revealed.includes(s.warehouseId);
            const shift = revealedNode ? s.days : s.baseDays;
            const level = revealedNode ? s.level : "nominal";
            const pulled = revealedNode && s.days < s.baseDays;
            return (
              <li
                key={s.sku + s.warehouseId}
                className="flex items-center gap-2.5 rounded-sm px-2 py-1.5 transition-colors duration-500"
                style={{
                  backgroundColor: pulled ? "var(--surface-2)" : "transparent",
                  animation: `ct-rise .4s ease-out ${i * 0.045}s both`,
                }}
              >
                <span
                  className="size-1.5 shrink-0 rounded-full transition-colors duration-500"
                  style={{ backgroundColor: LEVEL_VAR[level] }}
                />
                <span className="num w-9 shrink-0 text-[10px] text-muted-foreground">{s.code}</span>
                <span className="min-w-0 flex-1 truncate text-[11px]">{s.name}</span>
                <span className="num text-[10px] text-muted-foreground">{s.zone}</span>
                <span
                  className="num w-14 shrink-0 text-right text-[11px] font-semibold tabular-nums transition-colors duration-500"
                  style={{ color: LEVEL_VAR[level] }}
                >
                  {shift}d
                  {pulled && (
                    <span className="ml-0.5 text-[9px] opacity-70">
                      ↓{s.baseDays - s.days}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
