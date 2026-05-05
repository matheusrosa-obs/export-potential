"use client";

import { useEffect, useMemo, useState } from "react";
import { getCountryName } from "@/lib/country-names-pt";

type Row = {
  importer: string;
  potential_value: number;
  bilateral_exports_uf: number;
  unrealized_potential_value: number;
  potential_utilization_ratio: number;
  potential_category: string;
};

const COLUMNS: { key: keyof Row; label: string; align: "left" | "right" | "center" }[] = [
  { key: "importer", label: "País", align: "left" },
  { key: "potential_value", label: "Potencial total", align: "center" },
  { key: "bilateral_exports_uf", label: "Exportações atuais", align: "center" },
  { key: "unrealized_potential_value", label: "Potencial não realizado", align: "center" },
  { key: "potential_utilization_ratio", label: "Aproveitamento", align: "center" },
  { key: "potential_category", label: "Categoria", align: "center" },
];

type SortKey = "potential_value" | "bilateral_exports_uf" | "unrealized_potential_value" | "potential_utilization_ratio";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "potential_value", label: "Potencial total" },
  { key: "bilateral_exports_uf", label: "Exportações atuais" },
  { key: "unrealized_potential_value", label: "Potencial não realizado" },
  { key: "potential_utilization_ratio", label: "Aproveitamento" },
];

function formatMoney(total: number): string {
  if (total >= 1e12) return `US$ ${(total / 1e12).toFixed(2)} tri`;
  if (total >= 1e9) return `US$ ${(total / 1e9).toFixed(2)} bi`;
  if (total >= 1e6) return `US$ ${(total / 1e6).toFixed(2)} mi`;
  if (total >= 1e3) return `US$ ${(total / 1e3).toFixed(2)} mil`;
  return `US$ ${total.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function categoryColor(value: string): string {
  if (value.includes("Muito Alto")) return "text-emerald-400";
  if (value.includes("Alto")) return "text-amber-400";
  if (value.includes("Médio")) return "text-zinc-300";
  return "text-zinc-500";
}

type Props = {
  sh6: string | null;
};

export default function GlobalMarketTable({ sh6 }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("potential_value");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!sh6) {
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      columns: "importer,potential_value,bilateral_exports_uf,unrealized_potential_value,potential_utilization_ratio,potential_category",
      limit: "5000",
      "filter[sh6]": sh6,
    });

    fetch(`/api/data/epi_monetary_ufs_country?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        const rawRows = (json.rows as Row[]) ?? [];
        const aggregated = new Map<string, Row>();

        for (const row of rawRows) {
          const key = row.importer;
          const existing = aggregated.get(key);
          if (existing) {
            aggregated.set(key, {
              ...existing,
              potential_value: existing.potential_value + (row.potential_value ?? 0),
              bilateral_exports_uf: existing.bilateral_exports_uf + (row.bilateral_exports_uf ?? 0),
              unrealized_potential_value:
                existing.unrealized_potential_value + (row.unrealized_potential_value ?? 0),
              potential_utilization_ratio: existing.potential_utilization_ratio + (row.potential_utilization_ratio ?? 0),
            });
          } else {
            aggregated.set(key, { ...row });
          }
        }

        setRows(Array.from(aggregated.values()));
        setLoading(false);
      })
      .catch(() => {
        setError("Erro ao carregar os dados.");
        setLoading(false);
      });
  }, [sh6]);

  const total = rows.reduce((acc, r) => acc + (r.potential_value ?? 0), 0);

  const sorted = useMemo(() => {
    const base = [...rows].sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));
    if (!search.trim()) return base;
    const q = search.trim().toLowerCase();
    return base.filter((r) => getCountryName(r.importer).toLowerCase().includes(q));
  }, [rows, sortKey, search]);

  if (!sh6) return null;

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-16 text-zinc-500 text-sm">
        Carregando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex items-center justify-center py-16 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-zinc-100 mb-4">
        Mercados do produto:{" "}
        <span className="text-[#54f394]">{formatMoney(total)}</span>
      </h3>

      <div className="flex items-center gap-1.5 mb-4">
        <span className="text-xs text-zinc-500 mr-1 shrink-0">Ordenar por</span>
        {SORT_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs transition-colors ${
              sortKey === key
                ? "border text-[#54f394] border-[#54f394]/50 bg-[#54f394]/10"
                : "text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
        <div className="relative ml-auto">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar país…"
            className="pl-12 pr-3 py-1 mb-1 rounded text-xs bg-transparent border border-zinc-700 rounded-full text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 w-52 transition-colors"
          />
        </div>
      </div>

      <div className="w-full overflow-y-auto rounded-xl border border-zinc-800" style={{ maxHeight: "710px" }}>
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-zinc-900">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 font-semibold text-zinc-300 border-b border-zinc-800 whitespace-nowrap ${
                    col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className="border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors">
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 whitespace-nowrap ${
                      col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"
                    } ${col.key === "potential_category" ? categoryColor(String(row[col.key])) : "text-zinc-300"}`}
                  >
                    {col.key === "importer"
                      ? getCountryName(row.importer)
                      : col.key === "potential_value" || col.key === "bilateral_exports_uf" || col.key === "unrealized_potential_value"
                        ? formatMoney(row[col.key])
                        : col.key === "potential_utilization_ratio"
                          ? formatPercent(row[col.key])
                          : String(row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
