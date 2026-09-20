# Supply Chain Control Tower

An exception-first logistics control room, built as a remixable template. It spans four
pages: **Network** (a live geographic map of inbound arcs with a disruption simulator
whose scenarios ripple visibly through routes, warehouse nodes, and KPIs), **Shipments**
(every inbound load ranked worst-first by delivery risk, with sorting and mode/risk
filters), **Inventory** (warehouse floorplans heat-mapped by zone stock risk, plus
forecast-versus-actual demand charts and projected stockouts), and **Suppliers** (a
sortable scorecard with OTIF and lead-time-variance trends, defect rate, and a composite
score). "Meridian Freight & Fulfillment" is a fictional company and every figure —
shipments, suppliers, SKUs, floorplans, demand history, and ticker events — is synthetic,
generated from a fixed seed so the app renders identically on server and client.

To use your own data, edit `src/lib/ct/data.ts`: replace `WAREHOUSES`, `PORTS`,
`SUPPLIERS`, and `SHIPMENTS` with your network (locations take real lon/lat via
`project()`), replace `FLOORPLANS` with your warehouse zone layouts, and replace `DEMAND`
with your forecast/actual history — the engine, map, tables, charts, and KPIs derive
automatically. One caveat: `SCENARIOS` are hand-authored what-if cases whose labels and
details name the fictional network (Tianjin Metals, I-80 Donner, Shanghai blank sailings),
so rewrite them for disruptions relevant to your own ports, suppliers, and lanes; the
engine applies them generically by `kind` and `targetId`. The same applies to the demo
narrative strings marked in `src/lib/ct/engine.ts` and the fake event feed in
`src/components/ct/Ticker.tsx`.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
