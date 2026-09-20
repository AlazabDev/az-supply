import { useEffect, useMemo, useRef, useState } from "react";
import { PORTS } from "@/lib/ct/data";
import { LAND_PATHS, COUNTRY_BORDERS, STATE_BORDERS, GRATICULE } from "@/lib/ct/geo";
import type { ControlState, ResolvedShipment } from "@/lib/ct/engine";

/* Leader-line label offsets — the real-geography western-US cluster is tight,
   so each node's callout is pushed clear of its neighbours. */
const WH_LABEL: Record<string, [number, number]> = {
  oak: [-62, -26],
  rno: [-12, -44],
  slc: [30, -38],
  phx: [-18, 44],
};

const PORT_LABEL: Record<string, [number, number]> = {
  oakp: [-52, 18],
  lax: [-34, 34],
  sea: [-34, -18],
  den: [16, -14],
  dfw: [-6, 20],
};

/* Mode reads through geometry + motion, never colour — colour stays risk-only. */
export type Mode = "ocean" | "air" | "rail" | "road";
export const MODES: Mode[] = ["ocean", "air", "rail", "road"];
const MODE_SPEC: Record<Mode, { dash: string; speed: number; marker: "dot" | "diamond" | "square" }> = {
  ocean: { dash: "4 7", speed: 0.021, marker: "dot" },
  air: { dash: "1 6", speed: 0.052, marker: "diamond" },
  rail: { dash: "8 4", speed: 0.032, marker: "square" },
  road: { dash: "2 4", speed: 0.038, marker: "dot" },
};

const W = 1000;
const H = 620;

const LEVEL_VAR: Record<string, string> = {
  nominal: "var(--nominal)",
  caution: "var(--caution)",
  critical: "var(--critical)",
};

interface Props {
  state: ControlState;
  rippleKey: number;
  revealed: string[];
  visibleModes: Mode[];
  onToggleMode: (m: Mode) => void;
}

export function NetworkMap({ state, rippleKey, revealed, visibleModes, onToggleMode }: Props) {
  const { warehouses } = state;
  /**
   * The map draws freight that is actually moving. Pre-departure loads in the forward
   * book have no position on a lane yet, so rendering them as dots would be fiction —
   * they are reported as a book split in the simulator panel instead.
   */
  const shipments = state.shipments.filter((s) => s.stage === "transit");
  const forwardBook = state.shipments.length - shipments.length;

  const pathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const dotRefs = useRef<Record<string, SVGGElement | null>>({});
  const progress = useRef<Record<string, number>>({});
  const [hover, setHover] = useState<{ s: ResolvedShipment; x: number; y: number } | null>(null);

  /* Motion discipline: the map is static at rest. `rippling` is true only for the
     few seconds after a scenario is toggled, and it is the sole gate on the
     node pulse and the running route dashes. */
  const [rippling, setRippling] = useState(false);
  useEffect(() => {
    if (!rippleKey) return;
    setRippling(true);
    const t = setTimeout(() => setRippling(false), 5200);
    return () => clearTimeout(t);
  }, [rippleKey]);



  /* ---- pan / zoom (viewport transform in SVG user space) ---- */
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  const K_MIN = 0.45;
  const K_MAX = 8;

  const clamp = (v: { k: number; x: number; y: number }) => {
    const k = Math.min(K_MAX, Math.max(K_MIN, v.k));
    // pan range: at k>1 the map is larger than the frame (bounds are negative);
    // at k<=1 it is smaller, so it may slide anywhere inside the frame.
    const bx = W * (1 - k);
    const by = H * (1 - k);
    // a little slack at k === 1 so dragging still feels responsive
    const pad = k <= 1 ? 0.18 * W : 0;
    return {
      k,
      x: Math.max(Math.min(0, bx) - pad, Math.min(Math.max(0, bx) + pad, v.x)),
      y: Math.max(Math.min(0, by) - pad, Math.min(Math.max(0, by) + pad, v.y)),
    };
  };


  /** zoom about a point given in SVG user space */
  const zoomAt = (factor: number, sx: number, sy: number) => {
    setView((v) => {
      const k = Math.min(K_MAX, Math.max(K_MIN, v.k * factor));
      const wx = (sx - v.x) / v.k;
      const wy = (sy - v.y) / v.k;
      return clamp({ k, x: sx - wx * k, y: sy - wy * k });
    });
  };

  /** SVG uses preserveAspectRatio="slice", so map client px -> viewBox units by the larger scale. */
  const viewScale = (r: DOMRect) => Math.max(r.width / W, r.height / H);
  const toView = (r: DOMRect, cx: number, cy: number) => {
    const s = viewScale(r);
    return {
      x: (cx - r.left - (r.width - W * s) / 2) / s,
      y: (cy - r.top - (r.height - H * s) / 2) / s,
    };
  };


  // frame size drives the HTML overlay math (SVG is "slice"-scaled)
  const [frame, setFrame] = useState({ w: W, h: H });
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setFrame({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // wheel zoom needs a non-passive native listener to stop page scroll

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const p = toView(r, e.clientX, e.clientY);
      zoomAt(Math.exp(-e.deltaY * 0.0018), p.x, p.y);

    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const byId = useMemo(
    () => Object.fromEntries(shipments.map((s) => [s.id, s])) as Record<string, ResolvedShipment>,
    [shipments],
  );

  // Animated dot transport along each route (rAF, direct DOM writes — no re-renders)
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const lengths: Record<string, number> = {};

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (const s of shipments) {
        const p = pathRefs.current[s.id];
        const g = dotRefs.current[s.id];
        if (!p || !g) continue;
        if (lengths[s.id] === undefined) lengths[s.id] = p.getTotalLength();
        const len = lengths[s.id];
        if (!len) continue;
        if (progress.current[s.id] === undefined) progress.current[s.id] = s.progress;
        const spec = MODE_SPEC[s.mode as Mode];
        const speed = s.frozen ? 0 : spec.speed / (1 + s.addedDays * 0.16);
        progress.current[s.id] = (progress.current[s.id] + speed * dt) % 1;
        const pt = p.getPointAtLength(progress.current[s.id] * len);
        g.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [shipments]);

  return (
    <div className="panel relative flex flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Inbound Network</h2>
          <span className="text-xs text-muted-foreground">
            <span className="num">
              {shipments.filter((s) => visibleModes.includes(s.mode as Mode)).length}
            </span>
            /<span className="num">{shipments.length}</span> in transit ·{" "}
            <span className="num">{forwardBook}</span> in forward book
          </span>

          <div className="flex items-center gap-1">
            {MODES.map((m) => {
              const on = visibleModes.includes(m);
              const n = shipments.filter((s) => s.mode === m).length;
              return (
                <button
                  key={m}
                  onClick={() => onToggleMode(m)}
                  aria-pressed={on}
                  className="chip px-2 py-1 capitalize"
                >
                  {m} <span className="num">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {(["nominal", "caution", "critical"] as const).map((l) => (
            <span key={l} className="flex items-center gap-1.5 text-xs capitalize text-muted-foreground">
              <i
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: LEVEL_VAR[l] }}
              />
              {l}
            </span>
          ))}
        </div>
      </header>


      <div
        ref={frameRef}
        className="relative min-h-0 w-full flex-1 touch-none overflow-hidden [aspect-ratio:1000/620] xl:aspect-auto"
      >
        <svg
          viewBox="0 0 1000 620"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 size-full"

          style={{ cursor: dragging ? "grabbing" : "grab" }}
          onMouseLeave={() => {
            setHover(null);
            drag.current = null;
            setDragging(false);
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            drag.current = { px: e.clientX, py: e.clientY, moved: false };
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const r = frameRef.current?.getBoundingClientRect();
            if (!r) return;
            const sc = viewScale(r);
            const dx = (e.clientX - d.px) / sc;
            const dy = (e.clientY - d.py) / sc;

            if (Math.abs(dx) + Math.abs(dy) > 1) {
              d.moved = true;
              setHover(null);
            }
            d.px = e.clientX;
            d.py = e.clientY;
            setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }));
          }}
          onPointerUp={() => {
            drag.current = null;
            setDragging(false);
          }}
          onDoubleClick={(e) => {
            const r = frameRef.current?.getBoundingClientRect();
            if (!r) return;
            const p = toView(r, e.clientX, e.clientY);
            zoomAt(1.8, p.x, p.y);

          }}
        >
          <defs>
            <linearGradient id="ct-land" x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0%" stopColor="var(--map-land-a)" stopOpacity="0.95" />
              <stop offset="100%" stopColor="var(--map-land-b)" stopOpacity="0.8" />
            </linearGradient>

            <pattern id="ct-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0 H0 V40" fill="none" stroke="var(--hairline)" strokeWidth="0.7" />
            </pattern>
            <filter id="ct-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>

          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <rect width="1000" height="620" fill="url(#ct-grid)" opacity="0.4" />

          {/* graticule */}
          <g fill="none" stroke="var(--hairline)" strokeWidth="0.7">
            {GRATICULE.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>

          {/* static range rings */}
          <g transform="translate(120 300)" opacity="0.5">
            <circle r="640" fill="none" stroke="var(--hairline)" strokeWidth="0.8" />
            <circle r="420" fill="none" stroke="var(--hairline)" strokeWidth="0.8" />
            <circle r="220" fill="none" stroke="var(--hairline)" strokeWidth="0.8" />
          </g>

          {/* real coastlines — Natural Earth 110m, Mercator (Pacific-centred) */}
          <g>
            {LAND_PATHS.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="url(#ct-land)"
                stroke="var(--signal)"
                strokeOpacity="0.5"
                strokeWidth="0.8"
              />
            ))}
            <path d={COUNTRY_BORDERS} fill="none" stroke="var(--signal)" strokeOpacity="0.22" strokeWidth="0.7" />
            <path d={STATE_BORDERS} fill="none" stroke="var(--signal)" strokeOpacity="0.16" strokeWidth="0.6" />
          </g>

          {/* routes */}
          <g fill="none">
            {shipments.map((s) => {
              const c = LEVEL_VAR[s.level];
              const shown = visibleModes.includes(s.mode as Mode);
              const hovered = hover?.s.id === s.id;
              return (
                <g key={s.id}>
                  <path
                    ref={(el) => {
                      pathRefs.current[s.id] = el;
                    }}
                    d={s.path}
                    stroke={c}
                    strokeOpacity={!shown ? 0.05 : hovered ? 0.85 : s.impacted ? 0.45 : 0.24}
                    strokeWidth={!shown ? 0.5 : hovered ? 1.6 : 0.9}
                    strokeDasharray={MODE_SPEC[s.mode as Mode].dash}
                    /* arcs are parked at rest — the lane only "runs" while it is
                       impacted by a live scenario, or while the operator hovers it */
                    className={shown && ((s.impacted && rippling) || hovered) ? "animate-dash" : undefined}
                    style={{ transition: "stroke-opacity .35s, stroke-width .35s, stroke .5s" }}
                  />

                  {s.impacted && shown && (
                    <path
                      key={`${s.id}-${rippleKey}`}
                      d={s.path}
                      stroke={c}
                      strokeWidth="3"
                      strokeOpacity="0.5"
                      filter="url(#ct-soft)"
                      className="animate-flash"
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* ports */}
          <g>
            {PORTS.map((p) => (
              <g key={p.id} transform={`translate(${p.x} ${p.y})`}>
                <rect
                  x="-4"
                  y="-4"
                  width="8"
                  height="8"
                  fill="none"
                  stroke="var(--signal)"
                  strokeOpacity="0.8"
                  strokeWidth="1.2"
                />
                <circle r="1.6" fill="var(--signal)" />
                {PORT_LABEL[p.id] && (
                  <line
                    x1="0"
                    y1="0"
                    x2={PORT_LABEL[p.id][0]}
                    y2={PORT_LABEL[p.id][1]}
                    stroke="var(--signal)"
                    strokeOpacity="0.35"
                    strokeWidth="0.6"
                  />
                )}
                <text
                  x={PORT_LABEL[p.id] ? PORT_LABEL[p.id][0] : 9}
                  y={PORT_LABEL[p.id] ? PORT_LABEL[p.id][1] + 3 : 3}
                  textAnchor={
                    PORT_LABEL[p.id] ? (PORT_LABEL[p.id][0] < 0 ? "end" : "start") : "start"
                  }
                  className="num"
                  fontSize="9.5"
                  fill="var(--muted-foreground)"
                  letterSpacing="0.1em"
                >
                  {p.short}
                </text>
              </g>
            ))}
          </g>

          {/* warehouse nodes */}
          <g>
            {warehouses.map((w) => {
              const shown = revealed.includes(w.id);
              const level = shown ? w.level : "nominal";
              const c = LEVEL_VAR[level];
              const hot = level !== "nominal";
              return (
                <g key={w.id} transform={`translate(${w.x} ${w.y})`}>
                  {/* Ripple only. Both elements remount on rippleKey/level change, run a
                      finite pulse, then hold still — nodes at rest never animate. */}
                  {hot && rippling && (
                    <circle
                      key={`ping-${w.id}-${level}-${rippleKey}`}
                      r="6"
                      fill="none"
                      stroke={c}
                      className="animate-ping-finite"
                    />
                  )}
                  <circle
                    r={hot ? 11 : 8.5}
                    fill="none"
                    stroke={c}
                    strokeOpacity={hot ? 0.45 : 0}
                    strokeWidth="1"
                    style={{ transition: "stroke .6s ease, stroke-opacity .6s ease, r .4s ease" }}
                  />
                  <circle
                    r="8.5"
                    fill="var(--panel)"
                    stroke={c}
                    strokeWidth="2"
                    style={{ transition: "stroke .6s ease" }}
                  />
                  <circle
                    r={hot ? 4 : 3.2}
                    fill={c}
                    style={{ transition: "fill .6s ease, r .4s ease" }}
                  />

                  <line
                    x1="0"
                    y1="0"
                    x2={WH_LABEL[w.id][0]}
                    y2={WH_LABEL[w.id][1]}
                    stroke={c}
                    strokeOpacity="0.5"
                    strokeWidth="0.7"
                    style={{ transition: "stroke .6s ease" }}
                  />
                  <g transform={`translate(${WH_LABEL[w.id][0]} ${WH_LABEL[w.id][1]})`}>
                    <text
                      textAnchor={WH_LABEL[w.id][0] < 0 ? "end" : "start"}
                      className="num"
                      fontSize="11"
                      fontWeight="600"
                      fill="var(--foreground)"
                      letterSpacing="0.08em"
                    >
                      {w.code}
                    </text>
                    <text
                      y="12"
                      textAnchor={WH_LABEL[w.id][0] < 0 ? "end" : "start"}
                      className="num"
                      fontSize="9"
                      fill={c}
                      style={{ transition: "fill .6s ease" }}
                    >
                      {w.stockoutInDays && shown ? `SO ${w.stockoutInDays}d` : `${w.daysOfCover}d cover`}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>

          {/* moving shipment dots */}
          <g>
            {shipments.map((s) => {
              const c = LEVEL_VAR[s.level];
              const active = hover?.s.id === s.id;
              const spec = MODE_SPEC[s.mode as Mode];
              const shown = visibleModes.includes(s.mode as Mode);
              return (
                <g
                  key={s.id}
                  style={{ opacity: shown ? 1 : 0, transition: "opacity .4s" }}
                  pointerEvents={shown ? "auto" : "none"}
                  ref={(el) => {
                    dotRefs.current[s.id] = el;
                  }}
                >
                  {active && <circle r="6.5" fill={c} opacity={0.3} filter="url(#ct-soft)" />}
                  {spec.marker === "diamond" ? (
                    <rect
                      x={active ? -4 : -2.9}
                      y={active ? -4 : -2.9}
                      width={active ? 8 : 5.8}
                      height={active ? 8 : 5.8}
                      transform="rotate(45)"
                      fill={c}
                      stroke="var(--background)"
                      strokeWidth="0.8"
                      style={{ transition: "fill .5s" }}
                    />
                  ) : spec.marker === "square" ? (
                    <rect
                      x={active ? -3.8 : -2.6}
                      y={active ? -3.8 : -2.6}
                      width={active ? 7.6 : 5.2}
                      height={active ? 7.6 : 5.2}
                      fill={c}
                      stroke="var(--background)"
                      strokeWidth="0.8"
                      style={{ transition: "fill .5s" }}
                    />
                  ) : (
                    <circle
                      r={active ? 4.6 : 3}
                      fill={c}
                      stroke="var(--background)"
                      strokeWidth="0.8"
                      style={{ transition: "r .2s, fill .5s" }}
                    />
                  )}
                  {s.frozen && <circle r="8" fill="none" stroke={c} strokeWidth="0.8" strokeDasharray="2 3" />}
                  <circle
                    r="12"
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={(e) => {
                      const g = e.currentTarget.parentElement as SVGGElement | null;
                      const t = g?.getAttribute("transform") ?? "";
                      const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(t);
                      setHover({
                        s: byId[s.id],
                        x: m ? Number(m[1]) : 500,
                        y: m ? Number(m[2]) : 310,
                      });
                    }}
                  />
                </g>
              );
            })}
          </g>
          </g>
        </svg>

        {/* zoom controls */}
        <div
          className="absolute bottom-3 right-3 z-10 flex flex-col overflow-hidden rounded-[var(--radius-sm)] border border-border backdrop-blur-sm"
          style={{ backgroundColor: "var(--header-bg)" }}
        >
          {[
            { k: "+", fn: () => zoomAt(1.5, W / 2, H / 2) },
            { k: "−", fn: () => zoomAt(1 / 1.5, W / 2, H / 2) },
          ].map((b) => (
            <button
              key={b.k}
              onClick={b.fn}
              aria-label={b.k === "+" ? "Zoom in" : "Zoom out"}
              className="num size-7 border-b border-border text-xs text-muted-foreground transition-colors last:border-0 hover:text-foreground"
            >
              {b.k}
            </button>
          ))}
          <button
            onClick={() => setView({ k: 1, x: 0, y: 0 })}
            disabled={view.k === 1 && view.x === 0 && view.y === 0}
            className="border-t border-border px-1.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            Fit
          </button>
        </div>

        {/* hover card (HTML overlay, positioned in normalized SVG space) */}
        {hover &&
          (() => {
            const sc = Math.max(frame.w / W, frame.h / H);
            const vx = hover.x * view.k + view.x;
            const vy = hover.y * view.k + view.y;
            const px = (frame.w - W * sc) / 2 + vx * sc;
            const py = (frame.h - H * sc) / 2 + vy * sc;
            return (
          <div
            className="pointer-events-none absolute z-20 w-[268px] animate-rise"
            style={{
              left: `${px}px`,
              top: `${py}px`,
              transform: `translate(${px > frame.w - 300 ? "calc(-100% - 14px)" : "14px"}, ${py > frame.h - 260 ? "calc(-100% - 10px)" : "-10px"})`,
            }}
          >

            <div className="panel" style={{ backgroundColor: "var(--popover)" }}>
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="num text-[11px] font-semibold text-foreground">{hover.s.id}</span>
                <span
                  className="rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[11px] font-medium capitalize"
                  style={{
                    color: LEVEL_VAR[hover.s.level],
                    backgroundColor: "var(--surface-2)",
                  }}
                >
                  {hover.s.level}
                </span>
              </div>

              <dl className="space-y-1.5 px-3 py-2.5 text-xs">
                <Row k="Contents" v={hover.s.contents} />
                <Row
                  k="Mode"
                  v={
                    <span className="text-[11px] capitalize">
                      {hover.s.mode}
                      {hover.s.expedited && (
                        <span style={{ color: "var(--primary)" }}> · expedited</span>
                      )}
                    </span>
                  }
                />

                <Row k="Supplier" v={hover.s.supplierName} />
                <Row k="Origin" v={hover.s.portName} />
                <Row
                  k="Destination"
                  v={warehouses.find((w) => w.id === hover.s.warehouseId)?.name ?? "—"}
                />

                <Row
                  k="ETA"
                  v={
                    <span className="num">
                      {hover.s.eta}d
                      {hover.s.addedDays > 0 && (
                        <span style={{ color: "var(--critical)" }}> (+{hover.s.addedDays})</span>
                      )}
                    </span>
                  }
                />
                <Row k="Units" v={<span className="num">{hover.s.units.toLocaleString()}</span>} />
              </dl>
              <div className="border-t border-border px-3 py-2">
                <p className="eyebrow mb-1">risk driver</p>
                <p className="text-[11px] leading-snug" style={{ color: LEVEL_VAR[hover.s.level] }}>
                  {hover.s.driver}
                </p>
              </div>
            </div>
          </div>
            );
          })()}


        {/* corner telemetry */}
        <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-muted-foreground">
          <span className="num">38.44°N / 122.71°W</span> · scale 1:
          <span className="num">{Math.round(14 / view.k)}</span>M · mercator ·{" "}
          <span className="num">{view.k.toFixed(1)}×</span> · scroll to zoom, drag to pan
        </div>


      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="eyebrow shrink-0 pt-px">{k}</dt>
      <dd className="text-right text-[11px] leading-snug text-foreground">{v}</dd>
    </div>
  );
}
