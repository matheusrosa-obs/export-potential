"use client";

import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import { useCallback, useEffect, useMemo, useState } from "react";
import countryCoords from "@/lib/country-coords.json";
import { getCountryName } from "@/lib/country-names-pt";
import { formatTooltipTitle } from "@/lib/tooltip-text";

const BUBBLE_MIN_PX = 2;
const BUBBLE_MAX_PX = 120;
const BUBBLE_SCALE_POWER = 0.6;

type ViewMode = "potential_value" | "bilateral_exports_sc_sh6" | "unrealized_potential_value";

const VIEW_OPTIONS: { key: ViewMode; label: string; color: string }[] = [
  { key: "potential_value",              label: "Potencial total",          color: "#4a9eff" },
  { key: "bilateral_exports_sc_sh6",     label: "Exportações atuais",       color: "#ffae00" },
  { key: "unrealized_potential_value",   label: "Potencial não realizado",  color: "#54f394" },
];

type Row = {
  importer: string;
  bilateral_exports_sc_sh6: number;
  potential_value: number;
  unrealized_potential_value: number;
};

function scaleBubble(value: number, maxValue: number): number {
  const normalized = Math.pow(value / maxValue, BUBBLE_SCALE_POWER);
  return BUBBLE_MIN_PX + (BUBBLE_MAX_PX - BUBBLE_MIN_PX) * normalized;
}

function formatValue(value: number): string {
  if (value >= 1e9) return `US$ ${(value / 1e9).toFixed(1)} bi`;
  if (value >= 1e6) return `US$ ${(value / 1e6).toFixed(1)} mi`;
  if (value >= 1e3) return `US$ ${(value / 1e3).toFixed(1)} mil`;
  return `US$ ${value.toFixed(0)}`;
}

type Props = {
  sh6: string | null;
};

export default function ProductWorldMap({ sh6 }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(() => !!echarts.getMap("world"));
  const [chartResetKey, setChartResetKey] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("unrealized_potential_value");

  const handleResetMapView = useCallback(() => {
    setChartResetKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (echarts.getMap("world")) { setMapReady(true); return; }
    fetch("/maps/world.json")
      .then((r) => r.json())
      .then((geojson) => {
        echarts.registerMap("world", geojson);
        setMapReady(true);
      });
  }, []);

  useEffect(() => {
    if (!sh6) { setRows([]); return; }
    setLoading(true);
    setError(null);
    const cols = "importer,bilateral_exports_sc_sh6,potential_value,unrealized_potential_value";
    fetch(`/api/data/epi_monetary_sc?columns=${cols}&limit=5000&filter[sh6]=${encodeURIComponent(sh6)}`)
      .then((r) => r.json())
      .then((json) => {
        setRows(json.rows as Row[]);
        setLoading(false);
      })
      .catch(() => {
        setError("Erro ao carregar os dados.");
        setLoading(false);
      });
  }, [sh6]);

  const { seriesData, activeColor, activeLabel } = useMemo(() => {
    const opt = VIEW_OPTIONS.find((v) => v.key === viewMode)!;
    const coords = countryCoords as unknown as Record<string, [number, number]>;
    const valid = rows.filter((r) => coords[r.importer] && (r[viewMode] ?? 0) > 0);
    const max = Math.max(...valid.map((r) => r[viewMode]), 1);
    const points = valid.map((r) => ({
      name: r.importer,
      value: [coords[r.importer][0], coords[r.importer][1], r[viewMode]] as [number, number, number],
      symbolSize: scaleBubble(r[viewMode], max),
    }));
    return { seriesData: points, activeColor: opt.color, activeLabel: opt.label };
  }, [rows, viewMode]);

  const option: echarts.EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: (params: any) => {
        const value = Array.isArray(params.value) ? (params.value[2] as number) : 0;
        return `${formatTooltipTitle(getCountryName(params.name))}<br/>${activeLabel}: ${formatValue(value ?? 0)}`;
      },
    },
    geo: {
      map: "world",
      roam: true,
      boundingCoords: [[-180, 83], [180, -58]],
      zoom: 1,
      scaleLimit: { min: 1 },
      itemStyle: { areaColor: "#494950", borderColor: "#3f3f46", borderWidth: 0.5 },
      emphasis: { itemStyle: { areaColor: "#3f3f46" }, label: { show: false } },
      label: { show: false },
    },
    series: [
      {
        type: "scatter" as const,
        coordinateSystem: "geo" as const,
        data: seriesData,
        itemStyle: { color: activeColor, opacity: 0.8 },
        emphasis: { itemStyle: { opacity: 1 } },
        encode: { tooltip: [2] },
      },
    ],
  };

  if (!sh6) return null;

  if (loading || !mapReady) {
    return (
      <div className="w-full h-[500px] flex items-center justify-center text-zinc-400 text-sm">
        Carregando mapa...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[500px] flex items-center justify-center text-red-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full mt-1">
      <h3 className="text-sm font-semibold text-zinc-100 mb-4">
        Distribuição geográfica do potencial de exportação
      </h3>
      {/* View mode toggle */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-xs text-zinc-500 mr-1 shrink-0">Visualizar</span>
        {VIEW_OPTIONS.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setViewMode(key)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs transition-colors border ${
              viewMode === key
                ? "border-transparent"
                : "text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200"
            }`}
            style={
              viewMode === key
                ? { color, borderColor: `${color}80`, backgroundColor: `${color}1a` }
                : {}
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="relative w-full h-[800px]">
        <button
          type="button"
          onClick={handleResetMapView}
          aria-label="Resetar visão do mapa"
          title="Resetar visão do mapa"
          className="absolute right-4 top-4 z-10 rounded-md border border-zinc-500/70 p-2 text-zinc-200 shadow-sm transition-colors hover:border-zinc-300 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11.5 12 4l9 7.5" />
            <path d="M5 10.5V20h14v-9.5" />
          </svg>
        </button>

        <ReactECharts
          key={chartResetKey}
          option={option}
          style={{ width: "100%", height: "100%" }}
          theme="dark"
          notMerge
        />
      </div>
    </div>
  );
}
