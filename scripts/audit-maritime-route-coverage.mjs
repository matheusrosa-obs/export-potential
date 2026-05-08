import { DuckDBInstance } from "@duckdb/node-api";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const routesDir = path.join(root, "public", "data", "routes_by_importer");
const indexPath = path.join(routesDir, "index.json");

export function summarizeRouteCoverage(rows) {
  return rows.reduce(
    (acc, row) => {
      if (row.route_mode === "maritime") acc.maritime += 1;
      else if (row.route_mode === "straight_fallback") acc.straightFallback += 1;
      else acc.unavailable += 1;
      return acc;
    },
    { maritime: 0, straightFallback: 0, unavailable: 0 }
  );
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function loadIndexEntries() {
  const raw = await fs.readFile(indexPath, "utf-8");
  const entries = JSON.parse(raw);

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("index.json de routes_by_importer vazio ou invalido.");
  }

  return entries;
}

async function readRouteModeRows(connection, filePath) {
  const reader = await connection.runAndReadAll(`
    SELECT route_mode, COUNT(*) AS count
    FROM read_parquet('${filePath.replace(/\\/g, "/")}')
    GROUP BY route_mode
  `);

  return reader.getRowObjectsJS();
}

function mergeCoverageCounts(target, counts) {
  for (const row of counts) {
    const routeMode = String(row.route_mode ?? "unavailable");
    const count = Number(row.count) || 0;

    if (routeMode === "maritime") target.maritime += count;
    else if (routeMode === "straight_fallback") target.straightFallback += count;
    else target.unavailable += count;
  }
}

async function main() {
  const entries = await loadIndexEntries();
  const inst = await DuckDBInstance.create(":memory:");
  const connection = await inst.connect();
  const totals = { maritime: 0, straightFallback: 0, unavailable: 0 };
  let totalRows = 0;
  let totalBytes = 0;

  for (const entry of entries) {
    const filePath = path.join(routesDir, entry.file_name);
    const counts = await readRouteModeRows(connection, filePath);
    mergeCoverageCounts(totals, counts);
    totalRows += Number(entry.rows) || 0;
    totalBytes += Number(entry.size_bytes) || 0;
  }

  console.log(
    JSON.stringify(
      {
        partitions: entries.length,
        totalRows,
        totalBytes,
        totalBytesFormatted: formatBytes(totalBytes),
        coverage: totals,
      },
      null,
      2
    )
  );
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
