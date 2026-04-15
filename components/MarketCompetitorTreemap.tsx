"use client";

import ReactECharts from "echarts-for-react";
import { useEffect, useMemo, useState } from "react";
import { buildCategoricalColorMap } from "@/lib/sector-colors";
import { formatTooltipTitle } from "@/lib/tooltip-text";

type Row = {
  year: string;
  exporter: string;
  exporter_name: string;
  value: number;
};

type Props = {
  importer: string | null;
  sh6: string | null;
};

function formatValue(value: number): string {
  if (value >= 1e9) return `US$ ${(value / 1e9).toFixed(1)} bi`;
  if (value >= 1e6) return `US$ ${(value / 1e6).toFixed(1)} mi`;
  if (value >= 1e3) return `US$ ${(value / 1e3).toFixed(1)} mil`;
  return `US$ ${value.toFixed(0)}`;
}

export default function MarketCompetitorTreemap({ importer, sh6 }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!importer || !sh6) {
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);
    const cols = "year,exporter,exporter_name,value,sh6";

    const params = new URLSearchParams({
      columns: cols,
      limit: "5000",
      "filter[importer]": importer,
      "filter[sh6]": sh6,
    });

    fetch(`/api/data/df_competitors?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error ?? `Erro HTTP ${res.status}`);
        }
        return json;
      })
      .then((json) => {
        const fetched = (json.rows as Row[]) ?? [];
        const latestYear = fetched.reduce((acc, row) => Math.max(acc, Number(row.year) || 0), 0);
        const latestRows = fetched.filter((row) => (Number(row.year) || 0) === latestYear);
        setRows(latestRows);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar o treemap de exporters.");
        setLoading(false);
      });
  }, [importer, sh6]);

  const data = useMemo(() => {
    const totals = new Map<string, { label: string; value: number }>();
    for (const row of rows) {
      const key = row.exporter;
      const prev = totals.get(key);
      totals.set(key, {
        label: `${row.exporter} - ${row.exporter_name}`,
        value: (prev?.value ?? 0) + (row.value ?? 0),
      });
    }

    const topExporters = Array.from(totals.entries())
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 30);

    const colorMap = buildCategoricalColorMap(
      topExporters.map(([key]) => key)
    );

    return topExporters.map(([key, val]) => ({
        name: val.label,
        value: val.value,
        itemStyle: { color: colorMap[key] },
      }));
  }, [rows]);

  const option = useMemo(
    () => ({
      backgroundColor: "transparent",
      tooltip: {
        formatter: (info: { name: string; value: number }) =>
          `${formatTooltipTitle(info.name)}<br/>Exportações: ${formatValue(info.value)}`,
      },
      series: [
        {
          type: "treemap",
          top: 8,
          left: 0,
          right: 0,
          bottom: 0,
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          label: {
            show: true,
            formatter: "{b}",
            color: "#f4f4f5",
            fontSize: 10,
            overflow: "truncate",
          },
          itemStyle: {
            borderColor: "#18181b",
            borderWidth: 1,
            gapWidth: 1,
            borderRadius: 4,
          },
          data,
        },
      ],
    }),
    [data]
  );

  if (!importer || !sh6) {
    return (
      <div className="h-full rounded-xl border border-dashed border-zinc-700 px-4 py-6 text-sm text-zinc-500 flex items-center justify-center">
        Selecione um país e um SH6 para ver a distribuição entre competidores.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full rounded-xl border border-zinc-800 px-4 py-6 text-sm text-zinc-500 flex items-center justify-center">
        Carregando treemap de competidores...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full rounded-xl border border-zinc-800 px-4 py-6 text-sm text-red-400 flex items-center justify-center">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full rounded-xl bg-zinc-900/20 p-3">
      <h3 className="text-sm font-semibold text-zinc-100 mb-2">
        Distribuição do mercado entre exporters
      </h3>
      <ReactECharts option={option} style={{ width: "100%", height: "calc(100% - 26px)" }} theme="dark" notMerge />
    </div>
  );
}
