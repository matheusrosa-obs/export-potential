import { promises as fs } from "node:fs";
import path from "node:path";
import { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";

const DATA_DIRECTORY = path.join(process.cwd(), "public", "data");
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

type DescribeRow = {
  column_name: string;
  column_type: string;
  null: string | null;
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
  var __parquetConnectionPromise: Promise<DuckDBConnection> | undefined;
  var __parquetRegistry: DatasetRegistry | undefined;
  var __parquetRegistryPromise: Promise<DatasetRegistry> | undefined;
  var __parquetSchemaCache: Map<string, DatasetColumn[]> | undefined;
}

const schemaCache = globalThis.__parquetSchemaCache ?? new Map<string, DatasetColumn[]>();
globalThis.__parquetSchemaCache = schemaCache;

async function getConnection(): Promise<DuckDBConnection> {
  if (!globalThis.__parquetConnectionPromise) {
    globalThis.__parquetConnectionPromise = DuckDBInstance.create(":memory:")
      .then((instance) => instance.connect())
      .catch((error) => {
        globalThis.__parquetConnectionPromise = undefined;
        throw error;
      });
  }

  return globalThis.__parquetConnectionPromise;
}

function normalizePathForSql(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function queryRows<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
  const connection = await getConnection();
  const reader = await connection.runAndReadAll(sql);
  return reader.getRowObjectsJS() as T[];
}

function normalizeForJson(value: unknown): unknown {
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForJson(item));
  }

  if (value && typeof value === "object") {
    const normalized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      normalized[key] = normalizeForJson(item);
    }
    return normalized;
  }

  return value;
}

async function loadDatasetRegistry(): Promise<DatasetRegistry> {
  const directoryEntries = await fs.readdir(DATA_DIRECTORY, { withFileTypes: true });
  const parquetFiles = directoryEntries.filter(
    (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".parquet"),
  );

  const datasets = new Map<string, DatasetEntry>();

  for (const entry of parquetFiles) {
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

  return {
    loadedAt: Date.now(),
    datasets,
  };
}

async function getDatasetRegistry(forceRefresh = false): Promise<DatasetRegistry> {
  const cached = globalThis.__parquetRegistry;
  const cacheFresh =
    cached && Date.now() - cached.loadedAt < REGISTRY_TTL_MS;

  if (!forceRefresh && cacheFresh) {
    return cached;
  }

  if (globalThis.__parquetRegistryPromise) {
    return globalThis.__parquetRegistryPromise;
  }

  const refreshPromise = loadDatasetRegistry()
    .then((registry) => {
      globalThis.__parquetRegistry = registry;
      return registry;
    })
    .finally(() => {
      globalThis.__parquetRegistryPromise = undefined;
    });

  globalThis.__parquetRegistryPromise = refreshPromise;
  return refreshPromise;
}

async function getDatasetOrThrow(datasetId: string): Promise<DatasetEntry> {
  const registry = await getDatasetRegistry();
  const dataset = registry.datasets.get(datasetId);

  if (dataset) {
    return dataset;
  }

  const refreshed = await getDatasetRegistry(true);
  const updated = refreshed.datasets.get(datasetId);

  if (!updated) {
    throw new DatasetNotFoundError(`Dataset '${datasetId}' nao encontrado.`);
  }

  return updated;
}

async function getSchema(dataset: DatasetEntry): Promise<DatasetColumn[]> {
  const schemaKey = `${dataset.id}:${dataset.updatedAt}`;
  const cached = schemaCache.get(schemaKey);

  if (cached) {
    return cached;
  }

  const safePath = escapeSqlString(normalizePathForSql(dataset.filePath));
  const sql = `DESCRIBE SELECT * FROM read_parquet('${safePath}')`;
  const schemaRows = await queryRows<DescribeRow>(sql);

  const schema: DatasetColumn[] = schemaRows.map((row) => ({
    name: row.column_name,
    type: row.column_type,
    nullable: row.null === "YES",
  }));

  schemaCache.set(schemaKey, schema);
  return schema;
}

function normalizeSelectedColumns(
  requestedColumns: string[] | undefined,
  availableColumns: DatasetColumn[],
): string[] {
  if (!requestedColumns || requestedColumns.length === 0) {
    return [];
  }

  const available = new Set(availableColumns.map((column) => column.name));
  const uniqueRequested = Array.from(new Set(requestedColumns));

  for (const column of uniqueRequested) {
    if (!available.has(column)) {
      throw new InvalidQueryError(`Coluna invalida: '${column}'.`);
    }
  }

  return uniqueRequested;
}

function normalizeSortColumn(
  sortBy: string | undefined,
  availableColumns: DatasetColumn[],
): string | undefined {
  if (!sortBy) {
    return undefined;
  }

  const available = new Set(availableColumns.map((column) => column.name));
  if (!available.has(sortBy)) {
    throw new InvalidQueryError(`Coluna de ordenacao invalida: '${sortBy}'.`);
  }

  return sortBy;
}

export async function listAvailableDatasets(options?: {
  includeSchema?: boolean;
}): Promise<ListDatasetResult[]> {
  const includeSchema = options?.includeSchema ?? false;
  const registry = await getDatasetRegistry();
  const datasets = Array.from(registry.datasets.values()).sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  if (!includeSchema) {
    return datasets.map((dataset) => ({
      id: dataset.id,
      fileName: dataset.fileName,
      sizeBytes: dataset.sizeBytes,
      updatedAt: dataset.updatedAt,
    }));
  }

  return Promise.all(
    datasets.map(async (dataset) => ({
      id: dataset.id,
      fileName: dataset.fileName,
      sizeBytes: dataset.sizeBytes,
      updatedAt: dataset.updatedAt,
      schema: await getSchema(dataset),
    })),
  );
}

export async function queryDataset(
  options: QueryDatasetOptions,
): Promise<QueryDatasetResult> {
  const dataset = await getDatasetOrThrow(options.datasetId);
  const schema = await getSchema(dataset);
  const selectedColumns = normalizeSelectedColumns(options.columns, schema);
  const sortColumn = normalizeSortColumn(options.sortBy, schema);

  const safePath = escapeSqlString(normalizePathForSql(dataset.filePath));
  const projection =
    selectedColumns.length > 0
      ? selectedColumns.map((column) => quoteIdentifier(column)).join(", ")
      : "*";

  const orderByClause = sortColumn
    ? ` ORDER BY ${quoteIdentifier(sortColumn)} ${(options.sortDirection ?? "asc").toUpperCase()}`
    : "";

  const rowsSql = `SELECT ${projection} FROM read_parquet('${safePath}')${orderByClause} LIMIT ${options.limit} OFFSET ${options.offset}`;
  const rawRows = await queryRows<Record<string, unknown>>(rowsSql);

  let total: number | string | undefined;
  if (options.includeTotal) {
    const countSql = `SELECT COUNT(*) AS total FROM read_parquet('${safePath}')`;
    const countRows = await queryRows<{ total: unknown }>(countSql);
    total = normalizeForJson(countRows[0]?.total) as number | string | undefined;
  }

  const rows = rawRows.map((row) =>
    normalizeForJson(row) as Record<string, unknown>,
  );

  const outputColumns =
    selectedColumns.length > 0
      ? selectedColumns
      : schema.map((column) => column.name);

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
    total,
    rows,
  };
}
