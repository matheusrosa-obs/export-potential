import { promises as fs } from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";

const root = process.cwd();
const dataDir = path.join(root, "public", "data");
const blobIndexPath = path.join(dataDir, "index.blob.json");

const DATASETS = [
  {
    id: "global_market_sh6",
    file_name: "global_market_sh6.parquet",
  },
];

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error(
    "BLOB_READ_WRITE_TOKEN nao definido. Configure o token antes de executar o upload."
  );
}

/** @typedef {{ id: string; file_name: string; size_bytes?: number; updated_at?: string; blob_url?: string }} IndexEntry */

async function uploadDataset(entry) {
  const filePath = path.join(dataDir, entry.file_name);
  const stat = await fs.stat(filePath);
  const fileBuffer = await fs.readFile(filePath);
  const blobPath = `datasets/${entry.file_name}`;

  const blob = await put(blobPath, fileBuffer, {
    access: "public",
    contentType: "application/octet-stream",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  console.log(`Uploaded ${entry.file_name} -> ${blob.url}`);

  return {
    ...entry,
    size_bytes: stat.size,
    updated_at: stat.mtime.toISOString(),
    blob_url: blob.url,
  };
}

async function main() {
  /** @type {IndexEntry[]} */
  const result = [];

  for (const entry of DATASETS) {
    result.push(await uploadDataset(entry));
  }

  await fs.writeFile(blobIndexPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`Wrote ${blobIndexPath} with ${result.length} blob URLs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
