import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MODES, type Mode } from "@/components/ct/NetworkMap";
import { WAREHOUSES } from "@/lib/ct/data";
import { computeState, type ControlState } from "@/lib/ct/engine";

const ALL_WH = WAREHOUSES.map((w) => w.id);

interface Ctx {
  state: ControlState;
  active: string[];
  revealed: string[];
  rippleKey: number;
  visibleModes: Mode[];
  toggleMode: (m: Mode) => void;
  toggleScenario: (id: string) => void;
  reset: () => void;
}

const ControlCtx = createContext<Ctx | null>(null);

export function useControl() {
  const ctx = useContext(ControlCtx);
  if (!ctx) throw new Error("useControl must be used inside <ControlProvider>");
  return ctx;
}

/**
 * Holds every piece of cross-page control-room state: which scenarios are
 * active, the orchestrated ripple reveal order, and the map mode lens.
 * Mounted above the router outlet so navigation never resets a simulation.
 */
export function ControlProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<string[]>(ALL_WH);
  const [rippleKey, setRippleKey] = useState(0);
  const [visibleModes, setVisibleModes] = useState<Mode[]>(MODES);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const toggleMode = useCallback((m: Mode) => {
    setVisibleModes((prev) =>
      prev.includes(m)
        ? prev.length === 1
          ? prev
          : prev.filter((x) => x !== m)
        : [...prev, m],
    );
  }, []);

  const state = useMemo(() => computeState(active), [active]);

  /** Orchestrated ripple: clear node states, then light them up one by one. */
  const ripple = useCallback((next: string[]) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setActive(next);
    setRippleKey((k) => k + 1);
    if (next.length === 0) {
      setRevealed(ALL_WH);
      return;
    }
    const s = computeState(next);
    const order = [...s.warehouses]
      .sort(
        (a, b) =>
          ({ critical: 0, caution: 1, nominal: 2 })[a.level] -
          ({ critical: 0, caution: 1, nominal: 2 })[b.level],
      )
      .map((w) => w.id);
    setRevealed([]);
    order.forEach((id, i) => {
      timers.current.push(
        setTimeout(() => setRevealed((prev) => [...prev, id]), 460 + i * 420),
      );
    });
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const toggleScenario = useCallback(
    (id: string) =>
      ripple(active.includes(id) ? active.filter((x) => x !== id) : [...active, id]),
    [active, ripple],
  );

  const reset = useCallback(() => ripple([]), [ripple]);

  const value = useMemo(
    () => ({
      state,
      active,
      revealed,
      rippleKey,
      visibleModes,
      toggleMode,
      toggleScenario,
      reset,
    }),
    [state, active, revealed, rippleKey, visibleModes, toggleMode, toggleScenario, reset],
  );

  return <ControlCtx.Provider value={value}>{children}</ControlCtx.Provider>;
}
