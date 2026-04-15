"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  year: string;
  exporter: string;
  exporter_name: string;
  value: number;
  importer_sh6_share: string;
  cagr_8y_adj: string;
};

type SortKey = "value" | "importer_sh6_share" | "cagr_8y_adj";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "value", label: "Valor" },
  { key: "importer_sh6_share", label: "Share" },
  { key: "cagr_8y_adj", label: "CAGR 8a" },
];

type Props = {
  importer: string | null;
  sh6: string | null;
};

function parseLocalizedNumber(input: string): number {
  const num = parseFloat(String(input ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(num) ? num : 0;
}

function formatValue(value: number): string {
  if (value >= 1e9) return `US$ ${(value / 1e9).toFixed(1)} bi`;
  if (value >= 1e6) return `US$ ${(value / 1e6).toFixed(1)} mi`;
  if (value >= 1e3) return `US$ ${(value / 1e3).toFixed(1)} mil`;
  return `US$ ${value.toFixed(0)}`;
}

function cagrColor(v: string): string {
  const n = parseLocalizedNumber(v);
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-red-400";
  return "text-zinc-400";
}

export default function MarketCompetitorTable({ importer, sh6 }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!importer || !sh6) {
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);
    const cols = "year,exporter,exporter_name,value,importer_sh6_share,cagr_8y_adj,sh6";

    fetch(
      `/api/data/df_competitors?columns=${cols}&limit=5000&filter[importer]=${encodeURIComponent(importer)}&filter[sh6]=${encodeURIComponent(sh6)}`
    )
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error ?? `Erro HTTP ${res.status}`);
        }
        return json;
      })
      .then((json) => {
        const fetched = (json.rows as Row[]) ?? [];
        const latestYear = fetched.reduce((acc, row) => Math.max(acc, Number(row.year) || 0), 0);
        const latestRows = fetched
          .filter((row) => (Number(row.year) || 0) === latestYear)
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

        setRows(latestRows);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar os exporters.");
        setLoading(false);
      });
  }, [importer, sh6]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const searched = q
      ? rows.filter(
          (r) =>
            r.exporter.toLowerCase().includes(q) ||
            r.exporter_name.toLowerCase().includes(q)
        )
      : rows;

    return [...searched].sort((a, b) => {
      if (sortKey === "value") return (b.value ?? 0) - (a.value ?? 0);
      return parseLocalizedNumber(String(b[sortKey])) - parseLocalizedNumber(String(a[sortKey]));
    });
  }, [rows, search, sortKey]);

  if (!importer || !sh6) {
    return (
      <div className="h-full rounded-xl border border-dashed border-zinc-700 px-4 py-6 text-sm text-zinc-500 flex items-center justify-center">
        Selecione um país e um SH6 para ver os principais exporters.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full rounded-xl border border-zinc-800 px-4 py-6 text-sm text-zinc-500 flex items-center justify-center">
        Carregando tabela de exporters...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full rounded-xl border border-zinc-800 px-4 py-6 text-sm text-red-400 flex items-center justify-center">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 flex flex-col">
      <h3 className="text-sm font-semibold text-zinc-100 mb-3">
        Principais exporters do SH6 no mercado selecionado
      </h3>

      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-xs text-zinc-500 mr-1 shrink-0">Ordenar por</span>
        {SORT_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-xs transition-colors ${
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
            placeholder="Buscar exporter..."
            className="pl-8 pr-3 py-1 rounded-full text-xs bg-transparent border border-zinc-700 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 w-44 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-zinc-800">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-zinc-900">
            <tr>
              <th className="px-3 py-2 text-center font-semibold text-zinc-300 border-b border-zinc-800">#</th>
              <th className="px-3 py-2 text-left font-semibold text-zinc-300 border-b border-zinc-800">Exporter</th>
              <th className="px-3 py-2 text-right font-semibold text-zinc-300 border-b border-zinc-800">Valor</th>
              <th className="px-3 py-2 text-right font-semibold text-zinc-300 border-b border-zinc-800">Share (%)</th>
              <th className="px-3 py-2 text-right font-semibold text-zinc-300 border-b border-zinc-800">CAGR 8a (%)</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, i) => (
              <tr key={`${row.exporter}-${i}`} className="border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors">
                <td className="px-3 py-2 text-center text-zinc-500">{i + 1}</td>
                <td className="px-3 py-2 text-zinc-300 whitespace-nowrap max-w-[190px] truncate" title={`${row.exporter} - ${row.exporter_name}`}>
                  <span className="font-mono text-zinc-400">{row.exporter}</span>
                  <span className="text-zinc-500"> - </span>
                  {row.exporter_name}
                </td>
                <td className="px-3 py-2 text-right text-zinc-300 whitespace-nowrap">{formatValue(row.value ?? 0)}</td>
                <td className="px-3 py-2 text-right text-zinc-300 whitespace-nowrap">{row.importer_sh6_share}%</td>
                <td className={`px-3 py-2 text-right whitespace-nowrap ${cagrColor(row.cagr_8y_adj)}`}>{row.cagr_8y_adj}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
