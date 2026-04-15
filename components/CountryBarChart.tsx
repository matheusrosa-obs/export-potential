"use client";

import ReactECharts from "echarts-for-react";
import { useEffect, useMemo, useState } from "react";

type Row = {
  sh6: string;
  product_description_br: string;
  bilateral_exports_sc_sh6: number;
  potential_value: number;
  unrealized_potential_value: number;
};

type SortKey = "potential_value" | "bilateral_exports_sc_sh6" | "unrealized_potential_value";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "potential_value", label: "Potencial total" },
  { key: "bilateral_exports_sc_sh6", label: "Exportações atuais" },
  { key: "unrealized_potential_value", label: "Potencial não realizado" },
];

function formatValue(v: number): string {
  if (v >= 1e9) return `US$ ${(v / 1e9).toFixed(1)} bi`;
  if (v >= 1e6) return `US$ ${(v / 1e6).toFixed(1)} mi`;
  if (v >= 1e3) return `US$ ${(v / 1e3).toFixed(1)} mil`;
  return `US$ ${v.toFixed(0)}`;
}

function buildOption(rows: Row[], selectedSH6: string | null): object {
  const sh6s = rows.map((r) => r.sh6);
  const baseline = rows.map((r) => r.bilateral_exports_sc_sh6 ?? 0);
  const unrealized = rows.map((r) => r.unrealized_potential_value ?? 0);
  const potential = rows.map((r) => r.potential_value ?? 0);

  const maxVal = Math.max(...potential, 1);

  return {
    backgroundColor: "transparent",
    grid: { left: 80, right: 40, top: 16, bottom: 40 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "none" },
      backgroundColor: "#18181b",
      borderColor: "#3f3f46",
      textStyle: { color: "#f4f4f5", fontSize: 12 },
      formatter(params: any[]) {
        const i = params[0].dataIndex;
        return [
          `<strong>${rows[i].sh6} – ${rows[i].product_description_br}</strong>`,
          `Potencial total: <b>${formatValue(potential[i])}</b>`,
          `Exportações atuais: <b>${formatValue(baseline[i])}</b>`,
          `Potencial não realizado: <b>${formatValue(unrealized[i])}</b>`,
        ].join("<br/>");
      },
    },
    xAxis: {
      type: "value",
      max: maxVal * 1.05,
      axisLabel: {
        color: "#71717a",
        fontSize: 11,
        formatter: (v: number) => {
          if (v >= 1e9) return `${(v / 1e9).toFixed(0)} bi`;
          if (v >= 1e6) return `${(v / 1e6).toFixed(0)} mi`;
          if (v >= 1e3) return `${(v / 1e3).toFixed(0)} mil`;
          return String(v);
        },
      },
      splitLine: { lineStyle: { color: "#27272a", type: "dashed" } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "category",
      data: sh6s,
      inverse: true,
      axisLabel: {
        color: "#a1a1aa",
        fontSize: 12,
        width: 70,
        overflow: "truncate",
        formatter: (value: string) => (selectedSH6 === value ? `${value}  •` : value),
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    series: [
      // 1. Unrealized potential bar stacked on baseline
      {
        name: "_base_spacer",
        type: "bar",
        stack: "gap",
        data: baseline,
        barMaxWidth: 16,
        itemStyle: { color: "transparent" },
        emphasis: { disabled: true },
        silent: true,
        z: 2,
      },
      {
        name: "Potencial não realizado",
        type: "bar",
        stack: "gap",
        data: unrealized.map((value, i) => ({
          value,
          itemStyle: {
            color: "#54f394",
            borderRadius: [0, 4, 4, 0],
            opacity:
              !selectedSH6 || rows[i].sh6 === selectedSH6
                ? 0.85
                : 0.22,
          },
        })),
        barMaxWidth: 16,
        z: 2,
      },
      // 2. Dot at bilateral_exports_sc_sh6
      {
        name: "Exportações atuais",
        type: "scatter",
        data: baseline.map((v, i) => ({
          value: [v, i],
          itemStyle: {
            color: "#fff",
            borderColor: "#54f394",
            borderWidth: 2,
            opacity:
              !selectedSH6 || rows[i].sh6 === selectedSH6
                ? 1
                : 0.32,
          },
        })),
        symbolSize: 10,
        z: 4,
        tooltip: { show: false },
      },
      // 3. End marker at potential_value
      {
        name: "Potencial total",
        type: "scatter",
        data: potential.map((v, i) => ({
          value: [v, i],
          itemStyle: {
            color: "#54f394",
            opacity:
              !selectedSH6 || rows[i].sh6 === selectedSH6
                ? 1
                : 0.32,
          },
        })),
        symbol: "rect",
        symbolSize: [4, 14],
        z: 4,
        tooltip: { show: false },
      },
    ],
  };
}

type Props = {
  importer: string | null;
  selectedSH6: string | null;
  onSH6Select: (sh6: string | null) => void;
};

export default function CountryBarChart({ importer, selectedSH6, onSH6Select }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("potential_value");

  useEffect(() => {
    if (!importer) { setRows([]); return; }
    setLoading(true);
    setError(null);
    const cols = "sh6,product_description_br,bilateral_exports_sc_sh6,potential_value,unrealized_potential_value";
    fetch(
      `/api/data/epi_monetary_sc?columns=${cols}&limit=5000&filter[importer]=${encodeURIComponent(importer)}`
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
  }, [importer]);

  const sorted = useMemo(() => {
    return [...rows]
      .sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0))
      .slice(0, 30);
  }, [rows, sortKey]);

  const option = useMemo(() => buildOption(sorted, selectedSH6), [sorted, selectedSH6]);

  if (!importer) {
    return (
      <div className="w-full mt-2 flex items-center justify-center rounded-xl border border-dashed border-zinc-700 py-16 text-zinc-500 text-sm">
        Selecione um país para visualizar o potencial por produto.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full mt-2 flex items-center justify-center rounded-xl border border-zinc-800 py-16 text-zinc-500 text-sm">
        Carregando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full mt-2 flex items-center justify-center rounded-xl border border-zinc-800 py-16 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="w-full mt-2 flex items-center justify-center rounded-xl border border-dashed border-zinc-700 py-16 text-zinc-500 text-sm">
        Nenhum dado encontrado para o país selecionado.
      </div>
    );
  }

  return (
    <div className="w-full mt-2 h-[800px] flex flex-col">
      {/* Sort buttons */}
      <div className="flex items-center gap-1.5 mb-4">
        <span className="text-xs text-zinc-500 mr-1">Ordenar por</span>
        {SORT_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              sortKey === key
                ? "border text-[#54f394] border-[#54f394]/50 bg-[#54f394]/10"
                : "text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-[#54f394] bg-white" />
          Exportações atuais
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="inline-block w-6 h-2.5 rounded bg-[#54f394]/85" />
          Potencial não realizado
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="inline-block w-1 h-3.5 rounded bg-[#54f394]" />
          Potencial total
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ReactECharts
          option={option}
          style={{ width: "100%", height: "100%" }}
          theme="dark"
          notMerge
          onEvents={{
            click: (params: { dataIndex?: number }) => {
              const idx = params.dataIndex;
              if (typeof idx === "number" && sorted[idx]?.sh6) {
                const clickedSH6 = sorted[idx].sh6;
                onSH6Select(clickedSH6 === selectedSH6 ? null : clickedSH6);
              }
            },
          }}
        />
      </div>
    </div>
  );
}
