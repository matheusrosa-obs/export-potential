import { promises as fs } from "node:fs";
import path from "node:path";
import { parquetMetadata, parquetRead, parquetSchema } from "hyparquet";
import { compressors } from "hyparquet-compressors";

const DATA_DIRECTORY = path.join(process.cwd(), "public", "data");
const COMPETITORS_DIRECTORY = path.join(DATA_DIRECTORY, "competitors");
const COMPETITORS_INDEX_FILE = path.join(COMPETITORS_DIRECTORY, "index.json");
const REGISTRY_TTL_MS = 30_000;

export const DEFAULT_LIMIT = 500;
export const MAX_LIMIT = 5_000;

export type DatasetColumn = {
  name: string;
  type: string;
  nullable: boolean;
};

type DatasetEntry = {
  id: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
  updatedAt: string;
};

type DatasetRegistry = {
  loadedAt: number;
  datasets: Map<string, DatasetEntry>;
};

type CompetitorIndexEntry = {
  importer: string;
  file_name: string;
  rows?: number;
  sh6_count?: number;
  size_bytes?: number;
};

type CompetitorIndexCache = {
  loadedAt: number;
  byImporter: Map<string, CompetitorIndexEntry>;
};

export type ListDatasetResult = {
  id: string;
  fileName: string;
  sizeBytes: number;
  updatedAt: string;
  schema?: DatasetColumn[];
};

export type QueryDatasetOptions = {
  datasetId: string;
  columns?: string[];
  limit: number;
  offset: number;
  includeTotal: boolean;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  filters?: Record<string, string>;
};

export type QueryDatasetResult = {
  dataset: {
    id: string;
    fileName: string;
    sizeBytes: number;
    updatedAt: string;
  };
  columns: string[];
  limit: number;
  offset: number;
  total?: number | string;
  rows: Record<string, unknown>[];
};

export class DatasetNotFoundError extends Error {}
export class InvalidQueryError extends Error {}

declare global {
  var __parquetRegistry: DatasetRegistry | undefined;
  var __parquetRegistryPromise: Promise<DatasetRegistry> | undefined;
  var __parquetSchemaCache: Map<string, DatasetColumn[]> | undefined;
  var __competitorsIndexCache: CompetitorIndexCache | undefined;
  var __competitorsIndexPromise: Promise<CompetitorIndexCache> | undefined;
}

const schemaCache =
  globalThis.__parquetSchemaCache ?? new Map<string, DatasetColumn[]>();
globalThis.__parquetSchemaCache = schemaCache;

/** Read a parquet file and return an AsyncBuffer compatible with hyparquet. */
async function readAsyncBuffer(filePath: string) {
  const buffer = await fs.readFile(filePath);
  const arrayBuffer: ArrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
  return {
    byteLength: arrayBuffer.byteLength,
    slice: (start: number, end: number) =>
      Promise.resolve(arrayBuffer.slice(start, end)),
  };
}

async function loadDatasetRegistry(): Promise<DatasetRegistry> {
  const entries = await fs.readdir(DATA_DIRECTORY, { withFileTypes: true });
  const datasets = new Map<string, DatasetEntry>();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".parquet"))
      continue;
    const filePath = path.join(DATA_DIRECTORY, entry.name);
    const stat = await fs.stat(filePath);
    const id = path.basename(entry.name, ".parquet");
    datasets.set(id, {
      id,
      fileName: entry.name,
      filePath,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  }

  return { loadedAt: Date.now(), datasets };
}

async function getDatasetRegistry(forceRefresh = false): Promise<DatasetRegistry> {
  const cached = globalThis.__parquetRegistry;
  const cacheFresh = cached && Date.now() - cached.loadedAt < REGISTRY_TTL_MS;

  if (!forceRefresh && cacheFresh) return cached;
  if (globalThis.__parquetRegistryPromise) return globalThis.__parquetRegistryPromise;

  const promise = loadDatasetRegistry()
    .then((registry) => {
      globalThis.__parquetRegistry = registry;
      return registry;
    })
    .finally(() => {
      globalThis.__parquetRegistryPromise = undefined;
    });

  globalThis.__parquetRegistryPromise = promise;
  return promise;
}

async function getDatasetOrThrow(datasetId: string): Promise<DatasetEntry> {
  const registry = await getDatasetRegistry();
  const dataset = registry.datasets.get(datasetId);
  if (dataset) return dataset;

  const refreshed = await getDatasetRegistry(true);
  const updated = refreshed.datasets.get(datasetId);
  if (!updated) throw new DatasetNotFoundError(`Dataset '${datasetId}' nao encontrado.`);
  return updated;
}

async function loadCompetitorsIndex(): Promise<CompetitorIndexCache> {
  const raw = await fs.readFile(COMPETITORS_INDEX_FILE, "utf-8");
  const parsed = JSON.parse(raw) as CompetitorIndexEntry[];

  const byImporter = new Map<string, CompetitorIndexEntry>();
  for (const entry of parsed) {
    if (!entry?.importer || !entry?.file_name) continue;
    byImporter.set(entry.importer.toUpperCase(), entry);
  }

  return {
    loadedAt: Date.now(),
    byImporter,
  };
}

async function getCompetitorsIndex(forceRefresh = false): Promise<CompetitorIndexCache> {
  const cached = globalThis.__competitorsIndexCache;
  const cacheFresh = cached && Date.now() - cached.loadedAt < REGISTRY_TTL_MS;

  if (!forceRefresh && cacheFresh) return cached;
  if (globalThis.__competitorsIndexPromise) return globalThis.__competitorsIndexPromise;

  const promise = loadCompetitorsIndex()
    .then((indexCache) => {
      globalThis.__competitorsIndexCache = indexCache;
      return indexCache;
    })
    .finally(() => {
      globalThis.__competitorsIndexPromise = undefined;
    });

  globalThis.__competitorsIndexPromise = promise;
  return promise;
}

async function getCompetitorPartitionDataset(importer: string): Promise<DatasetEntry> {
  const normalizedImporter = importer.trim().toUpperCase();
  if (!normalizedImporter) {
    throw new InvalidQueryError("Filtro 'importer' vazio para df_competitors.");
  }

  const indexCache = await getCompetitorsIndex();
  const entry = indexCache.byImporter.get(normalizedImporter);
  if (!entry) {
    throw new DatasetNotFoundError(
      `Particao de df_competitors nao encontrada para importer='${normalizedImporter}'.`
    );
  }

  const filePath = path.join(COMPETITORS_DIRECTORY, entry.file_name);
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat) {
    throw new DatasetNotFoundError(
      `Arquivo de particao nao encontrado: '${entry.file_name}'.`
    );
  }

  return {
    id: "df_competitors",
    fileName: entry.file_name,
    filePath,
    sizeBytes: stat.size,
    updatedAt: stat.mtime.toISOString(),
  };
}

async function getSchema(dataset: DatasetEntry): Promise<DatasetColumn[]> {
  const schemaKey = `${dataset.id}:${dataset.updatedAt}`;
  const cached = schemaCache.get(schemaKey);
  if (cached) return cached;

  const asyncBuffer = await readAsyncBuffer(dataset.filePath);
  const metadata = parquetMetadata(await asyncBuffer.slice(0, asyncBuffer.byteLength));
  const schema = parquetSchema(metadata);

  const columns: DatasetColumn[] = schema.children.map((field: any) => ({
    name: field.element.name,
    type: field.element.type ?? field.element.converted_type ?? "BYTE_ARRAY",
    nullable: field.element.repetition_type !== "REQUIRED",
  }));

  schemaCache.set(schemaKey, columns);
  return columns;
}

function normalizeSelectedColumns(
  requestedColumns: string[] | undefined,
  availableColumns: DatasetColumn[]
): string[] {
  if (!requestedColumns || requestedColumns.length === 0) return [];
  const available = new Set(availableColumns.map((c) => c.name));
  const unique = Array.from(new Set(requestedColumns));
  for (const col of unique) {
    if (!available.has(col))
      throw new InvalidQueryError(`Coluna invalida: '${col}'.`);
  }
  return unique;
}

function normalizeForJson(value: unknown): unknown {
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : value.toString();
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeForJson);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      out[k] = normalizeForJson(v);
    return out;
  }
  return value;
}

export async function listAvailableDatasets(options?: {
  includeSchema?: boolean;
}): Promise<ListDatasetResult[]> {
  const registry = await getDatasetRegistry();
  const datasets = Array.from(registry.datasets.values()).sort((a, b) =>
    a.id.localeCompare(b.id)
  );

  if (!options?.includeSchema) {
    return datasets.map(({ id, fileName, sizeBytes, updatedAt }) => ({
      id, fileName, sizeBytes, updatedAt,
    }));
  }

  return Promise.all(
    datasets.map(async (d) => ({
      id: d.id,
      fileName: d.fileName,
      sizeBytes: d.sizeBytes,
      updatedAt: d.updatedAt,
      schema: await getSchema(d),
    }))
  );
}

export async function queryDataset(
  options: QueryDatasetOptions
): Promise<QueryDatasetResult> {
  let dataset: DatasetEntry;
  let effectiveFilters = options.filters;

  if (options.datasetId === "df_competitors") {
    const importer = options.filters?.importer;
    if (!importer) {
      throw new InvalidQueryError(
        "Dataset 'df_competitors' requer o filtro filter[importer]."
      );
    }

    dataset = await getCompetitorPartitionDataset(importer);

    if (effectiveFilters) {
      const { importer: _ignored, ...remainingFilters } = effectiveFilters;
      effectiveFilters =
        Object.keys(remainingFilters).length > 0 ? remainingFilters : undefined;
    }
  } else {
    dataset = await getDatasetOrThrow(options.datasetId);
  }

  const schema = await getSchema(dataset);
  const selectedColumns = normalizeSelectedColumns(options.columns, schema);

  if (options.sortBy) {
    const available = new Set(schema.map((c) => c.name));
    if (!available.has(options.sortBy))
      throw new InvalidQueryError(`Coluna de ordenacao invalida: '${options.sortBy}'.`);
  }

  const asyncBuffer = await readAsyncBuffer(dataset.filePath);

  // Columns needed for filters that aren't already in the requested projection
  const filterCols = effectiveFilters ? Object.keys(effectiveFilters) : [];
  const available = new Set(schema.map((c) => c.name));
  for (const col of filterCols) {
    if (!available.has(col))
      throw new InvalidQueryError(`Coluna de filtro invalida: '${col}'.`);
  }

  // Extra filter columns that must be read but should not appear in the output
  const extraFilterCols =
    selectedColumns.length > 0
      ? filterCols.filter((c) => !selectedColumns.includes(c))
      : [];

  const readColumns =
    selectedColumns.length > 0
      ? Array.from(new Set([...selectedColumns, ...extraFilterCols]))
      : undefined; // undefined = read all

  // Column names for the projection (in schema order)
  const projectionNames = readColumns ?? schema.map((c) => c.name);

  // Read all rows — hyparquet returns arrays, not objects
  let rawRows: unknown[][] = [];
  await parquetRead({
    file: asyncBuffer,
    compressors,
    columns: readColumns,
    onComplete(rows) {
      rawRows = rows as unknown[][];
    },
  });

  // Map arrays → objects using column names
  let allRows: Record<string, unknown>[] = rawRows.map((row) =>
    Object.fromEntries(projectionNames.map((name, i) => [name, row[i]]))
  );

  // Filter in memory when requested
  if (effectiveFilters && Object.keys(effectiveFilters).length > 0) {
    for (const [col, val] of Object.entries(effectiveFilters)) {
      allRows = allRows.filter((row) => String(row[col]) === val);
    }
  }

  // Remove extra filter columns that weren't originally requested
  if (extraFilterCols.length > 0) {
    const keep = new Set(selectedColumns);
    allRows = allRows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const k of keep) out[k] = row[k];
      return out;
    });
  }

  // Sort in memory when requested
  if (options.sortBy) {
    const key = options.sortBy;
    const dir = options.sortDirection === "desc" ? -1 : 1;
    allRows.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }

  const total = allRows.length;
  const sliced = allRows.slice(options.offset, options.offset + options.limit);
  const rows = sliced.map((r) => normalizeForJson(r) as Record<string, unknown>);

  const outputColumns =
    selectedColumns.length > 0 ? selectedColumns : projectionNames;

  return {
    dataset: {
      id: dataset.id,
      fileName: dataset.fileName,
      sizeBytes: dataset.sizeBytes,
      updatedAt: dataset.updatedAt,
    },
    columns: outputColumns,
    limit: options.limit,
    offset: options.offset,
    total: options.includeTotal ? total : undefined,
    rows,
  };
}
