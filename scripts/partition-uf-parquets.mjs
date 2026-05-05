import { DuckDBInstance } from "@duckdb/node-api";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "../public/data");
const outDir = path.join(dataDir, "ufs");
const force = process.argv.includes("--force");

const DATASETS = [
  { id: "epi_monetary_ufs", file: "epi_monetary_ufs.parquet" },
  { id: "epi_monetary_ufs_sh6", file: "epi_monetary_ufs_sh6.parquet" },
  { id: "epi_monetary_ufs_country", file: "epi_monetary_ufs_country.parquet" },
];

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

async function fileExists(filePath) {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}

function toPosix(filePath) {
  return filePath.replace(/\\/g, "/");
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const inst = await DuckDBInstance.create(":memory:");
  const conn = await inst.connect();
  const indexEntries = [];

  for (const dataset of DATASETS) {
    const datasetPath = path.join(dataDir, dataset.file);
    if (!(await fileExists(datasetPath))) {
      console.warn(`Arquivo nao encontrado: ${datasetPath}`);
      continue;
    }

    const datasetOutDir = path.join(outDir, dataset.id);
    await fs.mkdir(datasetOutDir, { recursive: true });

    const sourcePath = toPosix(datasetPath);

    for (const uf of UFS) {
      const outFile = path.join(datasetOutDir, `sg_uf=${uf}.parquet`);
      if (!force && (await fileExists(outFile))) {
        const stat = await fs.stat(outFile);
        indexEntries.push({
          dataset: dataset.id,
          sg_uf: uf,
          file_name: path.basename(outFile),
          size_bytes: stat.size,
        });
        continue;
      }

      const outPath = toPosix(outFile);
      console.log(`Gerando ${dataset.id} / ${uf} ...`);
      await conn.run(
        `COPY (SELECT * FROM read_parquet('${sourcePath}') WHERE sg_uf='${uf}') TO '${outPath}' (FORMAT 'parquet')`
      );

      const stat = await fs.stat(outFile);
      indexEntries.push({
        dataset: dataset.id,
        sg_uf: uf,
        file_name: path.basename(outFile),
        size_bytes: stat.size,
      });
    }
  }

  const indexPath = path.join(outDir, "index.json");
  await fs.writeFile(indexPath, JSON.stringify(indexEntries, null, 2), "utf-8");
  console.log(`Index gerado: ${indexPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
