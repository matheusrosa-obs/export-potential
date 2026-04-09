"use client";

import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import { useCallback, useEffect, useMemo, useState } from "react";
import countryCoords from "@/lib/country-coords.json";
import { getCountryName } from "@/lib/country-names-pt";

// ─── Ajuste estas constantes para calibrar as bolhas ──────────────────────────
const BUBBLE_MIN_PX = 4;     // tamanho mínimo da bolha em pixels
const BUBBLE_MAX_PX = 120;    // tamanho máximo da bolha em pixels
const BUBBLE_SCALE_POWER = 0.6; // potência da escala (< 1 = comprime contraste, = 1 = linear)
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = ["Muito Alto", "Alto", "Médio-Alto", "Médio", "Baixo"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_COLORS: Record<Category, string> = {
  "Muito Alto":  "#dc2626",
  "Alto":        "#f97316",
  "Médio-Alto":  "#0fb425",
  "Médio":       "#eab308",
  "Baixo":       "#3b82f6",
};

type Row = {
  importer: string;
  potential_value: number;
  potential_category: string;
};

type BubblePoint = {
  name: string;
  value: [number, number, number]; // [lon, lat, potential_value]
  symbolSize: number;
};

let mapRegistered = false;

function scaleBubble(value: number, maxValue: number): number {
  const normalized = Math.pow(value / maxValue, BUBBLE_SCALE_POWER);
  return BUBBLE_MIN_PX + (BUBBLE_MAX_PX - BUBBLE_MIN_PX) * normalized;
}

function buildSeries(
  rows: Row[],
  maxValue: number
): echarts.ScatterSeriesOption[] {
  const byCategory = new Map<Category, BubblePoint[]>();
  for (const cat of CATEGORIES) byCategory.set(cat, []);

  for (const row of rows) {
    const coords = (countryCoords as unknown as Record<string, [number, number]>)[row.importer];
    if (!coords) continue;

    const cat = row.potential_category as Category;
    if (!byCategory.has(cat)) continue;

    byCategory.get(cat)!.push({
      name: row.importer,
      value: [coords[0], coords[1], row.potential_value],
      symbolSize: scaleBubble(row.potential_value, maxValue),
    });
  }

  return CATEGORIES.map((cat) => ({
    name: cat,
    type: "scatter" as const,
    coordinateSystem: "geo" as const,
    data: byCategory.get(cat)!,
    itemStyle: { color: CATEGORY_COLORS[cat], opacity: 0.8 },
    emphasis: { itemStyle: { opacity: 1 } },
    encode: { tooltip: [2] },
  }));
}

function formatValue(value: number): string {
  if (value >= 1e9) return `US$ ${(value / 1e9).toFixed(1)} bi`;
  if (value >= 1e6) return `US$ ${(value / 1e6).toFixed(1)} mi`;
  return `US$ ${value.toFixed(0)}`;
}

export default function WorldMapSC() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(mapRegistered);
  // null = todas visíveis; Set = apenas as categorias do Set estão ativas
  const [activeCategories, setActiveCategories] = useState<Set<string> | null>(null);

  const handleLegendClick = useCallback((params: { name: string }) => {
    const clicked = params.name;
    setActiveCategories((prev) => {
      if (prev === null) {
        // Tudo visível → primeiro clique: isola apenas a categoria clicada
        return new Set([clicked]);
      }
      if (prev.has(clicked)) {
        // Já ativa → remove; se ficar vazia, volta a mostrar tudo
        const next = new Set(prev);
        next.delete(clicked);
        return next.size === 0 ? null : next;
      }
      // Inativa → adiciona à seleção atual
      return new Set([...prev, clicked]);
    });
  }, []);

  const legendSelected = useMemo(
    () =>
      Object.fromEntries(
        CATEGORIES.map((cat) => [cat, activeCategories === null || activeCategories.has(cat)])
      ),
    [activeCategories]
  );

  // Register world map GeoJSON once
  useEffect(() => {
    if (mapRegistered) return;
    fetch("/maps/world.json")
      .then((r) => r.json())
      .then((geojson) => {
        echarts.registerMap("world", geojson);
        mapRegistered = true;
        setMapReady(true);
      });
  }, []);

  useEffect(() => {
    fetch(
      "/api/data/epi_monetary_sc_country?columns=importer,potential_value,potential_category&limit=5000"
    )
      .then((r) => r.json())
      .then((json) => {
        setRows(json.rows as Row[]);
        setLoading(false);
      })
      .catch(() => {
        setError("Erro ao carregar os dados.");
        setLoading(false);
      });
  }, []);

  const maxValue = useMemo(
    () => Math.max(...rows.map((r) => r.potential_value), 1),
    [rows]
  );

  const series = useMemo(
    () => buildSeries(rows, maxValue),
    [rows, maxValue]
  );

  const option: echarts.EChartsOption = {
    backgroundColor: "transparent",
    title: {
      text: "Potencial de exportação de Santa Catarina, por país importador",
      left: "left",
      textStyle: { color: "#f4f4f5", fontSize: 16, fontWeight: "bold" },
    },
    legend: {
      data: CATEGORIES.map((cat) => ({
        name: cat,
        itemStyle: { color: CATEGORY_COLORS[cat] },
      })),
      bottom: 12,
      left: "center",
      orient: "horizontal",
      textStyle: { color: "#d4d4dc", fontSize: 12 },
      selectedMode: true,
      icon: "circle",
      selected: legendSelected,
    },
    tooltip: {
      trigger: "item",
      formatter: (params: any) => {
        const [, , value] = params.value as [number, number, number];
        const countryName = getCountryName(params.name);
        return `<strong>${countryName}</strong><br/>Potencial: ${formatValue(value)}<br/>Categoria: <strong>${params.seriesName}</strong>`;
      },
    },
    geo: {
      map: "world",
      roam: true,
      boundingCoords: [[-180, 83], [180, -58]],
      zoom: 1,
      scaleLimit: { min: 1 },
      itemStyle: { areaColor: "#27272a", borderColor: "#3f3f46", borderWidth: 0.5 },
      emphasis: { itemStyle: { areaColor: "#3f3f46" }, label: { show: false } },
      label: { show: false },
    },
    series,
  };

  if (loading || !mapReady) {
    return (
      <div className="w-full h-[800px] flex items-center justify-center text-zinc-400">
        Carregando mapa...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[800px] flex items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ width: "100%", height: "800px" }}
      theme="dark"
      onEvents={{ legendselectchanged: handleLegendClick }}
    />
  );
}
