# Supply Chain Control Tower — decision log

## Pass: cost-axis corrections (current)

### Reversal: dual-sourcing was priced as nearly free, and that was wrong

The previous pass shipped dual-source as a play that clawed a Section 301 tranche back
from +3.7% landed cost to +0.7%, paid for only in time and risk. That is backwards, and
it is worth recording as a correction rather than quietly rewriting. Companies are not
already dual-sourced precisely because the alternate lane costs more money. As shipped,
the app argued tariffs are cheap to route around — the opposite of what the audience
knows from their own operation.

Two things were wrong underneath it. First a bug: re-let loads spread `...base` and
overrode supplier, port, ETA and risk, but never `baseDutyRate`, so a load moved from CN
to VN kept China's MFN rate. Duty now resolves from the origin the load lands in, via
`mfnRateFor()`. Second, the goods themselves were priced as if nothing changed. Re-let
loads now carry a per-supplier `spotPremium` (8–16%, deterministic on its own seeded
stream) applied to declared value before duty, because you are spot-buying on short
notice with no volume commitment. It lifts the value column on re-let rows, which is
correct and deliberately left visible. Section 301 + dual-source now lands at +2.4%,
partway between the tariffed and untariffed positions: a decision with a defensible
answer either way rather than an obvious yes.

### Concentration is modelled, not hidden

Every re-let load previously went to the single best-scoring clean supplier, silently
swapping tariff exposure for single-source concentration. That is the first objection a
procurement person raises, so the loads now distribute round-robin across the top three
non-tariffed origins and the resulting split — loads and share per origin — is shown in
the active stack panel. Making the tradeoff legible beats making it disappear.

Relatedly, the alternate-supplier search evaluated candidates with the mode hardcoded to
`"ocean"`, so under an air-scoped measure an air origin read as untariffed when it was
not. Candidates are now required to be clean across every mode in play.

### Berth congestion and clearance backlog are different things

De minimis repeal produced essentially no delay, because it is air-scoped and air loads
absorb only 12% of port dwell — its whole effect vanished into the bypass factor. The
fix was not to push berth congestion onto air freight. Repealing de minimis does not back
up container yards; it backs up customs, because parcels that entered informally now need
formal entry against broker and CBP capacity that did not grow. So the engine gained a
second, separate delay term: a clearance backlog attached to the lanes a measure covers
and explicitly *not* damped by the air bypass, since chartering a plane does not move you
up the customs queue. Lane-scoped measures get a heavier gain than broad ones. The
distinction is commented at the implementation.

### Breadth compounds

A +10% reciprocal measure 45 days out produced about a day of surge at each of ten ports
— noise. In practice a broad measure is worse than its per-port intensity implies:
carriers reposition equipment and capacity around a single tariffed origin, but when
everything is hit there is nowhere to send the boxes. The surge now carries a breadth
multiplier in the count of distinct origin countries touched, demo-tuned and labelled as
such alongside the existing front-running comment.

## Earlier pass: refocus on causal what-if simulation

### Why the app shrank from four pages to three

Inventory and Suppliers were read-only reporting surfaces. They rendered data the
engine happened to hold, but nothing you did on them changed anything, and nothing
that changed elsewhere meaningfully changed them. The strongest idea in this template
is causal simulation — flip a cause, watch effects propagate — and two of four pages
were not participating in it. They went.

`FLOORPLANS` and `SUPPLIERS` stayed in the data layer: the engine still derives
days-of-cover, projected stockouts and supplier-OTIF driver copy from them. Only the
visual surfaces were removed. `DEMAND` had no remaining consumer and was deleted.

The freed slot went to `/scenarios`, a scenario library grouped into Logistics, Trade
policy and Recovery plays. It reads and writes the same `ControlProvider` state as the
Simulator panel, so a scenario flipped there is already running when you navigate to
Network — which is the point of holding scenario state above the router outlet.

### Why a cost axis

Every scenario in the original model moved one variable: time. That was a real
limitation, not just a missing feature. Tariffs are the most consequential
disruption in inbound logistics right now, and they do not move time — they move
money. Modelling a tariff as "another kind of delay" would have been dishonest: the
number would go the right direction for the wrong reason, and the KPI it moved would
be the wrong KPI.

So the engine gained a genuine second axis. Every port carries an origin `country`,
every shipment carries the `baseDutyRate` (MFN duty) it already pays, and landed cost
is the identity `value × (1 + baseDutyRate + tariffRate)`. Unlike the service KPIs,
this one is not a tuned approximation — which is exactly why it is worth having.

### Why tariff front-running is one chain, not two

A tariff with a future effective date does not only raise cost on the day it lands.
Importers rush freight in ahead of it, and that pull-forward congests the very origin
ports the affected goods move through. Every tariff therefore produces both a cost
spike and a delay, in reality.

The tempting shortcut was to give tariff scenarios a cost effect and, separately, a
hand-set delay effect. That would have been two unrelated fudges wearing one label.
Instead the engine computes a pull-forward surge — scaling with the size of the duty
and inversely with how soon it lands — and feeds the resulting congestion days into
the existing `portDelay` map *before* risk is computed. Delay is then a consequence of
the cost event travelling through machinery that already existed. Nothing downstream
changed: risk, warehouse pressure, stockouts and the ripple animation all work as
before. The surge coefficients are demo-tuned and labelled as such in the code.

### Why dual-source is a tradeoff, not a button

Expedite-by-air already spends money to buy time. Dual-source is its mirror on the new
axis: it moves the most duty-exposed loads to a non-tariffed origin, so duty exposure
drops sharply, but the alternate lane is 35% longer plus four days of qualification
friction and carries more execution risk on a supplier the network has less history
with. Both plays cost something. A recovery lever that is a free win teaches the
audience the wrong thing about their own operation.

### Surface changes

- **KPI strip**: Inventory Turns → Landed Cost, shown as percentage variance versus
  baseline with total duty exposure as its subline. Turns was inventory-cycle framing
  in an app that no longer has an inventory page, and it barely moved under scenarios.
- **Shipments table**: origin country, effective duty rate (MFN + applied tariff) and
  landed-cost delta, all sortable; duty exposure and tariffed-load count added to the
  header summary.
- **Colour discipline**: green/amber/red continues to mean delivery risk and nothing
  else. Cost exposure is encoded with the existing cyan signal hue and heavier
  numerals, plus a signal-coloured rule on tariff-affected rows — a delay and a duty
  are different kinds of exception and an ops person reads them differently, but that
  does not justify a fourth status colour.
- **Honesty comments**: the KPI block in `engine.ts` now carries the same kind of
  TEMPLATE seam-marking the data layer already had. `onTime` and `fillRate` are linear
  approximations over a single `impactShare` proxy with hand-picked intercepts. They
  move the right way with roughly the right magnitude; they are not a forecast.

## Earlier: air freight as a second long-haul lane

Mode was extended to `ocean | air | rail | road`, with mode encoded in geometry and
motion (arc height, dash pattern, dot speed, marker shape) rather than colour, so the
risk ramp keeps its monopoly on meaning. The map header gained mode filter chips;
deselected modes drop to a ghost hairline rather than disappearing, so the network
keeps its density. The filter is a map-level lens only — KPIs and tables keep
reporting the whole network, because silently rescoping them to a visual filter would
make the numbers lie.

## Correction: engine physics, and what a charter actually costs

### Physics keys off mode; exception accounting keys off remediation

One flag was doing two jobs. `air` meant "the expedite play picked this load up this
run", and that same flag gated the berth/inland dwell bypass — so a load that was
already flying in the data absorbed full crane-queue dwell. Tolerable while `portDelay`
was usually empty; wrong the moment tariff front-running started writing large numbers
into it. These are now two named things that must not be re-merged:

- `flying` = the load's **resolved** mode is air. Drives dwell bypass and the risk
  damping. Covers both native air freight and loads chartered this morning, because the
  expedite branch rewrites mode before physics runs.
- `chartered` = this load was **remediated** this run. Drives the freight premium and
  exception accounting — a load someone has actively fixed is not an open exception.

Frozen loads are also now excluded from expedite candidacy: the score included the
freeze penalty, so the play preferentially chartered goods a shut-down supplier had
never made. `frozen` is reported honestly rather than suppressed for expedited rows;
the row and the risk number now agree.

### Freight is not dutiable — FOB

Expedite was free on the cost axis while the driver string claimed premium freight.
It now carries a deterministic 6–14% per-load charter premium (own seeded stream,
demo-tuned band), but **not** by inflating declared value. US customs value is FOB, so
international freight sits outside the dutiable base: chartering a plane raises what
you pay and not what you owe. It is therefore a separate `freightPremium` component and
landed cost is value + duty + freight premium.

This is the point of the pair. Dual-sourcing lifts the price of the goods themselves,
so it is dutiable and duty compounds on the spot premium. Expedite lifts freight, which
is never assessed. Two recovery plays, two genuinely different cost signatures — and the
kind of detail that earns trust with an audience that files entries for a living.

### Front-running surge respects scope

The surge wrote into `portDelay` keyed by port alone, so an air-scoped measure congested
the seaports its air loads happen to use and every container through those ports
inherited it. Surge now lives in its own map keyed by port **and** mode, so it lands only
on the modes the measure covers, for all three scope values. Physical `port-delay`
scenarios stay in `portDelay` and keep hitting every mode, which is right for a berth
queue. Ordering is now defensible: reciprocal (OTD 81.5, +4.5%) > Section 301
(89.1, +3.7%) > de minimis repeal (91.7, +1.2%).

## Pass: from margin to cash

### Duty attaches at entry, and the effective date now binds

`tariffRateFor` used to charge every covered load the new rate regardless of when it
arrived, so a 21-day tranche was billed to a box clearing in six. That made front-running
incoherent: the congestion appeared without the benefit that causes it. A load now pays
the new rate only if it enters on or after the effective date; loads that beat it clear at
MFN.

The sequence is fixed and must not be reordered:

```text
1. transit + congestion (portDelay, surgeDelay, laneDelay, freeze) -> entryDay
2. test each measure's effective date against entryDay
3. assess duty AND the clearance backlog on that outcome
4. eta = entryDay + clearance
```

**Clearance must never feed the boundary test.** A broker or CBP release delay changes
when goods are *released*, not the date they were *entered*, and duty attaches at entry.
Wiring clearance into `entryDay` would also be circular — the backlog a measure creates
would become the thing that makes the measure apply. This is an easy reversal to make by
accident, hence the comment at `tariffBinds`.

Surge and clearance coverage are unchanged, still keyed on origin and mode. Front-running
is market-wide: everyone on the lane rushes whether or not one particular box beats the
date.

The second-order effect falls out of the ordering rather than being special-cased. A load
arriving day 19 against a 21-day tranche clears free — unless the tariff's own pull-forward
surge adds four days, lands it day 23, and makes it pay the duty it was rushing to beat.
Those loads carry their own driver string ("was clearing day 19, congestion +4d pushed
entry to day 23"), distinct from a load that was always going to arrive late. Two loads
under Section 301 are in that state today.

The clearance backlog is gated on the same boundary: a load entering before the measure
takes effect does not queue behind a formal-entry crush that has not started.

### Entry cost is duty plus fees

The tile said landed cost and the model counted only duty. Added MPF (0.3464% ad valorem,
$32.71 floor, $634.62 ceiling — FY2025 figures, CBP indexes them annually and the constants
carry that warning) and HMF (0.125%, ocean arrivals only, no cap). Domestic origins cross
no customs line and pay neither. One shipment is treated as one entry, which is the
pessimistic reading — the MPF ceiling is exactly why a real book consolidates entries, and
that is commented at `entryFees`. Fees apply at baseline too, so the scenario delta stays
honest.

### Fill rate off, cash due on

`onTime` and `fillRate` were both linear in `impactShare`, so outside the demand spike they
were scaled copies of one another — two tiles carrying one signal. `fillRate` is gone.
`cashDue` replaces it: duty + MPF + HMF across the inbound book, delta versus baseline,
largest single entry-week as the subline. Cash is bucketed by the week of entry, with a
comment that periodic-monthly-statement filers actually settle on the 15th business day of
the following month and a real deployment should bucket on the statement date. The strip is
now on-time, cash due, landed cost, open exceptions — four tiles, four signals.

### Where the numbers landed

| Scenario | OTD | Landed cost | Cash due | Peak week | Tariffed loads |
| --- | --- | --- | --- | --- | --- |
| Baseline | 94.2 | — | $129k | $41k | 0 |
| Section 301 | 89.1 | +1.48% | $262k | $118k | 4 (2 missed the window) |
| Reciprocal | 81.5 | +0.00% | $129k | $53k | 0 |
| De minimis repeal | 91.7 | +0.00% | $129k | $41k | 0 |
| 301 + expedite air | 90.4 | +1.97% | $254k | $108k | 3 |
| 301 + dual-source | 91.7 | +2.28% | $181k | $57k | 3 |

Two scenarios now read as trivial on the cost axis and this is recorded rather than tuned
away. The longest transit in the book is 27 days, so **reciprocal (45d)** and **de minimis
(30d)** cannot bind any load currently on the water — both are pure congestion events now,
with zero duty. Section 301 at 21 days binds four loads. Fixing this is a decision about
effective dates (or about carrying a forward order book beyond the loads in transit), not
about magnitudes, and is left open.

Note also that dual-source now costs *more* landed than 301 alone (+2.28% vs +1.48%) while
cutting cash due by a third ($181k vs $262k) — the boundary shrank the duty it avoids, but
it still moves the cheque. That is the margin-versus-cash split the pass was for.

## Pass: a forward order book, and plays that respect departure

### Why the book grew

Enforcing the effective-date boundary last pass exposed a data-model gap rather than a
tuning problem. The book held only freight already on the water — arrivals 4 to 27 days
out — which is both the smallest slice of an importer's tariff exposure and the slice
nobody can do anything about. By the time a box is at sea the origin, the entry date and
the duty are all locked. So the app was showing the one part of the problem with no
available decision in it.

`Shipment` gained a lifecycle `stage` (`transit` / `booked` / `planned`) rather than a
second collection, so the engine, the map and the panels inherit it through the path that
already existed. Pre-departure loads carry `departsInDays`, and `etaDays` keeps its single
definition — days until arrival at the port of entry, for every stage — so
`entryDay = etaDays + congestion` needed no change at all. 72 forward loads on their own
seeded stream (`fwdRnd`), arrivals out to ~120 days, sized deliberately larger than the 41
in transit. Nothing above it shifted.

### Two different decay profiles

A 120-day horizon makes flat congestion indefensible: today's Oakland crane outage cannot
be applied at full force to a box shipping in three months. Physical disruptions — port
delay, lane closure, supplier shutdown — now decay with distance to arrival (full inside
10 days, e-folding over 16), keyed on nominal `etaDays` so the decay can never feed
itself.

Front-running is shaped differently on purpose. The rush is anchored to a date, not to
today, so the surge builds into the run-up to the effective date, peaks just before it,
and collapses afterwards — once the duty lands there is nothing left to beat and the
volume has already moved. Implemented as a gaussian lead-in scaled to the measure's own
horizon with a 12-day tail, which meant surge could no longer be a single number per
port/mode: it is stored per measure and resolved per load. Both profiles are commented as
demo-tuned.

### Plays are gated on departure

Dual-source was re-letting containers 96% of the way across the Pacific and expedite was
chartering loads already at sea. `progress` had been in the data the whole time and
neither play read it. Both are now restricted to pre-departure freight, and a booked load
costs more friction than a planned one when re-let — +8 days and 4 extra points of spot
premium versus +3 days and none — because cancelling held space against finished
production is not the same as redirecting a forecast.

When a play cannot fill its quota it says so in the panel, along with how many loads
already sailed and how much duty is locked on them. That state is the point: under
Section 301, dual-source finds its 4 eligible loads and reports 8 more stranded in
transit carrying $334k it cannot touch. Reciprocal covers every overseas origin, so the
play reports 0/4 — there is nowhere clean to go.

### Where the numbers landed

| Scenario | OTD | Bound loads | Cash due | Peak week | Landed cost |
| --- | --- | --- | --- | --- | --- |
| Baseline | 94.2 | 0 | $380k | $58k | — |
| Section 301 | 89.8 | 16 | $1,341k | $272k | +3.56% |
| Reciprocal | 85.7 | 20 | $899k | $201k | +1.93% |
| De minimis repeal | 92.8 | 6 | $663k | $147k | +1.05% |
| 301 + expedite air | 89.8 | 16 | $1,340k | $272k | +3.93% |
| 301 + dual-source | 90.7 | 12 | $823k | $147k | +2.62% |

Baseline cash rises from $129k to $380k purely because the book is nearly three times
larger. No scenario reads as trivial any more: reciprocal at 45 days and de minimis at 30
now bind 20 and 6 loads respectively, where against an in-transit-only book they bound
none. Dual-source cuts 301's cash due by 39% and its peak week by nearly half while
leaving the in-transit duty untouched, which is the lesson the gate was for.

### Surfaces

The map draws in-transit freight only — a planned PO has no position on a lane, and
plotting it would be fiction — with the forward-book count in the header instead. There is
no shipments table to add a stage column to (it was removed when the app was cut back to
map + simulator), so the book split lives in the simulator panel as loads and duty per
stage, encoded with weight and italics rather than a new colour.
