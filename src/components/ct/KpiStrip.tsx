import { useEffect, useRef, useState } from "react";
import type { ControlState } from "@/lib/ct/engine";
import { usd } from "@/lib/ct/format";

function useCountUp(target: number, decimals: number) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 620);
      const e = 1 - Math.pow(1 - k, 3);
      setV(Number((a + (target - a) * e).toFixed(decimals)));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, decimals]);
  return v;
}

interface Metric {
  label: string;
  value: number;
  decimals: number;
  suffix: string;
  target: string;
  good: "up" | "down";
  baseline: number;
  /** Denominator for the meter fill; defaults to the metric's own natural ceiling. */
  scale?: number;
  /** Render the value with an explicit +/- (used for variance metrics). */
  signed?: boolean;
  /** Suppress the delta chip when the value already *is* the delta. */
  hideDelta?: boolean;
  /** Render value and delta as compact USD rather than a plain numeral. */
  money?: boolean;
}

function Cell({ m }: { m: Metric }) {
  const v = useCountUp(m.value, m.decimals);
  const delta = Number((m.value - m.baseline).toFixed(m.decimals));
  const bad = m.good === "up" ? delta < 0 : delta > 0;
  const color =
    delta === 0 ? "var(--muted-foreground)" : bad ? "var(--critical)" : "var(--nominal)";
  const pct = Math.min(1, Math.abs(m.value) / (m.scale ?? (m.good === "up" ? 100 : 40)));
  const sign = m.signed && v > 0 ? "+" : "";

  return (
    <div className="panel relative flex-1 overflow-hidden px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="eyebrow">{m.label}</p>
        {delta !== 0 && !m.hideDelta && (
          <span className="num text-[10px] font-semibold" style={{ color }}>
            {delta > 0 ? "▲" : "▼"}{" "}
            {m.money ? usd(Math.abs(delta)) : Math.abs(delta).toFixed(m.decimals)}
          </span>
        )}
      </div>
      <p
        className="num mt-1.5 text-3xl font-semibold leading-none tracking-tight"
        style={{ color: bad ? "var(--critical)" : "var(--foreground)" }}
      >
        {sign}
        {m.money ? usd(v) : v.toFixed(m.decimals)}
        <span className="ml-0.5 text-base text-muted-foreground">{m.suffix}</span>
      </p>
      <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct * 100}%`,
            backgroundColor: bad ? "var(--critical)" : "var(--primary)",
          }}
        />
      </div>
      <p className="num mt-1.5 text-[10px] text-muted-foreground">{m.target}</p>
    </div>
  );
}

export function KpiStrip({ state, baseline }: { state: ControlState; baseline: ControlState }) {
  const metrics: Metric[] = [
    {
      label: "on-time delivery",
      value: state.kpis.onTime,
      baseline: baseline.kpis.onTime,
      decimals: 1,
      suffix: "%",
      target: "target 95.0% · rolling 30d",
      good: "up",
    },
    {
      label: "cash due",
      value: state.kpis.cashDue,
      baseline: baseline.kpis.cashDue,
      decimals: 0,
      suffix: "",
      target: `duty + MPF + HMF · peak week ${usd(state.kpis.cashPeakWeek)}`,
      good: "down",
      scale: baseline.kpis.cashDue * 1.8,
      money: true,
    },
    {
      label: "landed cost",
      /* the tile reports variance, so the value IS the delta — baseline is 0 by definition */
      value: Number(((state.kpis.landedCost / baseline.kpis.landedCost - 1) * 100).toFixed(1)),
      baseline: 0,
      decimals: 1,
      suffix: "%",
      target: `vs baseline · duty exposure ${usd(state.kpis.dutyExposure)}`,
      good: "down",
      scale: 25,
      signed: true,
      hideDelta: true,
    },
    {
      label: "open exceptions",
      value: state.kpis.exceptions,
      baseline: baseline.kpis.exceptions,
      decimals: 0,
      suffix: "",
      target: "shipment + zone alerts",
      good: "down",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {metrics.map((m) => (
        <Cell key={m.label} m={m} />
      ))}
    </div>
  );
}
