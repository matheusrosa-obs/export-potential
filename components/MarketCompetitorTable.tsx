"use client";

import { useEffect, useMemo, useState } from "react";

type ApiRow = {
  year: string;
  exporter: string | null;
  exporter_name: string | null;
  value: number;
  importer_sh6_share?: string | number;
  cagr_8y_adj?: string | number;
};

type Row = {
  exporter: string;
  exporter_name: string;
  value: number;
  importer_sh6_share: number;
  cagr_8y_adj: number;
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

function parseLocalizedNumber(input: string | number | undefined | null): number {
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : 0;
  }

  const raw = String(input ?? "").trim();
  if (!raw) return 0;

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;

  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function formatValue(value: number): string {
  if (value >= 1e9) return `US$ ${(value / 1e9).toFixed(1)} bi`;
  if (value >= 1e6) return `US$ ${(value / 1e6).toFixed(1)} mi`;
  if (value >= 1e3) return `US$ ${(value / 1e3).toFixed(1)} mil`;
  return `US$ ${value.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function cagrColor(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-zinc-400";
}

function normalizeText(value: string | null | undefined, fallback: string): string {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : fallback;
}

function rowId(row: Row): string {
  return `${row.exporter}||${row.exporter_name}`;
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

    const params = new URLSearchParams({
      columns: cols,
      limit: "5000",
      "filter[importer]": importer,
      "filter[sh6]": sh6,
    });

    fetch(`/api/data/df_competitors?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error ?? `Erro HTTP ${res.status}`);
        }
        return json;
      })
      .then((json) => {
        const fetched = (json.rows as ApiRow[]) ?? [];
        const latestYear = fetched.reduce((acc, row) => Math.max(acc, Number(row.year) || 0), 0);
        const latestRows = fetched.filter((row) => (Number(row.year) || 0) === latestYear);

        const normalizedRows = latestRows
          .map((row) => ({
            exporter: normalizeText(row.exporter, "N/A"),
            exporter_name: normalizeText(row.exporter_name, "Sem nome"),
            value: row.value ?? 0,
            importer_sh6_share: parseLocalizedNumber(row.importer_sh6_share),
            cagr_8y_adj: parseLocalizedNumber(row.cagr_8y_adj),
          }))
          .sort((a, b) => b.value - a.value);

        setRows(normalizedRows);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar os competidores.");
        setLoading(false);
      });
  }, [importer, sh6]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const searched = q
      ? rows.filter(
          (r) =>
            normalizeText(r.exporter, "").toLowerCase().includes(q) ||
            normalizeText(r.exporter_name, "").toLowerCase().includes(q)
        )
      : rows;

    return [...searched].sort((a, b) => {
      if (sortKey === "value") return (b.value ?? 0) - (a.value ?? 0);
      return (b[sortKey] ?? 0) - (a[sortKey] ?? 0);
    });
  }, [rows, search, sortKey]);

  const valueRankByRowId = useMemo(() => {
    const rankMap = new Map<string, number>();
    const byValue = [...rows].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    for (let i = 0; i < byValue.length; i += 1) {
      rankMap.set(rowId(byValue[i]), i + 1);
    }

    return rankMap;
  }, [rows]);

  if (!importer || !sh6) {
    return (
      <div className="h-full rounded-xl border border-dashed border-zinc-700 px-4 py-6 text-sm text-zinc-500 flex items-center justify-center">
        Selecione um país e um SH6 para ver os principais competidores.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full rounded-xl border border-zinc-800 px-4 py-6 text-sm text-zinc-500 flex items-center justify-center">
        Carregando tabela de competidores...
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
    <div className="h-full rounded-xl bg-zinc-900/20 p-4 flex flex-col">
      <h3 className="text-sm font-semibold text-zinc-100 mb-3">
        Principais competidores do SH6 no mercado selecionado
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
              <th className="px-3 py-2 text-center font-semibold text-zinc-300 border-b border-zinc-800">Valor</th>
              <th className="px-3 py-2 text-center font-semibold text-zinc-300 border-b border-zinc-800">Share (%)</th>
              <th className="px-3 py-2 text-center font-semibold text-zinc-300 border-b border-zinc-800">CAGR 8a (%)</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, i) => (
              <tr key={`${row.exporter}-${i}`} className="border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors">
                <td className="px-3 py-2 text-center text-zinc-500">{valueRankByRowId.get(rowId(row)) ?? "-"}</td>
                <td className="px-3 py-2 text-zinc-300 whitespace-nowrap max-w-[190px] truncate" title={`${row.exporter} - ${row.exporter_name}`}>
                  <span className="font-mono text-zinc-400">{row.exporter}</span>
                  <span className="text-zinc-500"> - </span>
                  {row.exporter_name}
                </td>
                <td className="px-3 py-2 text-center text-zinc-300 whitespace-nowrap">{formatValue(row.value ?? 0)}</td>
                <td className="px-3 py-2 text-center text-zinc-300 whitespace-nowrap">{formatPercent(row.importer_sh6_share)}%</td>
                <td className={`px-3 py-2 text-center whitespace-nowrap ${cagrColor(row.cagr_8y_adj)}`}>{formatPercent(row.cagr_8y_adj)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
