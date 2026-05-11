import { promises as fs } from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";

const root = process.cwd();
const routesDir = path.join(root, "public", "data", "routes_by_importer");
const localIndexPath = path.join(routesDir, "index.json");
const blobIndexPath = path.join(routesDir, "index.blob.json");
const concurrency = Number(process.env.BLOB_UPLOAD_CONCURRENCY ?? "6");

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error(
    "BLOB_READ_WRITE_TOKEN nao definido. Configure o token antes de executar o upload."
  );
}

/** @typedef {{ importer: string; file_name: string; rows?: number; size_bytes?: number; blob_url?: string }} IndexEntry */

/**
 * @param {IndexEntry[]} entries
 */
async function uploadInBatches(entries) {
  const output = [];

  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);

    const uploadedBatch = await Promise.all(
      batch.map(async (entry) => {
        const filePath = path.join(routesDir, entry.file_name);
        const fileBuffer = await fs.readFile(filePath);
        const blobPath = `routes_by_importer/${entry.file_name}`;

        const blob = await put(blobPath, fileBuffer, {
          access: "public",
          contentType: "application/octet-stream",
          addRandomSuffix: false,
          allowOverwrite: true,
        });

        console.log(`Uploaded ${entry.file_name} -> ${blob.url}`);

        return {
          ...entry,
          blob_url: blob.url,
        };
      })
    );

    output.push(...uploadedBatch);
    console.log(`Progress: ${Math.min(i + concurrency, entries.length)}/${entries.length}`);
  }

  return output;
}

async function main() {
  const raw = await fs.readFile(localIndexPath, "utf-8");
  /** @type {IndexEntry[]} */
  const entries = JSON.parse(raw);

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("index.json de routes_by_importer vazio ou invalido.");
  }

  const result = await uploadInBatches(entries);

  await fs.writeFile(blobIndexPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`Wrote ${blobIndexPath} with ${result.length} blob URLs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
