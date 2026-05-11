import { DuckDBInstance } from "@duckdb/node-api";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import searoute from "searoute-js";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const countryCoordsPath = path.join(root, "lib", "country-coords.json");
const outDir = path.join(root, "public", "data", "routes_by_importer");
const indexPath = path.join(outDir, "index.json");

export function buildDirectedPairs(coords, importers) {
  const countries = Object.keys(coords).sort();
  const importerSet = importers?.length
    ? new Set(importers.map((code) => String(code).trim().toUpperCase()).filter(Boolean))
    : null;
  const pairs = [];

  for (const importer of countries) {
    if (importerSet && !importerSet.has(importer)) continue;

    for (const exporter of countries) {
      if (exporter === importer) continue;
      pairs.push({ importer, exporter });
    }
  }

  return pairs;
}

export function groupRowsByImporter(rows) {
  return rows.reduce((acc, row) => {
    (acc[row.importer] ??= []).push(row);
    return acc;
  }, {});
}

function parseImporterFilter() {
  const raw = process.env.MARITIME_IMPORTERS?.trim();
  if (!raw) return [];

  return raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}

function limitImporters(importers) {
  const maxImporters = Number(process.env.MARITIME_MAX_IMPORTERS ?? "");
  if (!Number.isFinite(maxImporters) || maxImporters <= 0) return importers;
  return importers.slice(0, maxImporters);
}

function toPoint([lon, lat]) {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Point",
      coordinates: [lon, lat],
    },
  };
}

function sameCoord(left, right, epsilon = 1e-6) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length >= 2 &&
    right.length >= 2 &&
    Math.abs(left[0] - right[0]) <= epsilon &&
    Math.abs(left[1] - right[1]) <= epsilon
  );
}

function withSilencedConsoleLog(fn) {
  const originalLog = console.log;
  console.log = () => {};

  try {
    return fn();
  } finally {
    console.log = originalLog;
  }
}

function buildUnavailableRouteRow(exporter, importer) {
  return {
    importer,
    exporter,
    distance_km: 0,
    route_mode: "unavailable",
    path_coords_json: "[]",
    snap_origin: false,
    snap_destination: false,
    source: "searoute-js",
  };
}

function buildRouteRow(exporter, importer, countryCoords) {
  const origin = countryCoords[exporter];
  const destination = countryCoords[importer];

  if (!origin || !destination) {
    return buildUnavailableRouteRow(exporter, importer);
  }

  try {
    const route = withSilencedConsoleLog(() =>
      searoute(toPoint(origin), toPoint(destination), "kilometers")
    );
    const coords = route?.geometry?.coordinates ?? [];

    if (!Array.isArray(coords) || coords.length < 2) {
      return buildUnavailableRouteRow(exporter, importer);
    }

    return {
      importer,
      exporter,
      distance_km: Number(route?.properties?.length ?? 0),
      route_mode: "maritime",
      path_coords_json: JSON.stringify(coords),
      snap_origin: !sameCoord(coords[0], origin),
      snap_destination: !sameCoord(coords[coords.length - 1], destination),
      source: "searoute-js",
    };
  } catch {
    return buildUnavailableRouteRow(exporter, importer);
  }
}

async function resetOutputDirectory() {
  await fs.mkdir(outDir, { recursive: true });
}

async function loadCountryCoords() {
  const raw = await fs.readFile(countryCoordsPath, "utf-8");
  return JSON.parse(raw);
}

async function writeImporterPartition(connection, importer, rows) {
  const jsonPath = path.join(os.tmpdir(), `maritime-routes-${importer}.json`);
  const tempParquetPath = path.join(
    os.tmpdir(),
    `maritime-routes-${importer}.${Date.now()}.${Math.random().toString(36).slice(2)}.parquet`
  );
  const parquetPath = path.join(outDir, `importer=${importer}.parquet`);

  await fs.writeFile(jsonPath, JSON.stringify(rows), "utf-8");

  try {
    await connection.run(`
      COPY (
        SELECT *
        FROM read_json_auto('${jsonPath.replace(/\\/g, "/")}')
      ) TO '${tempParquetPath.replace(/\\/g, "/")}' (FORMAT PARQUET);
    `);
  } finally {
    await fs.rm(jsonPath, { force: true });
  }

  await fs.copyFile(tempParquetPath, parquetPath);
  await fs.rm(tempParquetPath, { force: true }).catch(() => {});

  const stat = await fs.stat(parquetPath);

  return {
    importer,
    file_name: `importer=${importer}.parquet`,
    rows: rows.length,
    size_bytes: stat.size,
  };
}

async function main() {
  const countryCoords = await loadCountryCoords();
  const importerFilter = parseImporterFilter();
  const pairs = buildDirectedPairs(countryCoords, importerFilter);
  const groupedPairs = groupRowsByImporter(pairs);
  const importers = limitImporters(Object.keys(groupedPairs).sort());

  if (importers.length === 0) {
    throw new Error("Nenhum importer selecionado para gerar rotas maritimas.");
  }

  await resetOutputDirectory();

  const inst = await DuckDBInstance.create(":memory:");
  const connection = await inst.connect();
  const indexEntries = [];

  for (const [index, importer] of importers.entries()) {
    const importerPairs = groupedPairs[importer] ?? [];
    const rows = importerPairs.map(({ exporter }) =>
      buildRouteRow(exporter, importer, countryCoords)
    );
    const entry = await writeImporterPartition(connection, importer, rows);
    indexEntries.push(entry);
    console.log(
      `[${index + 1}/${importers.length}] ${importer}: ${entry.rows} rows, ${entry.size_bytes} bytes`
    );
  }

  await fs.writeFile(indexPath, JSON.stringify(indexEntries, null, 2), "utf-8");
  console.log(`Wrote ${indexPath} with ${indexEntries.length} partitions.`);
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
