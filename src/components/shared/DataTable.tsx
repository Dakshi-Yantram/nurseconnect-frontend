import { cn } from "@/lib/utils";
import { Search, Download, Filter, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useState, useRef, useEffect } from "react";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
};

export type FilterOption = {
  key: string;
  label: string;
  options: string[];
};

function exportToCSV<T extends { id: string }>(rows: T[], columns: Column<T>[]) {
  const headers = columns
    .filter(c => c.key !== "actions")
    .map(c => (typeof c.header === "string" ? c.header : c.key))
    .join(",");

  const body = rows.map(row =>
    columns
      .filter(c => c.key !== "actions")
      .map(c => {
        const val = (row as Record<string, unknown>)[c.key];
        const text = val != null && (typeof val === "string" || typeof val === "number")
          ? String(val)
          : "";
        return `"${text.replace(/"/g, '""')}"`;
      })
      .join(",")
  ).join("\n");

  const blob = new Blob([`${headers}\n${body}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE = 10;

export function DataTable<T extends { id: string }>({
  columns, rows, onRowClick, search = true, onSearch, onAdd, addLabel,
  filters, filterOptions, allRows,
  pageSize = PAGE_SIZE,
}: {
  columns: Column<T>[]; rows: T[]; onRowClick?: (row: T) => void;
  search?: boolean; onSearch?: (v: string) => void;
  onAdd?: () => void; addLabel?: string;
  filters?: ReactNode;
  filterOptions?: FilterOption[];
  allRows?: T[];
  pageSize?: number;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const filterRef = useRef<HTMLDivElement>(null);

  // Reset to page 1 when rows change (search/filter)
  useEffect(() => { setPage(1); }, [rows.length]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilters(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Apply active filters on top of already-searched rows
  const filteredRows = rows.filter(row =>
    Object.entries(activeFilters).every(([k, v]) =>
      !v || String((row as Record<string, unknown>)[k] ?? "") === v
    )
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  // Page number buttons — show up to 5 around current page
  const pageNumbers = (() => {
    const pages: number[] = [];
    const start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  })();

  return (
    <div className="nc-card">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2 flex-1">
          {search && (
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                onChange={(e) => onSearch?.(e.target.value)}
                placeholder="Search…"
                className="w-full pl-9 pr-3 py-2 text-[13px] rounded-md bg-secondary border border-border focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          )}
          {filters}
        </div>
        <div className="flex items-center gap-2">
          {/* Filters dropdown */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-md border hover:bg-secondary",
                activeFilterCount > 0 ? "border-primary text-primary bg-primary/5" : "border-border"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="h-4 w-4 rounded-full bg-primary text-white text-[10px] grid place-items-center">{activeFilterCount}</span>
              )}
            </button>

            {showFilters && (
              <div className="absolute right-0 top-10 z-50 w-64 rounded-md border border-border bg-card shadow-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold">Filters</span>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => setActiveFilters({})}
                      className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <X className="h-3 w-3" /> Clear all
                    </button>
                  )}
                </div>
                {filterOptions && filterOptions.length > 0 ? (
                  filterOptions.map(f => (
                    <div key={f.key}>
                      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{f.label}</label>
                      <select
                        value={activeFilters[f.key] ?? ""}
                        onChange={e => {
                          setActiveFilters(prev => ({ ...prev, [f.key]: e.target.value }));
                          setPage(1);
                        }}
                        className="mt-1 w-full px-2 py-1.5 text-[12px] rounded-md border border-border bg-card focus:outline-none"
                      >
                        <option value="">All</option>
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] text-muted-foreground">No filters available.</p>
                )}
              </div>
            )}
          </div>

          {/* Export */}
          <button
            onClick={() => exportToCSV(allRows ?? rows, columns)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-md border border-border hover:bg-secondary"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>

          {onAdd && (
            <button onClick={onAdd} className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90">
              <Plus className="h-3.5 w-3.5" /> {addLabel ?? "Add"}
            </button>
          )}
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-2 border-b border-border">
          {Object.entries(activeFilters).filter(([, v]) => v).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
              {k}: {v}
              <button onClick={() => { setActiveFilters(prev => ({ ...prev, [k]: "" })); setPage(1); }}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto nc-scroll">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground text-left">
              {columns.map(c => (
                <th key={c.key} className={cn("px-4 py-2.5 font-medium", c.className)}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map(row => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={cn("border-t border-border hover:bg-muted/30", onRowClick && "cursor-pointer")}
              >
                {columns.map(c => (
                  <td key={c.key} className={cn("px-4 py-3 text-foreground", c.className)}>{c.cell(row)}</td>
                ))}
              </tr>
            ))}
            {pagedRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground text-[13px]">
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border text-[12px] text-muted-foreground">
        <div>
          Showing{" "}
          <span className="font-medium text-foreground">
            {filteredRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredRows.length)}
          </span>
          {" "}of{" "}
          <span className="font-medium text-foreground">{filteredRows.length}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="p-1.5 rounded border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          {pageNumbers.map(n => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={cn(
                "min-w-[28px] px-2 py-1 rounded border text-[12px]",
                n === safePage
                  ? "border-primary bg-primary text-white font-medium"
                  : "border-border hover:bg-secondary"
              )}
            >
              {n}
            </button>
          ))}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="p-1.5 rounded border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}