/**
 * Real-world geography for the control tower map.
 *
 * Coastlines come from Natural Earth (world-atlas 110m countries) and US state
 * boundaries from us-atlas (states-10m). Everything is projected with a real
 * Mercator projection rotated to centre the Pacific, so Asian load ports sit
 * west of the western-US destinations exactly as they do on a real chart.
 */
import { geoMercator, geoPath, type GeoProjection } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import countriesTopo from "world-atlas/countries-110m.json";
import statesTopo from "us-atlas/states-10m.json";

export const MAP_W = 1000;
export const MAP_H = 620;

/** Visible window: East Asia (left) through the US Gulf coast (right). */
const NW: [number, number] = [118, 52];
const SE: [number, number] = [-88, 16];

function buildProjection(): GeoProjection {
  const p = geoMercator().rotate([-200, 0]).scale(1).translate([0, 0]);
  const a = p(NW)!;
  const b = p(SE)!;
  const k = Math.min(MAP_W / (b[0] - a[0]), MAP_H / (b[1] - a[1]));
  const cx = (a[0] + b[0]) / 2;
  const cy = (a[1] + b[1]) / 2;
  return p.scale(k).translate([MAP_W / 2 - cx * k, MAP_H / 2 - cy * k]);
}

export const projection = buildProjection();
const pathGen = geoPath(projection);

/** Project real [lon, lat] into SVG space. */
export function project(lon: number, lat: number): { x: number; y: number } {
  const [x, y] = projection([lon, lat]) ?? [0, 0];
  return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
}

const countries = countriesTopo as unknown as Topology<{
  countries: GeometryCollection;
}>;
const states = statesTopo as unknown as Topology<{ states: GeometryCollection }>;

/** Filled landmasses (one path per country in view). */
export const LAND_PATHS: string[] = feature(countries, countries.objects.countries)
  .features.map((f) => pathGen(f))
  .filter((d): d is string => Boolean(d));

/** Country borders as a single mesh (interior boundaries only). */
export const COUNTRY_BORDERS: string =
  pathGen(mesh(countries, countries.objects.countries, (a, b) => a !== b)) ?? "";

/** US state boundaries as a single mesh. */
export const STATE_BORDERS: string =
  pathGen(mesh(states, states.objects.states, (a, b) => a !== b)) ?? "";

/** Graticule-free latitude/longitude reference lines for the control-room feel. */
export const GRATICULE: string[] = [
  ...[20, 30, 40, 50].map((lat) => {
    const pts: string[] = [];
    for (let lon = 116; lon <= 360 - 86; lon += 4) {
      const { x, y } = project(lon > 180 ? lon - 360 : lon, lat);
      pts.push(`${x} ${y}`);
    }
    return `M ${pts.join(" L ")}`;
  }),
  ...[120, 150, 180, -150, -120, -90].map((lon) => {
    const pts: string[] = [];
    for (let lat = 14; lat <= 53; lat += 2) {
      const { x, y } = project(lon, lat);
      pts.push(`${x} ${y}`);
    }
    return `M ${pts.join(" L ")}`;
  }),
];
