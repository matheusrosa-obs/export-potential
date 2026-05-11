"use client";

import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import countryCoords from "@/lib/country-coords.json";
import { getCountryName } from "@/lib/country-names-pt";
import { formatTooltipTitle } from "@/lib/tooltip-text";

type ApiRow = {
  exporter: string;
  exporter_name: string;
  value: number;
  route_mode: "maritime" | "straight_fallback" | "unavailable";
  path_coords: [number, number][];
  origin_coord: [number, number] | null;
  importer_coord: [number, number] | null;
};

type LinePoint = [number, number];

type LineDatum = {
  fromName: string;
  fromLabel: string;
  toName: string;
  coords: LinePoint[];
  value: number;
  routeMode: ApiRow["route_mode"];
};

type ScatterDatum = {
  name: string;
  value: [number, number, number];
  flowValue: number;
};

type RowWithOriginCoord = ApiRow & { origin_coord: [number, number] };

type Props = {
  importer: string | null;
  sh6: string | null;
};

// ─── Ajuste estas constantes para calibrar mapa e bolhas ─────────────────────
const FLOW_COLOR = "#54f394";

const ORIGIN_BUBBLE_MIN_PX = 2;
const ORIGIN_BUBBLE_MAX_PX = 120;
const ORIGIN_BUBBLE_SCALE_POWER = 0.6;
const IMPORTER_BUBBLE_SIZE_PX = 10;

const MAP_DEFAULT_ZOOM = 1;
const MAP_SCALE_MIN = 0.5;
const MAP_SCALE_MAX = 30;
const MAP_HEIGHT_CLASS = "h-[800px]";
// ─────────────────────────────────────────────────────────────────────────────

let mapRegistered = false;

function formatValue(value: number): string {
  if (value >= 1e9) return `US$ ${(value / 1e9).toFixed(1)} bi`;
  if (value >= 1e6) return `US$ ${(value / 1e6).toFixed(1)} mi`;
  if (value >= 1e3) return `US$ ${(value / 1e3).toFixed(1)} mil`;
  return `US$ ${value.toFixed(0)}`;
}

function isCoord(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
  );
}

function hasOriginCoord(row: ApiRow): row is RowWithOriginCoord {
  return isCoord(row.origin_coord);
}

function bubbleSize(value: number, maxValue: number): number {
  const normalized = Math.pow(value / Math.max(maxValue, 1), ORIGIN_BUBBLE_SCALE_POWER);
  return ORIGIN_BUBBLE_MIN_PX + (ORIGIN_BUBBLE_MAX_PX - ORIGIN_BUBBLE_MIN_PX) * normalized;
}

export default function MarketFlightsGLMap({ importer, sh6 }: Props) {
  const [rows, setRows] = useState<ApiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState<boolean>(() => !!echarts.getMap("world"));
  const chartRef = useRef<ReactECharts | null>(null);

  useEffect(() => {
    if (mapRegistered || echarts.getMap("world")) {
      mapRegistered = true;
      setMapReady(true);
      return;
    }

    fetch("/maps/world.json")
      .then((r) => r.json())
      .then((geojson) => {
        echarts.registerMap("world", geojson);
        mapRegistered = true;
        setMapReady(true);
      })
      .catch(() => {
        setMapReady(false);
      });
  }, []);

  useEffect(() => {
    if (!importer || !sh6) {
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      importer,
      sh6,
      limit: "120",
    });

    fetch(`/api/market-flows-maritime?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error ?? `Erro HTTP ${res.status}`);
        }
        return json;
      })
      .then((json) => {
        setRows((json.rows as ApiRow[]) ?? []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setRows([]);
        setError(err instanceof Error ? err.message : "Erro ao carregar fluxos comerciais.");
        setLoading(false);
      });
  }, [importer, sh6]);

  const prepared = useMemo(() => {
    const coords = countryCoords as unknown as Record<string, [number, number]>;
    const importerCoordFromRows =
      rows.find((row) => isCoord(row.importer_coord))?.importer_coord ?? null;
    const importerCoord = importer
      ? importerCoordFromRows ?? coords[importer] ?? null
      : null;

    if (!importer || !importerCoord) {
      return {
        hasImporterCoord: false,
        lineData: [] as LineDatum[],
        exporterPoints: [] as ScatterDatum[],
        importerPoint: [] as ScatterDatum[],
        maxFlow: 1,
        totalFlow: 0,
      };
    }

    const rowsWithOrigin = rows.filter(hasOriginCoord);
    const maxFlow = Math.max(...rowsWithOrigin.map((row) => row.value), 1);
    const totalFlow = rows.reduce((acc, row) => acc + (Number(row.value) || 0), 0);

    const lineData = rows
      .map((row) => ({
        ...row,
        path: (row.path_coords ?? []).filter((coord) => isCoord(coord)),
      }))
      .filter((row) => row.route_mode !== "unavailable" && row.path.length >= 2)
      .map((row) => ({
        fromName: row.exporter,
        fromLabel: row.exporter_name,
        toName: importer,
        coords: row.path,
        value: row.value,
        routeMode: row.route_mode,
      }));

    const exporterPoints = rowsWithOrigin.map((row) => ({
      name: row.exporter,
      value: [row.origin_coord[0], row.origin_coord[1], row.value] as [number, number, number],
      flowValue: row.value,
    }));

    const importerPoint = [
      {
        name: importer,
        value: [importerCoord[0], importerCoord[1], totalFlow] as [number, number, number],
        flowValue: totalFlow,
      },
    ];

    return {
      hasImporterCoord: true,
      lineData,
      exporterPoints,
      importerPoint,
      maxFlow,
      totalFlow,
    };
  }, [rows, importer]);

  const option = useMemo<echarts.EChartsOption>(
    () => ({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          if (params.seriesType === "lines") {
            const fromIso = String(params.data?.fromName ?? "");
            const toIso = String(params.data?.toName ?? "");
            const value = Number(params.data?.value ?? 0);
            const routeMode =
              params.data?.routeMode === "maritime" ? "Maritima" : "Linha reta";
            return `${formatTooltipTitle(`${getCountryName(fromIso)} -> ${getCountryName(toIso)}`)}<br/>Fluxo comercial: ${formatValue(value)}<br/>Rota: ${routeMode}`;
          }

          if (params.seriesName === "Importador") {
            const value = Number(params.data?.flowValue ?? params.value?.[2] ?? prepared.totalFlow);
            return `${formatTooltipTitle(getCountryName(String(params.name)))}<br/>Fluxo total recebido: ${formatValue(value)}`;
          }

          if (params.seriesName === "Exportadores") {
            const flow = Number(params.data?.flowValue ?? params.value?.[2] ?? 0);
            return `${formatTooltipTitle(getCountryName(String(params.name)))}<br/>Fluxo para ${getCountryName(String(importer ?? ""))}: ${formatValue(flow)}`;
          }

          const flow = Number(params.data?.flowValue ?? params.value?.[2] ?? 0);
          return `${formatTooltipTitle(getCountryName(String(params.name)))}<br/>Fluxo para ${getCountryName(String(importer ?? ""))}: ${formatValue(flow)}`;
        },
      },
      geo: {
        map: "world",
        roam: true,
        show: true,
        silent: false,
        boundingCoords: [[-180, 83], [180, -58]],
        zoom: MAP_DEFAULT_ZOOM,
        scaleLimit: { min: MAP_SCALE_MIN, max: MAP_SCALE_MAX },
        itemStyle: { areaColor: "#494950", borderColor: "#3f3f46", borderWidth: 0.5 },
        emphasis: { itemStyle: { areaColor: "#3f3f46" }, label: { show: false } },
        label: { show: false },
      },
      series: [
        {
          name: "Fluxo comercial",
          type: "lines",
          coordinateSystem: "geo",
          polyline: true,
          blendMode: "lighter",
          data: prepared.lineData,
          lineStyle: {
            color: FLOW_COLOR,
            width: 2,
            opacity: 0.01,
          },
          effect: {
            show: true,
            constantSpeed: 34,
            trailLength: 0.05,
            symbolSize: 2.6,
            color: FLOW_COLOR,
          },
          zlevel: 2,
        },
        {
          name: "Exportadores",
          type: "effectScatter",
          coordinateSystem: "geo",
          data: prepared.exporterPoints,
          symbol: "circle",
          rippleEffect: { scale: 1.2, brushType: "stroke" },
          symbolSize: (value: number[]) => bubbleSize(Number(value?.[2] ?? 0), prepared.maxFlow),
          itemStyle: {
            color: FLOW_COLOR,
            borderColor: "#111827",
            borderWidth: 0,
            opacity: 0.88,
          },
          zlevel: 3,
        },
        {
          name: "Importador",
          type: "scatter",
          coordinateSystem: "geo",
          data: prepared.importerPoint,
          symbol: "circle",
          symbolSize: IMPORTER_BUBBLE_SIZE_PX,
          itemStyle: {
            color: "#ffffff",
            borderColor: FLOW_COLOR,
            borderWidth: 0,
            opacity: 1,
          },
          zlevel: 4,
        },
      ],
    }),
    [prepared, importer]
  );

  const handleResetMapView = useCallback(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;

    // Re-apply base option without clearing the instance to avoid losing map layer.
    instance.setOption(option, {
      notMerge: true,
      lazyUpdate: false,
    });
  }, [option]);

  if (!importer || !sh6) {
    return (
      <div className={`w-full ${MAP_HEIGHT_CLASS} rounded-xl border border-dashed border-zinc-700 px-4 py-6 text-sm text-zinc-500 flex items-center justify-center`}>
        Selecione um pais e um SH6 para visualizar os fluxos comerciais.
      </div>
    );
  }

  if (!mapReady) {
    return (
      <div className={`w-full ${MAP_HEIGHT_CLASS} rounded-xl border border-zinc-800 px-4 py-6 text-sm text-zinc-500 flex items-center justify-center`}>
        Carregando mapa de fluxos comerciais...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`w-full ${MAP_HEIGHT_CLASS} rounded-xl border border-zinc-800 px-4 py-6 text-sm text-red-400 flex items-center justify-center`}>
        {error}
      </div>
    );
  }

  if (
    !loading &&
    (!prepared.hasImporterCoord ||
      (prepared.lineData.length === 0 && prepared.exporterPoints.length === 0))
  ) {
    return (
      <div className={`w-full ${MAP_HEIGHT_CLASS} rounded-xl border border-zinc-800 px-4 py-6 text-sm text-zinc-500 flex items-center justify-center`}>
        Nenhum fluxo encontrado para os filtros selecionados.
      </div>
    );
  }

  return (
    <div className={`w-full ${MAP_HEIGHT_CLASS} rounded-2xl p-4 flex flex-col`}>
      <h3 className="text-sm font-semibold text-zinc-100">
        Fluxo comercial internacional para o mercado selecionado
      </h3>
      <div className="relative mt-3 flex-1 min-h-0 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={handleResetMapView}
          aria-label="Resetar visao do mapa"
          title="Resetar visao do mapa"
          className="absolute right-4 top-4 z-10 rounded-md border border-zinc-500/70 p-2 text-zinc-200 shadow-sm transition-colors hover:border-zinc-300 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11.5 12 4l9 7.5" />
            <path d="M5 10.5V20h14v-9.5" />
          </svg>
        </button>

        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ width: "100%", height: "100%" }}
          theme="dark"
          notMerge={false}
        />

        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-900/35 backdrop-blur-[1px]">
            <span className="text-xs text-zinc-200">Atualizando fluxos...</span>
          </div>
        )}
      </div>
    </div>
  );
}
