import { promises as fs } from "node:fs";
import path from "node:path";
import { parquetMetadata, parquetRead, parquetSchema } from "hyparquet";
import { compressors } from "hyparquet-compressors";

const DATA_DIRECTORY = path.join(process.cwd(), "public", "data");
const COMPETITORS_DIRECTORY = path.join(DATA_DIRECTORY, "competitors");
const COMPETITORS_INDEX_FILE = path.join(COMPETITORS_DIRECTORY, "index.json");
const COMPETITORS_BLOB_INDEX_FILE = path.join(COMPETITORS_DIRECTORY, "index.blob.json");
const UF_PARTITIONS_DIRECTORY = path.join(DATA_DIRECTORY, "ufs");
const UF_PARTITIONS_INDEX_FILE = path.join(UF_PARTITIONS_DIRECTORY, "index.json");
const UF_PARTITIONS_BLOB_INDEX_FILE = path.join(UF_PARTITIONS_DIRECTORY, "index.blob.json");
const UF_PARTITIONED_DATASETS = new Set([
  "epi_monetary_ufs",
  "epi_monetary_ufs_sh6",
  "epi_monetary_ufs_country",
]);
const REGISTRY_TTL_MS = 30_000;

const DEFAULT_COMPETITORS_PARQUET_CACHE_TTL_MS = 15 * 60_000;
const DEFAULT_COMPETITORS_PARQUET_CACHE_MAX_ENTRIES = 8;

type CompetitorsSourceMode = "local" | "blob";
type UfPartitionsSourceMode = "local" | "blob";

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
  blob_url?: string;
  rows?: number;
  sh6_count?: number;
  size_bytes?: number;
};

type UfPartitionIndexEntry = {
  dataset: string;
  sg_uf: string;
  file_name: string;
  blob_url?: string;
  rows?: number;
  size_bytes?: number;
};

type CompetitorIndexCache = {
  loadedAt: number;
  byImporter: Map<string, CompetitorIndexEntry>;
};

type UfPartitionsIndexCache = {
  loadedAt: number;
  byKey: Map<string, UfPartitionIndexEntry>;
};

type CompetitorParquetCacheEntry = {
  arrayBuffer: ArrayBuffer;
  loadedAt: number;
  lastAccessedAt: number;
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
  var __ufPartitionsIndexCache: UfPartitionsIndexCache | undefined;
  var __ufPartitionsIndexPromise:
    | Promise<UfPartitionsIndexCache | null>
    | undefined;
  var __competitorsParquetCache:
    | Map<string, CompetitorParquetCacheEntry>
    | undefined;
  var __competitorsParquetCachePromises:
    | Map<string, Promise<ArrayBuffer>>
    | undefined;
}

const schemaCache =
  globalThis.__parquetSchemaCache ?? new Map<string, DatasetColumn[]>();
globalThis.__parquetSchemaCache = schemaCache;

const competitorsParquetCache =
  globalThis.__competitorsParquetCache ??
  new Map<string, CompetitorParquetCacheEntry>();
globalThis.__competitorsParquetCache = competitorsParquetCache;

const competitorsParquetCachePromises =
  globalThis.__competitorsParquetCachePromises ??
  new Map<string, Promise<ArrayBuffer>>();
globalThis.__competitorsParquetCachePromises = competitorsParquetCachePromises;


function parsePositiveIntEnv(
  value: string | undefined,
  fallback: number
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const COMPETITORS_PARQUET_CACHE_TTL_MS = parsePositiveIntEnv(
  process.env.COMPETITORS_PARQUET_CACHE_TTL_MS,
  DEFAULT_COMPETITORS_PARQUET_CACHE_TTL_MS
);

const COMPETITORS_PARQUET_CACHE_MAX_ENTRIES = parsePositiveIntEnv(
  process.env.COMPETITORS_PARQUET_CACHE_MAX_ENTRIES,
  DEFAULT_COMPETITORS_PARQUET_CACHE_MAX_ENTRIES
);

function isRemotePath(filePathOrUrl: string): boolean {
  return /^https?:\/\//i.test(filePathOrUrl);
}

function toAsyncBuffer(arrayBuffer: ArrayBuffer) {
  return {
    byteLength: arrayBuffer.byteLength,
    slice: (start: number, end: number) =>
      Promise.resolve(arrayBuffer.slice(start, end)),
  };
}

async function readArrayBuffer(filePathOrUrl: string): Promise<ArrayBuffer> {
  if (isRemotePath(filePathOrUrl)) {
    const response = await fetch(filePathOrUrl);
    if (!response.ok) {
      throw new Error(
        `Falha ao baixar parquet remoto (${response.status}): ${filePathOrUrl}`
      );
    }
    return response.arrayBuffer();
  }

  const buffer = await fs.readFile(filePathOrUrl);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

function getCachedCompetitorParquet(cacheKey: string): ArrayBuffer | undefined {
  const cached = competitorsParquetCache.get(cacheKey);
  if (!cached) return undefined;

  const now = Date.now();
  const expired = now - cached.loadedAt > COMPETITORS_PARQUET_CACHE_TTL_MS;
  if (expired) {
    competitorsParquetCache.delete(cacheKey);
    return undefined;
  }

  cached.lastAccessedAt = now;
  return cached.arrayBuffer;
}

function pruneCompetitorsParquetCache(now: number) {
  if (COMPETITORS_PARQUET_CACHE_MAX_ENTRIES <= 0) {
    competitorsParquetCache.clear();
    return;
  }

  for (const [key, entry] of competitorsParquetCache.entries()) {
    if (now - entry.loadedAt > COMPETITORS_PARQUET_CACHE_TTL_MS) {
      competitorsParquetCache.delete(key);
    }
  }

  if (competitorsParquetCache.size <= COMPETITORS_PARQUET_CACHE_MAX_ENTRIES) {
    return;
  }

  const orderedByLastAccess = Array.from(competitorsParquetCache.entries()).sort(
    (a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt
  );

  while (competitorsParquetCache.size > COMPETITORS_PARQUET_CACHE_MAX_ENTRIES) {
    const oldest = orderedByLastAccess.shift();
    if (!oldest) break;
    competitorsParquetCache.delete(oldest[0]);
  }
}

function setCachedCompetitorParquet(cacheKey: string, arrayBuffer: ArrayBuffer) {
  if (
    COMPETITORS_PARQUET_CACHE_MAX_ENTRIES <= 0 ||
    COMPETITORS_PARQUET_CACHE_TTL_MS <= 0
  ) {
    return;
  }

  const now = Date.now();
  competitorsParquetCache.set(cacheKey, {
    arrayBuffer,
    loadedAt: now,
    lastAccessedAt: now,
  });

  pruneCompetitorsParquetCache(now);
}

/** Read local or remote parquet and return an AsyncBuffer compatible with hyparquet. */
async function readAsyncBuffer(
  filePathOrUrl: string,
  options?: { useParquetCache?: boolean }
) {
  const cacheEnabled =
    options?.useParquetCache === true &&
    isRemotePath(filePathOrUrl) &&
    COMPETITORS_PARQUET_CACHE_MAX_ENTRIES > 0 &&
    COMPETITORS_PARQUET_CACHE_TTL_MS > 0;

  if (!cacheEnabled) {
    const arrayBuffer = await readArrayBuffer(filePathOrUrl);
    return toAsyncBuffer(arrayBuffer);
  }

  const cached = getCachedCompetitorParquet(filePathOrUrl);
  if (cached) {
    return toAsyncBuffer(cached);
  }

  const inFlight = competitorsParquetCachePromises.get(filePathOrUrl);
  if (inFlight) {
    const arrayBuffer = await inFlight;
    return toAsyncBuffer(arrayBuffer);
  }

  const loadPromise = readArrayBuffer(filePathOrUrl)
    .then((arrayBuffer) => {
      setCachedCompetitorParquet(filePathOrUrl, arrayBuffer);
      return arrayBuffer;
    })
    .finally(() => {
      competitorsParquetCachePromises.delete(filePathOrUrl);
    });

  competitorsParquetCachePromises.set(filePathOrUrl, loadPromise);

  const arrayBuffer = await loadPromise;
  return toAsyncBuffer(arrayBuffer);
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
  const sourceMode = resolveCompetitorsSourceMode();
  const indexFilePath = await resolveCompetitorsIndexFile(sourceMode);

  const raw = await fs.readFile(indexFilePath, "utf-8");
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

function resolveCompetitorsSourceMode(): CompetitorsSourceMode {
  const explicit = process.env.COMPETITORS_SOURCE?.trim().toLowerCase();
  if (explicit === "local" || explicit === "blob") {
    return explicit;
  }

  const vercelFlag = process.env.VERCEL?.trim().toLowerCase();
  const runningOnVercel = vercelFlag === "1" || vercelFlag === "true";

  return runningOnVercel ? "blob" : "local";
}

async function resolveCompetitorsIndexFile(
  sourceMode: CompetitorsSourceMode
): Promise<string> {
  const explicit = process.env.COMPETITORS_INDEX_FILE?.trim();
  if (explicit === "index.json") {
    await fs.access(COMPETITORS_INDEX_FILE);
    return COMPETITORS_INDEX_FILE;
  }

  if (explicit === "index.blob.json") {
    await fs.access(COMPETITORS_BLOB_INDEX_FILE);
    return COMPETITORS_BLOB_INDEX_FILE;
  }

  if (sourceMode === "local") {
    await fs.access(COMPETITORS_INDEX_FILE);
    return COMPETITORS_INDEX_FILE;
  }

  const blobIndexExists = await fs
    .access(COMPETITORS_BLOB_INDEX_FILE)
    .then(() => true)
    .catch(() => false);

  if (blobIndexExists) {
    return COMPETITORS_BLOB_INDEX_FILE;
  }

  await fs.access(COMPETITORS_INDEX_FILE);
  return COMPETITORS_INDEX_FILE;
}

function normalizeUfCode(value: string): string {
  return value.trim().toUpperCase();
}

function resolveUfPartitionsSourceMode(): UfPartitionsSourceMode {
  const explicit = process.env.UF_PARTITIONS_SOURCE?.trim().toLowerCase();
  if (explicit === "local" || explicit === "blob") {
    return explicit;
  }

  const vercelFlag = process.env.VERCEL?.trim().toLowerCase();
  const runningOnVercel = vercelFlag === "1" || vercelFlag === "true";

  return runningOnVercel ? "blob" : "local";
}

async function resolveUfPartitionsIndexFile(
  sourceMode: UfPartitionsSourceMode
): Promise<string | null> {
  const explicit = process.env.UF_PARTITIONS_INDEX_FILE?.trim();
  if (explicit === "index.json") {
    return fs
      .access(UF_PARTITIONS_INDEX_FILE)
      .then(() => UF_PARTITIONS_INDEX_FILE)
      .catch(() => null);
  }

  if (explicit === "index.blob.json") {
    return fs
      .access(UF_PARTITIONS_BLOB_INDEX_FILE)
      .then(() => UF_PARTITIONS_BLOB_INDEX_FILE)
      .catch(() => null);
  }

  if (sourceMode === "local") {
    const localExists = await fs
      .access(UF_PARTITIONS_INDEX_FILE)
      .then(() => true)
      .catch(() => false);
    if (localExists) return UF_PARTITIONS_INDEX_FILE;
  }

  const blobIndexExists = await fs
    .access(UF_PARTITIONS_BLOB_INDEX_FILE)
    .then(() => true)
    .catch(() => false);

  if (blobIndexExists) {
    return UF_PARTITIONS_BLOB_INDEX_FILE;
  }

  const localFallbackExists = await fs
    .access(UF_PARTITIONS_INDEX_FILE)
    .then(() => true)
    .catch(() => false);
  if (localFallbackExists) {
    return UF_PARTITIONS_INDEX_FILE;
  }

  return null;
}

async function loadUfPartitionsIndex(): Promise<UfPartitionsIndexCache> {
  const sourceMode = resolveUfPartitionsSourceMode();
  const byKey = new Map<string, UfPartitionIndexEntry>();

  if (sourceMode === "local") {
    for (const datasetId of UF_PARTITIONED_DATASETS) {
      const indexFile = path.join(UF_PARTITIONS_DIRECTORY, datasetId, "index.json");
      const raw = await fs.readFile(indexFile, "utf-8");
      const parsed = JSON.parse(raw) as Omit<UfPartitionIndexEntry, "dataset">[];
      for (const entry of parsed) {
        if (!entry?.sg_uf || !entry?.file_name) continue;
        const normalizedUf = normalizeUfCode(entry.sg_uf);
        byKey.set(`${datasetId}:${normalizedUf}`, {
          ...entry,
          dataset: datasetId,
          sg_uf: normalizedUf,
        });
      }
    }
  } else {
    const indexFilePath = await resolveUfPartitionsIndexFile(sourceMode);
    if (!indexFilePath) {
      throw new Error("Index de particoes por UF nao encontrado.");
    }
    const raw = await fs.readFile(indexFilePath, "utf-8");
    const parsed = JSON.parse(raw) as UfPartitionIndexEntry[];
    for (const entry of parsed) {
      if (!entry?.dataset || !entry?.sg_uf || !entry?.file_name) continue;
      const normalizedUf = normalizeUfCode(entry.sg_uf);
      byKey.set(`${entry.dataset}:${normalizedUf}`, {
        ...entry,
        sg_uf: normalizedUf,
      });
    }
  }

  return { loadedAt: Date.now(), byKey };
}

async function getUfPartitionsIndex(
  forceRefresh = false
): Promise<UfPartitionsIndexCache | null> {
  const cached = globalThis.__ufPartitionsIndexCache;
  const cacheFresh =
    cached && cached.byKey.size > 0 && Date.now() - cached.loadedAt < REGISTRY_TTL_MS;

  if (!forceRefresh && cacheFresh) return cached;
  if (globalThis.__ufPartitionsIndexPromise)
    return globalThis.__ufPartitionsIndexPromise;

  const promise = loadUfPartitionsIndex()
    .then((indexCache) => {
      globalThis.__ufPartitionsIndexCache = indexCache;
      return indexCache;
    })
    .catch(() => null)
    .finally(() => {
      globalThis.__ufPartitionsIndexPromise = undefined;
    });

  globalThis.__ufPartitionsIndexPromise = promise;
  return promise;
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
  const sourceMode = resolveCompetitorsSourceMode();

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

  if (sourceMode === "local") {
    const localFilePath = path.join(COMPETITORS_DIRECTORY, entry.file_name);
    const stat = await fs.stat(localFilePath).catch(() => null);

    if (!stat) {
      throw new DatasetNotFoundError(
        `Arquivo de particao local nao encontrado: '${entry.file_name}'.`
      );
    }

    return {
      id: "df_competitors",
      fileName: entry.file_name,
      filePath: localFilePath,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
    };
  }

  if (!entry.blob_url) {
    throw new InvalidQueryError(
      `Index de competitors sem blob_url para importer='${normalizedImporter}' em modo Blob.`
    );
  }

  return {
    id: "df_competitors",
    fileName: entry.file_name,
    filePath: entry.blob_url,
    sizeBytes: entry.size_bytes ?? 0,
    updatedAt: new Date(indexCache.loadedAt).toISOString(),
  };
}

async function getUfPartitionDataset(
  datasetId: string,
  uf: string
): Promise<DatasetEntry | null> {
  if (!UF_PARTITIONED_DATASETS.has(datasetId)) return null;

  const normalizedUf = normalizeUfCode(uf);
  if (!normalizedUf) return null;

  const sourceMode = resolveUfPartitionsSourceMode();
  if (sourceMode === "local") {
    const baseDir = path.join(UF_PARTITIONS_DIRECTORY, datasetId);
    const candidates = [
      path.join(baseDir, `sg_uf=${normalizedUf}.parquet`),
      path.join(baseDir, `${normalizedUf}.parquet`),
    ];

    for (const filePath of candidates) {
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat) continue;

      return {
        id: datasetId,
        fileName: path.basename(filePath),
        filePath,
        sizeBytes: stat.size,
        updatedAt: stat.mtime.toISOString(),
      };
    }

    return null;
  }

  const indexCache = await getUfPartitionsIndex();
  if (!indexCache) return null;

  const entry = indexCache.byKey.get(`${datasetId}:${normalizedUf}`);
  if (!entry || !entry.blob_url) return null;

  return {
    id: datasetId,
    fileName: entry.file_name,
    filePath: entry.blob_url,
    sizeBytes: entry.size_bytes ?? 0,
    updatedAt: new Date(indexCache.loadedAt).toISOString(),
  };
}

function shouldUseParquetCache(dataset: DatasetEntry): boolean {
  if (!isRemotePath(dataset.filePath)) return false;
  if (dataset.id === "df_competitors") return true;
  return UF_PARTITIONED_DATASETS.has(dataset.id);
}

async function getSchema(dataset: DatasetEntry): Promise<DatasetColumn[]> {
  const schemaKey = `${dataset.id}:${dataset.updatedAt}`;
  const cached = schemaCache.get(schemaKey);
  if (cached) return cached;

  const asyncBuffer = await readAsyncBuffer(dataset.filePath, {
    useParquetCache: shouldUseParquetCache(dataset),
  });
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
    const ufFilter = options.filters?.sg_uf;
    const ufDataset = ufFilter
      ? await getUfPartitionDataset(options.datasetId, ufFilter)
      : null;

    dataset = ufDataset ?? await getDatasetOrThrow(options.datasetId);

    if (ufDataset && effectiveFilters) {
      const { sg_uf: _ignored, ...remainingFilters } = effectiveFilters;
      effectiveFilters =
        Object.keys(remainingFilters).length > 0 ? remainingFilters : undefined;
    }
  }

  const schema = await getSchema(dataset);
  const selectedColumns = normalizeSelectedColumns(options.columns, schema);

  if (options.sortBy) {
    const available = new Set(schema.map((c) => c.name));
    if (!available.has(options.sortBy))
      throw new InvalidQueryError(`Coluna de ordenacao invalida: '${options.sortBy}'.`);
  }

  const asyncBuffer = await readAsyncBuffer(dataset.filePath, {
    useParquetCache: shouldUseParquetCache(dataset),
  });

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
