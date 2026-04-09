import { DuckDBInstance } from "@duckdb/node-api";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coords = JSON.parse(readFileSync(path.join(__dirname, "../lib/country-coords.json"), "utf-8"));
const filePath = path.join(__dirname, "../public/data/epi_monetary_sc_country.parquet").replace(/\\/g, "/");

const inst = await DuckDBInstance.create(":memory:");
const conn = await inst.connect();
const r = await conn.runAndReadAll(`SELECT DISTINCT importer FROM read_parquet('${filePath}') ORDER BY importer`);
const countries = r.getRowObjectsJS().map(row => row.importer);
const missing = countries.filter(c => !coords[c]);
console.log(`Total: ${countries.length} | Covered: ${countries.length - missing.length} | Missing (${missing.length}):`, missing);
