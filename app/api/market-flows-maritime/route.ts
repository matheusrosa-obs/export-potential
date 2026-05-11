import { NextResponse } from "next/server";
import countryCoords from "@/lib/country-coords.json";
import {
  DatasetNotFoundError,
  InvalidQueryError,
  queryDataset,
} from "@/lib/parquet-service";
import { loadMaritimeRoutesByImporter } from "@/lib/maritime-route-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 120;
const MAX_LIMIT = 500;

type ApiRow = {
  year: string | number | null;
  exporter: string | null;
  exporter_name: string | null;
  value: number | string | null;
};

type AggregatedFlowRow = {
  exporter: string;
  exporter_name: string;
  value: number;
};

type MaritimeApiRow = {
  exporter: string;
  exporter_name: string;
  value: number;
  route_mode: "maritime" | "straight_fallback" | "unavailable";
  path_coords: [number, number][];
  origin_coord: [number, number] | null;
  importer_coord: [number, number] | null;
};

function normalizeCode(value: string | null): string {
  return String(value ?? "").trim().toUpperCase();
}

function parseLimit(input: string | null): number {
  const parsed = Number(input ?? DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;

  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT);
}

export function aggregateLatestYearFlows(rows: ApiRow[]): {
  year: number;
  rows: AggregatedFlowRow[];
} {
  const latestYear = rows.reduce(
    (acc, row) => Math.max(acc, Number(row.year) || 0),
    0
  );

  const totals = new Map<string, AggregatedFlowRow>();
  for (const row of rows) {
    if ((Number(row.year) || 0) !== latestYear) continue;

    const exporter = normalizeCode(row.exporter);
    if (!exporter) continue;

    const current = totals.get(exporter);
    totals.set(exporter, {
      exporter,
      exporter_name:
        String(row.exporter_name ?? "").trim() || exporter,
      value: (current?.value ?? 0) + (Number(row.value) || 0),
    });
  }

  return {
    year: latestYear,
    rows: Array.from(totals.values())
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value),
  };
}

export function buildFallbackPath(
  origin: [number, number],
  destination: [number, number]
): [number, number][] {
  return [origin, destination];
}

function toCoordsIndex(): Record<string, [number, number]> {
  return countryCoords as unknown as Record<string, [number, number]>;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const importer = normalizeCode(searchParams.get("importer"));
    const sh6 = normalizeCode(searchParams.get("sh6"));
    const limit = parseLimit(searchParams.get("limit"));

    if (!importer) {
      throw new InvalidQueryError("Parametro obrigatorio ausente: importer.");
    }

    if (!sh6) {
      throw new InvalidQueryError("Parametro obrigatorio ausente: sh6.");
    }

    const competitors = await queryDataset({
      datasetId: "df_competitors",
      columns: ["year", "exporter", "exporter_name", "value"],
      limit: Number.MAX_SAFE_INTEGER,
      offset: 0,
      includeTotal: false,
      filters: {
        importer,
        sh6,
      },
    });

    const aggregated = aggregateLatestYearFlows(
      (competitors.rows as ApiRow[]).filter(Boolean)
    );

    const maritimeRoutesByExporter = await loadMaritimeRoutesByImporter(importer);
    const coords = toCoordsIndex();
    const importerCoord = coords[importer] ?? null;

    const rows: MaritimeApiRow[] = aggregated.rows.slice(0, limit).map((row) => {
      const exporterCoord = coords[row.exporter] ?? null;
      const route = maritimeRoutesByExporter.get(row.exporter);

      if (route?.routeMode === "maritime" && route.pathCoords.length >= 2) {
        return {
          exporter: row.exporter,
          exporter_name: row.exporter_name,
          value: row.value,
          route_mode: "maritime",
          path_coords: route.pathCoords,
          origin_coord: exporterCoord,
          importer_coord: importerCoord,
        };
      }

      if (exporterCoord && importerCoord) {
        return {
          exporter: row.exporter,
          exporter_name: row.exporter_name,
          value: row.value,
          route_mode: "straight_fallback",
          path_coords: buildFallbackPath(exporterCoord, importerCoord),
          origin_coord: exporterCoord,
          importer_coord: importerCoord,
        };
      }

      return {
        exporter: row.exporter,
        exporter_name: row.exporter_name,
        value: row.value,
        route_mode: "unavailable",
        path_coords: [],
        origin_coord: exporterCoord,
        importer_coord: importerCoord,
      };
    });

    return NextResponse.json({
      importer,
      sh6,
      year: aggregated.year || null,
      rows,
    });
  } catch (error) {
    if (error instanceof DatasetNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof InvalidQueryError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}