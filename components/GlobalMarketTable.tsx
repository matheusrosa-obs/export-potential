"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  rank: number;
  country: string;
  amount: number;
  marketShare: number;
  cagr5: number;
  shareBrazil: number;
  shareSC: number;
};

const COLUMN_MAP = {
  rank: "Posição",
  country: "País",
  amount: "Montante US$",
  marketShare: "Market Share (%)",
  cagr5: "CAGR 5 anos (%)",
  shareBrazil: "Share Brasil (%)",
  shareSC: "Share SC (%)",
} as const;

const COLUMNS: { key: keyof Row; label: string; align: "left" | "right" | "center" }[] = [
  { key: "rank", label: "Posição", align: "center" },
  { key: "country", label: "País", align: "left" },
  { key: "amount", label: "Montante", align: "center" },
  { key: "marketShare", label: "Market Share", align: "center" },
  { key: "cagr5", label: "CAGR 5 anos", align: "center" },
  { key: "shareBrazil", label: "Share Brasil", align: "center" },
  { key: "shareSC", label: "Share SC", align: "center" },
];

type SortKey = keyof Pick<Row, "rank" | "amount" | "marketShare" | "cagr5" | "shareBrazil" | "shareSC">;

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "rank", label: "Posição" },
  { key: "amount", label: "Montante" },
  { key: "marketShare", label: "Market Share" },
  { key: "cagr5", label: "CAGR 5 anos" },
  { key: "shareBrazil", label: "Share Brasil" },
  { key: "shareSC", label: "Share SC" },
];

function formatMoney(total: number): string {
  if (total >= 1e12) return `US$ ${(total / 1e12).toFixed(2)} tri`;
  if (total >= 1e9) return `US$ ${(total / 1e9).toFixed(2)} bi`;
  if (total >= 1e6) return `US$ ${(total / 1e6).toFixed(2)} mi`;
  if (total >= 1e3) return `US$ ${(total / 1e3).toFixed(2)} mil`;
  return `US$ ${total.toFixed(0)}`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function parsePtNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value !== "string") return 0;

  let input = value.trim().toLowerCase();
  if (!input) return 0;

  let multiplier = 1;
  if (input.endsWith("tri")) {
    multiplier = 1e12;
    input = input.slice(0, -3).trim();
  } else if (input.endsWith("bi")) {
    multiplier = 1e9;
    input = input.slice(0, -2).trim();
  } else if (input.endsWith("mi")) {
    multiplier = 1e6;
    input = input.slice(0, -2).trim();
  } else if (input.endsWith("mil")) {
    multiplier = 1e3;
    input = input.slice(0, -3).trim();
  }

  input = input.replace("us$", "").trim();
  input = input.replace(/\./g, "").replace(",", ".");
  input = input.replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(input);
  if (!Number.isFinite(parsed)) return 0;
  return parsed * multiplier;
}

function parseRank(value: unknown): number {
  const parsed = parsePtNumber(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

type Props = {
  sh6: string | null;
};

export default function GlobalMarketTable({ sh6 }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!sh6) {
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      columns: Object.values(COLUMN_MAP).join(","),
      limit: "5000",
      sortBy: COLUMN_MAP.rank,
      sortDirection: "asc",
      "filter[sh6]": sh6,
    });

    fetch(`/api/data/global_market_sh6?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error ?? `Erro HTTP ${res.status}`);
        }
        return json;
      })
      .then((json) => {
        const rawRows = (json.rows as Record<string, unknown>[]) ?? [];
        const mapped = rawRows.map((row) => ({
          rank: parseRank(row[COLUMN_MAP.rank]),
          country: String(row[COLUMN_MAP.country] ?? ""),
          amount: parsePtNumber(row[COLUMN_MAP.amount]),
          marketShare: parsePtNumber(row[COLUMN_MAP.marketShare]),
          cagr5: parsePtNumber(row[COLUMN_MAP.cagr5]),
          shareBrazil: parsePtNumber(row[COLUMN_MAP.shareBrazil]),
          shareSC: parsePtNumber(row[COLUMN_MAP.shareSC]),
        }));

        setRows(mapped);
        setLoading(false);
      })
      .catch(() => {
        setError("Erro ao carregar os dados.");
        setLoading(false);
      });
  }, [sh6]);

  const total = rows.reduce((acc, r) => acc + (r.amount ?? 0), 0);

  const sorted = useMemo(() => {
    const direction = sortKey === "rank" ? 1 : -1;
    const base = [...rows].sort((a, b) => (a[sortKey] - b[sortKey]) * direction);
    if (!search.trim()) return base;
    const q = search.trim().toLowerCase();
    return base.filter((r) => r.country.toLowerCase().includes(q));
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

  if (rows.length === 0) {
    return (
      <div className="w-full flex items-center justify-center py-16 text-zinc-500 text-sm">
        Nenhum dado encontrado para o produto selecionado.
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-zinc-100 mb-4">
        Mercado mundial do produto:{" "}
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
                    } text-zinc-300`}
                  >
                    {col.key === "country"
                      ? row.country
                      : col.key === "amount"
                        ? formatMoney(row.amount)
                        : col.key === "rank"
                          ? row.rank
                          : col.key === "marketShare"
                            ? formatPercent(row.marketShare)
                            : col.key === "cagr5"
                              ? formatPercent(row.cagr5)
                              : col.key === "shareBrazil"
                                ? formatPercent(row.shareBrazil)
                                : col.key === "shareSC"
                                  ? formatPercent(row.shareSC)
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
