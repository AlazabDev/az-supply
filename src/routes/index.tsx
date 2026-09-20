import { createFileRoute } from "@tanstack/react-router";
import { NetworkMap } from "@/components/ct/NetworkMap";
import { Simulator } from "@/components/ct/Simulator";
import { KpiStrip } from "@/components/ct/KpiStrip";
import { useControl } from "@/components/ct/ControlProvider";
import { BASELINE } from "@/lib/ct/engine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shipping & logistics simulator | Meridian Freight" },
      {
        name: "description",
        content:
          "Flip port delays, supplier outages, demand spikes and tariff changes on a live inbound freight network map, and watch on-time delivery, landed cost and projected stockouts move.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Shipping & logistics simulator | Meridian Freight" },
      {
        property: "og:description",
        content:
          "Flip port delays, supplier outages, demand spikes and tariff changes on a live inbound freight network map, and watch on-time delivery, landed cost and projected stockouts move.",
      },
    ],
  }),
  component: NetworkPage,
});

function NetworkPage() {
  const { state, rippleKey, revealed, visibleModes, toggleMode, active, toggleScenario, reset } =
    useControl();

  return (
    <>
      <KpiStrip state={state} baseline={BASELINE} />
      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_340px]">
        <NetworkMap
          state={state}
          rippleKey={rippleKey}
          revealed={revealed}
          visibleModes={visibleModes}
          onToggleMode={toggleMode}
        />
        <Simulator
          active={active}
          onToggle={toggleScenario}
          onReset={reset}
          state={state}
          revealed={revealed}
        />
      </div>
    </>
  );
}
