"use client";

import ReactECharts from "echarts-for-react";
import { useEffect, useState } from "react";
import { buildSectorColorMap } from "@/lib/sector-colors";

type Row = {
  sc_comp: string;
  potential_value: number;
};

type SectorTotal = {
  sector: string;
  total: number;
  color: string;
};

function formatValue(value: number): string {
  if (value >= 1e9) return `US$ ${(value / 1e9).toFixed(1)} bi`;
  if (value >= 1e6) return `US$ ${(value / 1e6).toFixed(1)} mi`;
  return `US$ ${value.toFixed(0)}`;
}

function aggregateBySector(rows: Row[]): SectorTotal[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.sc_comp, (totals.get(row.sc_comp) ?? 0) + row.potential_value);
  }

  const sectors = Array.from(totals.keys());
  const colorMap = buildSectorColorMap(sectors);

  return Array.from(totals.entries())
    .map(([sector, total]) => ({ sector, total, color: colorMap[sector] }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);
}

type Props = {
  selectedSectors: string[];
  onSectorClick: (sector: string) => void;
};

export default function BarChartSC({ selectedSectors, onSectorClick }: Props) {
  const [data, setData] = useState<SectorTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(
      "/api/data/epi_monetary_sc_sh6?columns=sc_comp,potential_value&limit=5000"
    )
      .then((res) => res.json())
      .then((json) => {
        setData(aggregateBySector(json.rows as Row[]));
        setLoading(false);
      })
      .catch(() => {
        setError("Erro ao carregar os dados.");
        setLoading(false);
      });
  }, []);

  const option = {
    title: {
      text: "Potencial agregado por setor (SC Competitiva)",
      left: "left",
      textStyle: {
        color: "#f4f4f5",
        fontSize: 14,
        fontWeight: "bold",
      },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: { name: string; value: number }[]) => {
        const p = params[0];
        return `<strong>${p.name}</strong><br/>Potencial: ${formatValue(p.value)}`;
      },
    },
    grid: { left: 16, right: 24, top: 60, bottom: 5, containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: {
        color: "#d4d4dc",
        formatter: (v: number) => formatValue(v),
        fontSize: 9,
      },
      splitLine: { lineStyle: { color: "#27272a" } },
    },
    yAxis: {
      type: "category",
      data: data.map((d) => d.sector).reverse(),
      axisLabel: {
        color: "#d4d4dc",
        fontSize: 13,
        width: 160,
        overflow: "truncate",
      },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: "bar",
        cursor: "pointer",
        data: data
          .map((d) => ({
            value: d.total,
            itemStyle: {
              color: d.color,
              borderRadius: [0, 4, 4, 0],
              opacity: selectedSectors.length === 0 || selectedSectors.includes(d.sector) ? 1 : 0.25,
            },
          }))
          .reverse(),
        barMaxWidth: 28,
      },
    ],
    backgroundColor: "transparent",
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-zinc-400">
        Carregando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ width: "100%", height: "520px" }}
      theme="dark"
      onEvents={{
        click: (params: { name: string }) => onSectorClick(params.name),
      }}
    />
  );
}
