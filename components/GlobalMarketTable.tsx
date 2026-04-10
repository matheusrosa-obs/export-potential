"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  "Posição": number;
  "País": string;
  "Montante US$": string;
  "Market Share (%)": string;
  "CAGR 5 anos (%)": string;
  "Share Brasil (%)": string;
  "Share SC (%)": string;
};

const COLUMNS: { key: keyof Row; label: string; align: "left" | "right" | "center" }[] = [
  { key: "Posição",          label: "#",              align: "center" },
  { key: "País",             label: "País",           align: "left"   },
  { key: "Montante US$",     label: "Importações",    align: "center" },
  { key: "Market Share (%)", label: "Market share",   align: "center" },
  { key: "CAGR 5 anos (%)",  label: "CAGR 5a",        align: "center" },
  { key: "Share Brasil (%)", label: "Share Brasil",   align: "center" },
  { key: "Share SC (%)",     label: "Share SC",       align: "center" },
];

/** Parse "484,7 mi" → 484_700_000, "925,2 mil" → 925_200, "1,5 bi" → 1_500_000_000 */
function parseBRValue(s: string): number {
  if (!s) return 0;
  const lower = s.trim().toLowerCase();
  const num = parseFloat(lower.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""));
  if (isNaN(num)) return 0;
  if (lower.endsWith("bi")) return num * 1e9;
  if (lower.endsWith("mi")) return num * 1e6;
  if (lower.endsWith("mil")) return num * 1e3;
  return num;
}

function formatTotal(total: number): string {
  if (total >= 1e12) return `US$ ${(total / 1e12).toFixed(2)} tri`;
  if (total >= 1e9)  return `US$ ${(total / 1e9).toFixed(2)} bi`;
  if (total >= 1e6)  return `US$ ${(total / 1e6).toFixed(2)} mi`;
  return `US$ ${total.toFixed(0)}`;
}

function cagrColor(v: string): string {
  const n = parseFloat(v.replace(",", "."));
  if (isNaN(n)) return "text-zinc-400";
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-red-400";
  return "text-zinc-400";
}

type SortKey = "Market Share (%)" | "CAGR 5 anos (%)" | "Share Brasil (%)" | "Share SC (%)";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "Market Share (%)", label: "Market share" },
  { key: "CAGR 5 anos (%)",  label: "CAGR 5a"      },
  { key: "Share Brasil (%)", label: "Share Brasil"  },
  { key: "Share SC (%)",     label: "Share SC"      },
];

function parseNum(s: string): number {
  const n = parseFloat(String(s).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

type Props = {
  sh6: string | null;
};

export default function GlobalMarketTable({ sh6 }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>("Market Share (%)");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!sh6) { setRows([]); return; }
    setLoading(true);
    setError(null);
    const cols = [
      "Posição",
      "País",
      "Montante US$",
      "Market Share (%)",
      "CAGR 5 anos (%)",
      "Share Brasil (%)",
      "Share SC (%)",
    ].map(encodeURIComponent).join(",");
    fetch(
      `/api/data/global_market_sh6?columns=${cols}&limit=5000&sortBy=${encodeURIComponent("Posição")}&sortDirection=asc&filter[sh6]=${encodeURIComponent(sh6)}`
    )
      .then((res) => res.json())
      .then((json) => {
        setRows(json.rows as Row[]);
        setLoading(false);
      })
      .catch(() => {
        setError("Erro ao carregar os dados.");
        setLoading(false);
      });
  }, [sh6]);

  const total = rows.reduce((acc, r) => acc + parseBRValue(r["Montante US$"]), 0);

  const sorted = useMemo(() => {
    const base = sortKey
      ? [...rows].sort((a, b) => parseNum(String(b[sortKey])) - parseNum(String(a[sortKey])))
      : rows;
    if (!search.trim()) return base;
    const q = search.trim().toLowerCase();
    return base.filter((r) => r["País"].toLowerCase().includes(q));
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
        Mercado mundial do produto (2024):{" "}
        <span className="text-[#54f394]">{formatTotal(total)}</span>
      </h3>

      {/* Sort buttons + search */}
      <div className="flex items-center gap-1.5 mb-4">
        <span className="text-xs text-zinc-500 mr-1 shrink-0">Ordenar por</span>
        {SORT_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortKey((prev) => (prev === key ? null : key))}
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
                  className={`px-3 py-2.5 font-semibold text-zinc-400 border-b border-zinc-800 whitespace-nowrap ${
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
              <tr
                key={i}
                className="border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors"
              >
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 whitespace-nowrap ${
                      col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"
                    } ${
                      col.key === "CAGR 5 anos (%)"
                        ? cagrColor(String(row[col.key]))
                        : col.key === "Posição"
                        ? "text-zinc-500"
                        : "text-zinc-300"
                    }`}
                  >
                    {col.key === "Market Share (%)" ||
                     col.key === "CAGR 5 anos (%)" ||
                     col.key === "Share Brasil (%)" ||
                     col.key === "Share SC (%)"
                      ? `${row[col.key]}%`
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
