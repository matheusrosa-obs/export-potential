"use client";

import ReactECharts from "echarts-for-react";
import { useEffect, useState } from "react";
import { text } from "stream/consumers";

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

function formatValue(value: number): string {
  if (value >= 1e9) return `US$ ${(value / 1e9).toFixed(2)} bi`;
  if (value >= 1e6) return `US$ ${(value / 1e6).toFixed(2)} mi`;
  return `US$ ${value.toFixed(0)}`;
}

function buildTreemapData(rows: Row[]): any[] {
  const sectors = Array.from(new Set(rows.map(r => r.sc_comp)));
  const colorPalette = [
    '#5470c6', '#91cc75', '#fac858', '#ee6666', 
    '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'
  ];
  
  const sectorColors: Record<string, string> = {};
  sectors.forEach((s, i) => {
    sectorColors[s] = colorPalette[i % colorPalette.length];
  });

  return rows.map(row => ({
    name: `${row.sh6} – ${row.product_description_br}`,
    value: row.potential_value,
    sector: row.sc_comp,
    itemStyle: {
      color: sectorColors[row.sc_comp]
    }
  })).slice(0, 75);
}

export default function TreemapSC() {
  const [data, setData] = useState<TreemapNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(
      "/api/data/epi_monetary_sc_sh6?columns=sh6,product_description_br,sc_comp,potential_value&limit=5000&sortBy=potential_value&sortDirection=desc"
    )
      .then((res) => res.json())
      .then((json) => {
        setData(buildTreemapData(json.rows as Row[]));
        setLoading(false);
      })
      .catch(() => {
        setError("Erro ao carregar os dados.");
        setLoading(false);
      });
  }, []);

  const option = {
    title:{
      text: "Potencial de exportação de Santa Catarina, por produto (SH6)",
      left: "true",
      textStyle: {
        color: "#f4f4f5",
        fontSize: 16,
        fontWeight: "bold",
      }
    },
    tooltip: {
      formatter: (info: { name: string; value: number }) =>
        `<strong>${info.name}</strong><br/>${formatValue(info.value)}`,
    },
    series: [
      {
        type: "treemap",
        left: "left",
        top: 60,
        width: "100%",
        height: "100%",
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
        itemStyle: {
          borderColor: "#18181b",
          borderWidth: 1,
          gapWidth: 1,
        },
        data,
      },
    ],
    backgroundColor: "transparent",
  };

  if (loading) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center text-zinc-400">
        Carregando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ width: "100%", height: "600px" }}
      theme="dark"
    />
  );
}
