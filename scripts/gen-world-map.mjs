/**
 * Generates public/maps/world.json from world-atlas TopoJSON.
 * Applies antimeridian normalization so Russia/Fiji don't "bleed" across the map.
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { feature } from "topojson-client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Normalize a ring so consecutive coordinates never jump more than 180°.
// This prevents ECharts from drawing polygons across the entire map width.
function fixRing(ring) {
  const fixed = [[...ring[0]]];
  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][0];
    const lat = ring[i][1];
    const prevLon = fixed[fixed.length - 1][0];
    while (lon - prevLon >  180) lon -= 360;
    while (prevLon - lon >  180) lon += 360;
    fixed.push([lon, lat]);
  }
  return fixed;
}

function fixGeometry(geom) {
  if (geom.type === "Polygon") {
    geom.coordinates = geom.coordinates.map(fixRing);
  } else if (geom.type === "MultiPolygon") {
    geom.coordinates = geom.coordinates.map((poly) => poly.map(fixRing));
  }
  return geom;
}

const atlasPath = path.join(__dirname, "../node_modules/world-atlas/countries-110m.json");
const raw = await fs.readFile(atlasPath, "utf-8");
const topo = JSON.parse(raw);
const geojson = feature(topo, topo.objects.countries);

const ANTARCTICA_ID = "010"; // ISO 3166-1 numeric (com zero à esquerda)

geojson.features = geojson.features
  .filter((f) => f.id !== ANTARCTICA_ID)
  .map((f) => { fixGeometry(f.geometry); return f; });

const outDir = path.join(__dirname, "../public/maps");
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, "world.json"), JSON.stringify(geojson));
console.log(`Wrote ${geojson.features.length} features (antimeridian-fixed) to public/maps/world.json`);
