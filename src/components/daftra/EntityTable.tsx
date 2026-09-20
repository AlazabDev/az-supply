import { useMemo, useState, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  numeric?: boolean;
}

interface Props<T extends { id: string }> {
  columns: Column<T>[];
  rows: T[];
  searchKeys?: (keyof T)[];
  empty?: string;
}

/** Sortable, searchable data table styled with the control-tower tokens. */
export function EntityTable<T extends { id: string }>({
  columns,
  rows,
  searchKeys,
  empty = "No records.",
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const filtered = useMemo(() => {
    let out = rows;
    if (query.trim() && searchKeys?.length) {
      const q = query.trim().toLowerCase();
      out = out.filter((row) =>
        searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q)),
      );
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        out = [...out].sort((a, b) => {
          const va = col.sortValue!(a);
          const vb = col.sortValue!(b);
          if (typeof va === "number" && typeof vb === "number") return (va - vb) * sort.dir;
          return String(va).localeCompare(String(vb)) * sort.dir;
        });
      }
    }
    return out;
  }, [rows, query, sort, columns, searchKeys]);

  return (
    <div>
      {searchKeys?.length ? (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="mb-2 w-full max-w-xs rounded-[var(--radius-sm)] border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
        />
      ) : null}

      <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--surface-2)" }}>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() =>
                    c.sortValue &&
                    setSort((s) =>
                      s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 },
                    )
                  }
                  className={`whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground ${
                    c.sortValue ? "cursor-pointer select-none" : ""
                  }`}
                >
                  {c.header}
                  {sort?.key === c.key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground">
                  {empty}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2 ${c.numeric ? "num" : ""}`}>
                      {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Pager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="mt-2 flex items-center justify-end gap-2 text-xs">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="panel px-3 py-1 disabled:opacity-40"
      >
        Prev
      </button>
      <span className="num text-muted-foreground">
        {page} / {pageCount}
      </span>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        className="panel px-3 py-1 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
