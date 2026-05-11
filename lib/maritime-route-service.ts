import { promises as fs } from "node:fs";
import path from "node:path";
import { parquetRead } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import {
  hydrateRouteByExporter,
  type HydratedMaritimeRoute,
  type MaritimeRouteRow,
} from "@/lib/maritime-routes";

const ROUTES_DIRECTORY = path.join(
  process.cwd(),
  "public",
  "data",
  "routes_by_importer"
);
const ROUTES_INDEX_FILE = path.join(ROUTES_DIRECTORY, "index.json");
const INDEX_TTL_MS = 30_000;

const ROUTE_COLUMNS = [
  "importer",
  "exporter",
  "distance_km",
  "route_mode",
  "path_coords_json",
  "snap_origin",
  "snap_destination",
  "source",
] as const;

type MaritimeRouteDatasetEntry = {
  importer: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
  updatedAt: string;
};

type MaritimeRoutesIndexCache = {
  loadedAt: number;
  entries: MaritimeRoutesIndexEntry[];
};

export type MaritimeRoutesIndexEntry = {
  importer: string;
  file_name: string;
  rows?: number;
  size_bytes?: number;
};

declare global {
  var __maritimeRoutesIndexCache: MaritimeRoutesIndexCache | undefined;
  var __maritimeRoutesIndexPromise:
    | Promise<MaritimeRoutesIndexCache>
    | undefined;
  var __maritimeRoutesByImporterCache:
    | Map<string, Map<string, HydratedMaritimeRoute>>
    | undefined;
  var __maritimeRoutesByImporterPromises:
    | Map<string, Promise<Map<string, HydratedMaritimeRoute>>>
    | undefined;
}

const maritimeRoutesByImporterCache =
  globalThis.__maritimeRoutesByImporterCache ??
  new Map<string, Map<string, HydratedMaritimeRoute>>();
globalThis.__maritimeRoutesByImporterCache = maritimeRoutesByImporterCache;

const maritimeRoutesByImporterPromises =
  globalThis.__maritimeRoutesByImporterPromises ??
  new Map<string, Promise<Map<string, HydratedMaritimeRoute>>>();
globalThis.__maritimeRoutesByImporterPromises = maritimeRoutesByImporterPromises;

function normalizeImporter(importer: string): string {
  return String(importer ?? "").trim().toUpperCase();
}

function toAsyncBuffer(arrayBuffer: ArrayBuffer) {
  return {
    byteLength: arrayBuffer.byteLength,
    slice: (start: number, end: number) =>
      Promise.resolve(arrayBuffer.slice(start, end)),
  };
}

async function readParquetFileRows(
  filePath: string,
  columns: readonly string[]
): Promise<Record<string, unknown>[]> {
  const buffer = await fs.readFile(filePath);
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;

  const projection = Array.from(columns);
  const asyncBuffer = toAsyncBuffer(arrayBuffer);
  let rawRows: unknown[][] = [];

  await parquetRead({
    file: asyncBuffer,
    compressors,
    columns: projection,
    onComplete(rows) {
      rawRows = rows as unknown[][];
    },
  });

  return rawRows.map((row) =>
    Object.fromEntries(projection.map((name, index) => [name, row[index]]))
  );
}

async function loadMaritimeRoutesIndex(
  forceRefresh = false
): Promise<MaritimeRoutesIndexCache> {
  const cached = globalThis.__maritimeRoutesIndexCache;
  const cacheFresh = cached && Date.now() - cached.loadedAt < INDEX_TTL_MS;

  if (!forceRefresh && cacheFresh) {
    return cached;
  }

  if (globalThis.__maritimeRoutesIndexPromise) {
    return globalThis.__maritimeRoutesIndexPromise;
  }

  const promise = fs
    .readFile(ROUTES_INDEX_FILE, "utf-8")
    .then((raw) => {
      const parsed = JSON.parse(raw) as MaritimeRoutesIndexEntry[];
      const entries = Array.isArray(parsed)
        ? parsed.filter(
            (entry) =>
              Boolean(entry?.importer) && Boolean(entry?.file_name)
          )
        : [];

      const indexCache: MaritimeRoutesIndexCache = {
        loadedAt: Date.now(),
        entries,
      };

      globalThis.__maritimeRoutesIndexCache = indexCache;
      return indexCache;
    })
    .catch((error) => {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code === "ENOENT") {
        const empty: MaritimeRoutesIndexCache = {
          loadedAt: Date.now(),
          entries: [],
        };
        globalThis.__maritimeRoutesIndexCache = empty;
        return empty;
      }
      throw error;
    })
    .finally(() => {
      globalThis.__maritimeRoutesIndexPromise = undefined;
    });

  globalThis.__maritimeRoutesIndexPromise = promise;
  return promise;
}

export function resolveMaritimeRoutesIndexEntry(
  entries: MaritimeRoutesIndexEntry[],
  importer: string
): MaritimeRoutesIndexEntry | null {
  const normalizedImporter = normalizeImporter(importer);
  if (!normalizedImporter) return null;

  const match = entries.find(
    (entry) => normalizeImporter(entry.importer) === normalizedImporter
  );

  return match ?? null;
}

async function getMaritimeRoutePartitionDataset(
  importer: string
): Promise<MaritimeRouteDatasetEntry | null> {
  const normalizedImporter = normalizeImporter(importer);
  if (!normalizedImporter) return null;

  const indexCache = await loadMaritimeRoutesIndex();
  const entry = resolveMaritimeRoutesIndexEntry(
    indexCache.entries,
    normalizedImporter
  );

  if (!entry) return null;

  const filePath = path.join(ROUTES_DIRECTORY, entry.file_name);
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat) return null;

  return {
    importer: normalizedImporter,
    fileName: entry.file_name,
    filePath,
    sizeBytes: stat.size,
    updatedAt: stat.mtime.toISOString(),
  };
}

function toMaritimeRouteRows(rows: Record<string, unknown>[]): MaritimeRouteRow[] {
  return rows.map((row) => ({
    importer: String(row.importer ?? "").trim().toUpperCase(),
    exporter: String(row.exporter ?? "").trim().toUpperCase(),
    distance_km: Number(row.distance_km) || 0,
    route_mode: String(row.route_mode ?? "unavailable"),
    path_coords_json: String(row.path_coords_json ?? "[]"),
    snap_origin: Boolean(row.snap_origin),
    snap_destination: Boolean(row.snap_destination),
    source: String(row.source ?? "searoute-js"),
  }));
}

export function clearMaritimeRoutesByImporterCache() {
  maritimeRoutesByImporterCache.clear();
  maritimeRoutesByImporterPromises.clear();
}

export async function loadMaritimeRoutesByImporter(
  importer: string
): Promise<Map<string, HydratedMaritimeRoute>> {
  const normalizedImporter = normalizeImporter(importer);
  if (!normalizedImporter) return new Map();

  const cached = maritimeRoutesByImporterCache.get(normalizedImporter);
  if (cached) return cached;

  const inFlight = maritimeRoutesByImporterPromises.get(normalizedImporter);
  if (inFlight) return inFlight;

  const loadPromise = (async () => {
    const dataset = await getMaritimeRoutePartitionDataset(normalizedImporter);
    if (!dataset) return new Map<string, HydratedMaritimeRoute>();

    const rows = await readParquetFileRows(dataset.filePath, ROUTE_COLUMNS);
    const hydrated = hydrateRouteByExporter(toMaritimeRouteRows(rows));
    maritimeRoutesByImporterCache.set(normalizedImporter, hydrated);
    return hydrated;
  })().finally(() => {
    maritimeRoutesByImporterPromises.delete(normalizedImporter);
  });

  maritimeRoutesByImporterPromises.set(normalizedImporter, loadPromise);
  return loadPromise;
}