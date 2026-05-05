"use client";

import ReactECharts from "echarts-for-react";
import { useEffect, useMemo, useState } from "react";
import { getCountryName } from "@/lib/country-names-pt";
import { formatTooltipTitle } from "@/lib/tooltip-text";
import { applyUfFilter, getUfLabel, useSelectedUf } from "@/lib/uf-filter";

type Row = {
  importer: string;
  bilateral_exports_uf_sh6: number;
  potential_value: number;
  unrealized_potential_value: number;
};

type SortKey = "potential_value" | "bilateral_exports_uf_sh6" | "unrealized_potential_value";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "potential_value", label: "Potencial total" },
  { key: "bilateral_exports_uf_sh6", label: "Exportações atuais" },
  { key: "unrealized_potential_value", label: "Potencial não realizado" },
];

function formatValue(v: number): string {
  if (v >= 1e9) return `US$ ${(v / 1e9).toFixed(1)} bi`;
  if (v >= 1e6) return `US$ ${(v / 1e6).toFixed(1)} mi`;
  if (v >= 1e3) return `US$ ${(v / 1e3).toFixed(1)} mil`;
  return `US$ ${v.toFixed(0)}`;
}

function buildOption(rows: Row[]): object {
  // Y-axis: country names in Portuguese
  const importers = rows.map((r) => getCountryName(r.importer));
  const baseline = rows.map((r) => r.bilateral_exports_uf_sh6 ?? 0);
  const unrealized = rows.map((r) => r.unrealized_potential_value ?? 0);
  const potential = rows.map((r) => r.potential_value ?? 0);

  const maxVal = Math.max(...potential, 1);

  return {
    backgroundColor: "transparent",
    grid: { left: 160, right: 40, top: 16, bottom: 40 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "none" },
      backgroundColor: "#18181b",
      borderColor: "#3f3f46",
      textStyle: { color: "#f4f4f5", fontSize: 12 },
      formatter(params: any[]) {
        const country = getCountryName(rows[params[0].dataIndex].importer);
        const pot = potential[params[0].dataIndex];
        const base = baseline[params[0].dataIndex];
        const unr = unrealized[params[0].dataIndex];
        return [
          formatTooltipTitle(country),
          `Potencial total: <b>${formatValue(pot)}</b>`,
          `Exportações atuais: <b>${formatValue(base)}</b>`,
          `Potencial não realizado: <b>${formatValue(unr)}</b>`,
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
      data: importers,
      inverse: true,
      axisLabel: { color: "#a1a1aa", fontSize: 14, width: 150, overflow: "truncate" },
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
        data: unrealized,
        barMaxWidth: 16,
        itemStyle: { color: "#54f394", borderRadius: [0, 4, 4, 0], opacity: 0.3 },
        z: 2,
      },
      // 3. Dot at bilateral_exports_sc_sh6
      {
        name: "Exportações atuais",
        type: "scatter",
        data: baseline.map((v, i) => [v, i]),
        symbolSize: 10,
        itemStyle: { color: "#fff", borderColor: "#54f394", borderWidth: 2 },
        z: 4,
        tooltip: { show: false },
      },
      // 4. End marker (thin vertical line) at potential_value
      {
        name: "Potencial total",
        type: "scatter",
        data: potential.map((v, i) => [v, i]),
        symbol: "rect",
        symbolSize: [4, 14],
        itemStyle: { color: "#54f394" },
        z: 4,
        tooltip: { show: false },
      },
    ],
  };
}

type Props = {
  sh6: string | null;
};

export default function ProductBarChart({ sh6 }: Props) {
  const selectedUf = useSelectedUf();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("potential_value");

  useEffect(() => {
    if (!sh6) { setRows([]); return; }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      columns: "importer,bilateral_exports_uf_sh6,potential_value,unrealized_potential_value",
      limit: "5000",
      "filter[sh6]": sh6,
    });
    applyUfFilter(params, selectedUf);

    fetch(`/api/data/epi_monetary_ufs?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        setRows(json.rows as Row[]);
        setLoading(false);
      })
      .catch(() => {
        setError("Erro ao carregar os dados.");
        setLoading(false);
      });
  }, [sh6, selectedUf]);

  const sorted = useMemo(() => {
    return [...rows]
      .sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0))
      .slice(0, 30);
  }, [rows, sortKey]);

  const option = useMemo(() => buildOption(sorted), [sorted]);

  if (!sh6) {
    return (
      <div className="w-full mt-2 flex items-center justify-center rounded-xl border border-dashed border-zinc-700 py-16 text-zinc-500 text-sm">
        Selecione um produto para visualizar o potencial por importador.
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
        Nenhum dado encontrado para o produto selecionado.
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-zinc-100 mb-4">
        Potencial de exportação e potencial não realizado por importador em {getUfLabel(selectedUf)}
      </h3>
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

      <ReactECharts
        option={option}
        style={{ width: "100%", height: "750px" }}
        theme="dark"
        notMerge
      />

      {/* Legend */}
      <div className="flex items-center place-content-center gap-5 mb-3">
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
    </div>
  );
}
