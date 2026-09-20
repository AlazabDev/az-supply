/**
 * Server-only Daftra API client. Never import from client-reachable code —
 * this module reads DAFTRA_API_KEY from the environment.
 *
 * Daftra API v2: base https://<subdomain>.daftra.com/api2, header `apikey`.
 * List envelope: { result, code, data: [{ <Entity>: {...} }], pagination }.
 */

const DAFTRA_BASE = "https://alazab-co.daftra.com/api2";

export interface DaftraPage<T> {
  rows: T[];
  page: number;
  pageCount: number;
  total: number;
}

interface DaftraEnvelope {
  result?: string;
  message?: string;
  data?: unknown;
  pagination?: {
    page?: number | string;
    page_count?: number | string;
    total_results?: number | string;
  };
}

export async function daftraFetch(path: string, init?: RequestInit): Promise<DaftraEnvelope> {
  const key = process.env["DAFTRA_API_KEY"];
  if (!key) throw new Error("DAFTRA_API_KEY is not configured");

  const res = await fetch(`${DAFTRA_BASE}/${path.replace(/^\/+/, "")}`, {
    ...init,
    headers: {
      apikey: key,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  let json: DaftraEnvelope | null = null;
  try {
    json = JSON.parse(text) as DaftraEnvelope;
  } catch {
    json = null;
  }

  if (!res.ok || json === null || json.result === "failed") {
    const detail = json?.message ?? text.slice(0, 200);
    throw new Error(`Daftra request failed [${res.status}]: ${detail}`);
  }
  return json;
}

/** "clients" -> "Client" (Daftra wraps each row in a singular entity key). */
function entityKey(entity: string): string {
  const base = entity.endsWith("s") ? entity.slice(0, -1) : entity;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export async function daftraList<T>(
  entity: string,
  page = 1,
  limit = 50,
): Promise<DaftraPage<T>> {
  const json = await daftraFetch(`${entity}/?page=${page}&limit=${limit}`);
  const raw = Array.isArray(json.data) ? (json.data as Record<string, unknown>[]) : [];
  const key = entityKey(entity);
  const rows = raw.map((row) => {
    const inner = (row[key] ?? {}) as Record<string, unknown>;
    return { ...inner, id: String(inner.id ?? "") } as T;
  });
  const p = json.pagination ?? {};
  return {
    rows,
    page: Number(p.page ?? page) || page,
    pageCount: Math.max(1, Number(p.page_count ?? 1)),
    total: Number(p.total_results ?? rows.length),
  };
}

export async function daftraCreate(
  entity: string,
  payload: Record<string, unknown>,
): Promise<{ id: string | null }> {
  const key = entityKey(entity);
  const json = await daftraFetch(`${entity}/`, {
    method: "POST",
    body: JSON.stringify({ [key]: payload }),
  });
  const raw = Array.isArray(json.data) ? (json.data as Record<string, unknown>[])[0] : undefined;
  const inner = raw ? (raw[key] as Record<string, unknown> | undefined) : undefined;
  return { id: inner?.id != null ? String(inner.id) : null };
}

export function displayName(
  business?: string | null,
  first?: string | null,
  last?: string | null,
): string {
  const full = [first, last].filter(Boolean).join(" ").trim();
  return (business ?? "").trim() || full || "—";
}
