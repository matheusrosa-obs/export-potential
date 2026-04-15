"use client";

import ReactECharts from "echarts-for-react";
import { useEffect, useMemo, useState } from "react";
import { buildSectorColorMap } from "@/lib/sector-colors";
import { formatTooltipTitle } from "@/lib/tooltip-text";

type Row = {
  sh6: string;
  product_description_br: string;
  sc_comp: string;
  potential_value: number;
};

type TreemapNode = {
  name: string;
  value: number;
  children?: TreemapNode[];
};

type Props = {
  selectedSectors: string[];
};

function formatValue(value: number): string {
  if (value >= 1e9) return `US$ ${(value / 1e9).toFixed(1)} bi`;
  if (value >= 1e6) return `US$ ${(value / 1e6).toFixed(1)} mi`;
  return `US$ ${value.toFixed(0)}`;
}

function buildTreemapData(rows: Row[], selectedSectors: string[]): any[] {
  const filtered = selectedSectors.length > 0
    ? rows.filter((r) => selectedSectors.includes(r.sc_comp))
    : rows.slice(0, 75);

  const sectors = Array.from(new Set(filtered.map((r) => r.sc_comp)));
  const sectorColors = buildSectorColorMap(sectors);

  return filtered.map((row) => ({
    name: `${row.sh6} – ${row.product_description_br}`,
    value: row.potential_value,
    sector: row.sc_comp,
    itemStyle: { color: sectorColors[row.sc_comp] },
  }));
}

export default function TreemapSC({ selectedSectors }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(
      "/api/data/epi_monetary_sc_sh6?columns=sh6,product_description_br,sc_comp,potential_value&limit=5000&sortBy=potential_value&sortDirection=desc"
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
  }, []);

  const data = useMemo(
    () => buildTreemapData(rows, selectedSectors),
    [rows, selectedSectors]
  );

  const title = selectedSectors.length > 0
    ? `${selectedSectors.join(", ")} – produtos por potencial (SH6)`
    : "Potencial de exportação de Santa Catarina, por produto (SH6)";

  const option = {
    title: {
      text: title,
      left: "true",
      textStyle: {
        color: "#f4f4f5",
        fontSize: 14,
        fontWeight: "bold",
      },
    },
    tooltip: {
      formatter: (info: { name: string; value: number }) => {
        return `${formatTooltipTitle(info.name)}<br/>Potencial: ${formatValue(info.value)}`;
      },
    },
    series: [
      {
        type: "treemap",
        left: "left",
        top: 60,
        bottom: 22,
        width: "100%",
        itemStyle: {
          borderColor: "#18181b",
          borderRadius: 4,
          borderWidth: 1,
          gapWidth: 1,
        },
        roam: false,
        nodeClick: false,
        breadcrumb: false,
        label: {
          show: true,
          formatter: "{b}",
          fontSize: 11,
          color: "#fff",
          overflow: "truncate",
        },
        data,
      },
    ],
    backgroundColor: "transparent",
  };

  if (loading) {
    return (
      <div className="w-full h-[520px] flex items-center justify-center text-zinc-400">
        Carregando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[520px] flex items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ width: "100%", height: "520px" }}
      theme="dark"
    />
  );
}
