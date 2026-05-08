# Maritime Routes by Importer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **User preference:** Do not create branches or commits unless the user explicitly asks for it.

**Goal:** Organize the maritime-routes feature into staged sprints, delivering the local dataset pipeline first and only then integrating the backend and map experience in the app.

**Architecture:** Generate one local parquet partition per importer with all `exporter -> importer` routes, validate and audit those local files offline, load the route partition server-side from the local dataset with importer-level cache, and merge it with the latest-year aggregated `df_competitors` rows before rendering maritime polylines in the map.

**Tech Stack:** Next.js Route Handlers, Node.js runtime, TypeScript, Vitest, ECharts, `searoute-js`, `hyparquet`, local parquet datasets in `public/data`.

## Execution Status (2026-05-08)

- Sprint 1: concluido
  - dataset local por `importer` gerado
  - auditoria local implementada e executada
- Sprint 2: concluido
  - endpoint `/api/market-flows-maritime` implementado
  - cache server-side por `importer` implementado
- Sprint 3: concluido (escopo tecnico)
  - `MarketFlightsGLMap` integrado ao endpoint novo
  - render de polylines e fallback implementados
  - suite de testes da feature aprovada

### Decisions captured during execution

- Para execucao local em Windows, a escrita temporaria de parquet foi movida para `os.tmpdir()` e a atualizacao do arquivo final usa `copyFile`, evitando falhas `EPERM` de `unlink`/`move` dentro de `public/data/routes_by_importer`.
- Arquivos `.__tmp*`/`tmp_importer=*` nao fazem parte do artefato final e podem ser removidos manualmente.

### Validation log (2026-05-08)

- `npm run routes:generate-maritime`
  - resultado: `228` particoes e `index.json` com `228` entradas
- `npm run routes:audit-maritime`
  - resultado: `partitions=228`, `totalRows=51756`, `totalBytes=5345536`, `coverage.maritime=42174`, `coverage.straightFallback=0`, `coverage.unavailable=9582`
- `npm run test -- lib/maritime-routes.test.ts lib/maritime-route-service.test.ts app/api/market-flows-maritime/route.test.ts components/MarketFlightsGLMap.test.tsx`
  - resultado: `4` arquivos de teste pass, `7` testes pass

---

### File Structure

**Documentation**
- Modify: `branch/searoutes/spec.md`
- Modify: `branch/searoutes/plan.md`

**Dependencies and test harness**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`
- Create: `test/setup.ts`

**Route dataset generation and audit**
- Create: `scripts/generate-maritime-routes-by-importer.mjs`
- Create: `scripts/generate-maritime-routes-by-importer.test.mjs`
- Create: `scripts/audit-maritime-route-coverage.mjs`
- Create: `public/data/routes_by_importer/index.json`

**Server-side route loading**
- Create: `lib/maritime-routes.ts`
- Create: `lib/maritime-routes.test.ts`
- Create: `lib/maritime-route-service.ts`
- Create: `lib/maritime-route-service.test.ts`

**Endpoint and frontend**
- Create: `app/api/market-flows-maritime/route.ts`
- Create: `app/api/market-flows-maritime/route.test.ts`
- Modify: `components/MarketFlightsGLMap.tsx`
- Create: `components/MarketFlightsGLMap.test.tsx`

### Task 1: Add the dependency and test harness

**Sprint:** 1 - Dataset local offline

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`
- Create: `test/setup.ts`

- [ ] **Step 1: Verify the current test script is missing**

Run: `npm run test`
Expected: FAIL with `Missing script: "test"`

- [ ] **Step 2: Confirm the route-generation dependency is present**

Run: `rg -n "searoute-js" package.json`
Expected: `searoute-js` present in `dependencies`

- [ ] **Step 3: Add the test scripts and dependencies**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "routes:generate-maritime": "node scripts/generate-maritime-routes-by-importer.mjs",
    "routes:audit-maritime": "node scripts/audit-maritime-route-coverage.mjs"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.8.0",
    "@testing-library/react": "^16.1.0",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 4: Add the Vitest config**

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 5: Add the shared test setup**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Verify the harness starts**

Run: `npm run test`
Expected: PASS with `No test files found`, or FAIL only because future tests are still missing

- [ ] **Step 7: Prepare changes for user review**

```bash
git status --short
```

### Task 2: Define the route contract and parsing helpers

**Sprint:** 1 - Dataset local offline

**Files:**
- Create: `lib/maritime-routes.ts`
- Create: `lib/maritime-routes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  hydrateRouteByExporter,
  parsePathCoordsJson,
  parsePersistedRouteMode,
  type MaritimeRouteRow,
} from "./maritime-routes";

describe("maritime route helpers", () => {
  it("parses persisted route mode and serialized coordinates", () => {
    expect(parsePersistedRouteMode("maritime")).toBe("maritime");
    expect(parsePathCoordsJson("[[-48.55,-27.59],[-42,-23],[-80,25]]")).toEqual([
      [-48.55, -27.59],
      [-42, -23],
      [-80, 25],
    ]);
  });

  it("hydrates rows by exporter", () => {
    const rows: MaritimeRouteRow[] = [
      {
        importer: "USA",
        exporter: "BRA",
        distance_km: 8123.4,
        route_mode: "maritime",
        path_coords_json: "[[-48.55,-27.59],[-42,-23],[-80,25]]",
        snap_origin: false,
        snap_destination: true,
        source: "searoute-js",
      },
    ];

    const indexed = hydrateRouteByExporter(rows);

    expect(indexed.get("BRA")?.routeMode).toBe("maritime");
    expect(indexed.get("BRA")?.pathCoords).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- lib/maritime-routes.test.ts`
Expected: FAIL because `lib/maritime-routes.ts` does not exist yet

- [ ] **Step 3: Implement the helper module**

```ts
export type PersistedRouteMode = "maritime" | "unavailable";
export type DerivedRouteMode =
  | "maritime"
  | "straight_fallback"
  | "unavailable";

export type MaritimeRouteRow = {
  importer: string;
  exporter: string;
  distance_km: number;
  route_mode: string;
  path_coords_json: string;
  snap_origin: boolean;
  snap_destination: boolean;
  source: string;
};

export type HydratedMaritimeRoute = {
  importer: string;
  exporter: string;
  distanceKm: number;
  routeMode: PersistedRouteMode;
  pathCoords: [number, number][];
  snapOrigin: boolean;
  snapDestination: boolean;
  source: string;
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- lib/maritime-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Prepare changes for user review**

```bash
git status --short
```

### Task 3: Generate one local route partition per importer

**Sprint:** 1 - Dataset local offline

**Files:**
- Create: `scripts/generate-maritime-routes-by-importer.mjs`
- Create: `scripts/generate-maritime-routes-by-importer.test.mjs`
- Create: `public/data/routes_by_importer/index.json`

- [ ] **Step 1: Write the failing generator test**

```js
import assert from "node:assert/strict";
import {
  buildDirectedPairs,
  groupRowsByImporter,
} from "./generate-maritime-routes-by-importer.mjs";

const pairs = buildDirectedPairs({
  BRA: [-48.55, -27.59],
  USA: [-95.71, 37.09],
  CAN: [-106.34, 56.13],
});

assert.equal(pairs.length, 6);
assert.equal(
  groupRowsByImporter([
    { importer: "USA", exporter: "BRA" },
    { importer: "USA", exporter: "CAN" },
  ]).USA.length,
  2
);
```

- [ ] **Step 2: Run the generator test**

Run: `node scripts/generate-maritime-routes-by-importer.test.mjs`
Expected: FAIL because the generator module does not exist yet

- [ ] **Step 3: Implement the pair builder and row grouping**

```js
export function buildDirectedPairs(coords) {
  const countries = Object.keys(coords).sort();
  const pairs = [];

  for (const importer of countries) {
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
```

- [ ] **Step 4: Implement the generator rules**

```js
function buildRouteRow(exporter, importer) {
  const origin = countryCoords[exporter];
  const destination = countryCoords[importer];

  if (!origin || !destination) {
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

  const route = searoute(toPoint(origin), toPoint(destination), "kilometers");
  const coords = route?.geometry?.coordinates ?? [];

  return {
    importer,
    exporter,
    distance_km: Number(route?.properties?.length ?? 0),
    route_mode: coords.length >= 2 ? "maritime" : "unavailable",
    path_coords_json: JSON.stringify(coords),
    snap_origin: false,
    snap_destination: false,
    source: "searoute-js",
  };
}
```

- [ ] **Step 5: Write one parquet per importer and a local index**

```js
async function writeImporterPartition(connection, outDir, importer, rows) {
  const jsonPath = path.join(os.tmpdir(), `maritime-routes-${importer}.json`);
  const parquetPath = path.join(outDir, `importer=${importer}.parquet`);

  await fs.writeFile(jsonPath, JSON.stringify(rows));
  await connection.run(`
    COPY (
      SELECT *
      FROM read_json_auto('${jsonPath.replace(/\\/g, "/")}')
    ) TO '${parquetPath.replace(/\\/g, "/")}' (FORMAT PARQUET);
  `);
  await fs.unlink(jsonPath);

  return {
    importer,
    file_name: `importer=${importer}.parquet`,
    rows: rows.length,
  };
}
```

- [ ] **Step 6: Run the generator**

Run: `node scripts/generate-maritime-routes-by-importer.test.mjs`
Expected: PASS

Run: `MARITIME_MAX_IMPORTERS=2 npm run routes:generate-maritime`
Expected: writes a controlled local sample in `public/data/routes_by_importer/index.json` plus `importer=*.parquet`

Run: `npm run routes:generate-maritime`
Expected: ready for the full local batch when the user decides to execute the complete generation

- [ ] **Step 7: Prepare changes for user review**

```bash
git status --short
```

### Task 4: Audit the generated local dataset and freeze the contract

**Files:**
- Create: `scripts/audit-maritime-route-coverage.mjs`
- Modify: `branch/searoutes/spec.md`
- Modify: `branch/searoutes/plan.md`

- [ ] **Step 1: Write the failing audit script test**

```js
import assert from "node:assert/strict";
import { summarizeRouteCoverage } from "./audit-maritime-route-coverage.mjs";

const summary = summarizeRouteCoverage([
  { route_mode: "maritime" },
  { route_mode: "maritime" },
  { route_mode: "straight_fallback" },
  { route_mode: "unavailable" },
]);

assert.deepEqual(summary, {
  maritime: 2,
  straightFallback: 1,
  unavailable: 1,
});
```

- [ ] **Step 2: Run the audit script**

Run: `node scripts/audit-maritime-route-coverage.mjs`
Expected: FAIL because the audit script does not exist yet

- [ ] **Step 3: Implement the audit helper**

```js
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
```

- [ ] **Step 4: Run the local audit**

Run: `npm run routes:audit-maritime`
Expected: prints local coverage and size summary for generated route partitions, with `straightFallback` expected to remain `0` in the raw dataset

- [ ] **Step 5: Freeze the Sprint 1 dataset contract**

Update `branch/searoutes/spec.md` and `branch/searoutes/plan.md` with any measured adjustments from the generated local dataset, without expanding scope to blob.

- [ ] **Step 6: Prepare changes for user review**

```bash
git status --short
```

### Task 5: Load maritime route partitions from local files

**Sprint:** 2 - Backend local e cache

**Files:**
- Create: `lib/maritime-route-service.ts`
- Create: `lib/maritime-route-service.test.ts`

- [ ] **Step 1: Write the failing service test**

```ts
import { describe, expect, it } from "vitest";
import { resolveMaritimeRoutesIndexEntry } from "./maritime-route-service";

describe("maritime route service", () => {
  it("resolves an importer partition from index entries", () => {
    const entry = resolveMaritimeRoutesIndexEntry(
      [{ importer: "USA", file_name: "importer=USA.parquet" }],
      "USA"
    );

    expect(entry?.file_name).toBe("importer=USA.parquet");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- lib/maritime-route-service.test.ts`
Expected: FAIL because `lib/maritime-route-service.ts` does not exist yet

- [ ] **Step 3: Implement route index resolution for local files**

```ts
export type MaritimeRoutesIndexEntry = {
  importer: string;
  file_name: string;
  rows?: number;
  size_bytes?: number;
};
```

- [ ] **Step 4: Load, cache, and hydrate the importer partition**

```ts
export async function loadMaritimeRoutesByImporter(importer: string) {
  const dataset = await getMaritimeRoutePartitionDataset(importer);
  if (!dataset) return new Map();

  const rows = await readParquetFileRows(
    dataset.filePath,
    [
      "importer",
      "exporter",
      "distance_km",
      "route_mode",
      "path_coords_json",
      "snap_origin",
      "snap_destination",
      "source",
    ],
  );

  return hydrateRouteByExporter(rows as MaritimeRouteRow[]);
}
```

```ts
declare global {
  var __maritimeRoutesByImporterCache:
    | Map<string, Map<string, HydratedMaritimeRoute>>
    | undefined;
}
```

Expected behavior: when `loadMaritimeRoutesByImporter("USA")` is called repeatedly for different `sh6` values, the same hydrated route map is reused until the instance is recycled or the cache is invalidated.

- [ ] **Step 5: Run the service test**

Run: `npm run test -- lib/maritime-route-service.test.ts`
Expected: PASS

- [ ] **Step 6: Prepare changes for user review**

```bash
git status --short
```

### Task 6: Expose a map-specific endpoint with latest-year aggregation

**Sprint:** 2 - Backend local e cache

**Files:**
- Create: `app/api/market-flows-maritime/route.ts`
- Create: `app/api/market-flows-maritime/route.test.ts`

- [ ] **Step 1: Write the failing route test**

```ts
import { describe, expect, it } from "vitest";
import {
  aggregateLatestYearFlows,
  buildFallbackPath,
} from "./route";

describe("market flows maritime route", () => {
  it("keeps only the latest year and aggregates by exporter", () => {
    const rows = aggregateLatestYearFlows([
      { year: "2023", exporter: "BRA", exporter_name: "Brazil", value: 10 },
      { year: "2024", exporter: "BRA", exporter_name: "Brazil", value: 20 },
      { year: "2024", exporter: "BRA", exporter_name: "Brazil", value: 5 },
      { year: "2024", exporter: "ARG", exporter_name: "Argentina", value: 7 },
    ]);

    expect(rows.year).toBe(2024);
    expect(rows.rows[0]).toMatchObject({ exporter: "BRA", value: 25 });
    expect(rows.rows[1]).toMatchObject({ exporter: "ARG", value: 7 });
  });

  it("builds a straight fallback path", () => {
    expect(buildFallbackPath([-48.55, -27.59], [-95.71, 37.09])).toEqual([
      [-48.55, -27.59],
      [-95.71, 37.09],
    ]);
  });
});
```

- [ ] **Step 2: Run the route test**

Run: `npm run test -- app/api/market-flows-maritime/route.test.ts`
Expected: FAIL because the route file does not exist yet

- [ ] **Step 3: Implement the aggregation helper**

```ts
export function aggregateLatestYearFlows(rows: ApiRow[]) {
  const latestYear = rows.reduce((acc, row) => Math.max(acc, Number(row.year) || 0), 0);
  const latestRows = rows.filter((row) => (Number(row.year) || 0) === latestYear);
  const totals = new Map<string, { exporter: string; exporter_name: string; value: number }>();

  for (const row of latestRows) {
    const exporter = String(row.exporter ?? "").trim().toUpperCase();
    if (!exporter) continue;

    const current = totals.get(exporter);
    totals.set(exporter, {
      exporter,
      exporter_name: String(row.exporter_name ?? exporter).trim() || exporter,
      value: (current?.value ?? 0) + (Number(row.value) || 0),
    });
  }

  return {
    year: latestYear,
    rows: Array.from(totals.values()).sort((a, b) => b.value - a.value),
  };
}
```

- [ ] **Step 4: Implement the endpoint contract**

```ts
const limit = Math.min(
  Math.max(Number(searchParams.get("limit") ?? "120") || 120, 1),
  500
);
```

```ts
return NextResponse.json({
  importer,
  sh6,
  year: aggregated.year,
  rows: aggregated.rows.slice(0, limit).map((row) => {
    // merge route geometry and derive route_mode here
  }),
});
```

Requirement: this endpoint may rerun the `df_competitors` query for each `sh6`, but it must reuse the cached route partition for the same `importer` whenever available.

- [ ] **Step 5: Run the route test**

Run: `npm run test -- app/api/market-flows-maritime/route.test.ts`
Expected: PASS

- [ ] **Step 6: Prepare changes for user review**

```bash
git status --short
```

### Task 7: Update `MarketFlightsGLMap` to render polylines

**Sprint:** 3 - Integracao no mapa

**Files:**
- Modify: `components/MarketFlightsGLMap.tsx`
- Create: `components/MarketFlightsGLMap.test.tsx`

- [ ] **Step 1: Write the failing component tests**

```tsx
import { render, screen } from "@testing-library/react";
import MarketFlightsGLMap from "./MarketFlightsGLMap";

test("renders the empty-state prompt when importer or sh6 is missing", () => {
  render(<MarketFlightsGLMap importer={null} sh6={null} />);
  expect(
    screen.getByText("Selecione um pais e um SH6 para visualizar os fluxos comerciais.")
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the component test**

Run: `npm run test -- components/MarketFlightsGLMap.test.tsx`
Expected: FAIL until the component test is wired up

- [ ] **Step 3: Replace the fetch contract**

```ts
fetch(`/api/market-flows-maritime?${params.toString()}`)
  .then(async (res) => {
    const json = await res.json();
    if (!res.ok || json.error) {
      throw new Error(json.error ?? `Erro HTTP ${res.status}`);
    }
    return json;
  })
  .then((json) => {
    setRows((json.rows as MaritimeFlowRow[]) ?? []);
    setLoading(false);
  });
```

- [ ] **Step 4: Render the route as a polyline**

```ts
const lineData = rows
  .filter((row) => row.route_mode !== "unavailable" && row.path_coords.length >= 2)
  .map((row) => ({
    fromName: row.exporter,
    fromLabel: row.exporter_name,
    toName: importer,
    coords: row.path_coords,
    value: row.value,
    routeMode: row.route_mode,
  }));
```

```ts
{
  name: "Fluxo comercial",
  type: "lines",
  coordinateSystem: "geo",
  polyline: true,
  data: prepared.lineData,
}
```

- [ ] **Step 5: Surface the route mode in the tooltip**

```ts
return `${formatTooltipTitle(`${getCountryName(fromIso)} -> ${getCountryName(toIso)}`)}<br/>Fluxo comercial: ${formatValue(value)}<br/>Rota: ${params.data?.routeMode === "maritime" ? "Maritima" : "Linha reta"}`;
```

- [ ] **Step 6: Run the component test**

Run: `npm run test -- components/MarketFlightsGLMap.test.tsx`
Expected: PASS

- [ ] **Step 7: Prepare changes for user review**

```bash
git status --short
```

### Task 8: Verify generation, upload metadata, and runtime behavior

**Sprint:** 3 - Integracao no mapa

**Files:**
- Modify: `components/MarketFlightsGLMap.tsx`
- Create: `components/MarketFlightsGLMap.test.tsx`
- Modify: `branch/searoutes/spec.md`
- Modify: `branch/searoutes/plan.md`

- [ ] **Step 1: Write the failing audit script test**

```js
import assert from "node:assert/strict";
import { summarizeRouteCoverage } from "./audit-maritime-route-coverage.mjs";

const summary = summarizeRouteCoverage([
  { route_mode: "maritime" },
  { route_mode: "maritime" },
  { route_mode: "straight_fallback" },
  { route_mode: "unavailable" },
]);

assert.deepEqual(summary, {
  maritime: 2,
  straightFallback: 1,
  unavailable: 1,
});
```

- [ ] **Step 2: Run the audit script**

Run: `npm run test -- components/MarketFlightsGLMap.test.tsx`
Expected: FAIL until the final map behavior is wired up

- [ ] **Step 3: Execute the full local verification**

Run: `npm run routes:generate-maritime`
Expected: all local route partitions regenerate cleanly

Run: `npm run test -- lib/maritime-routes.test.ts lib/maritime-route-service.test.ts app/api/market-flows-maritime/route.test.ts components/MarketFlightsGLMap.test.tsx`
Expected: PASS

Run: `npm run routes:audit-maritime`
Expected: prints a coverage summary for `maritime`, `straight_fallback`, and `unavailable`

- [ ] **Step 4: Execute the manual verification checklist**

```text
1. Open the "Mercados e competidores" section.
2. Select importer USA and a high-volume SH6.
3. Confirm the endpoint returns a single latest year.
4. Confirm changing only `sh6` for the same `importer` does not trigger a fresh route-partition download/read when the cache is warm.
5. Confirm major routes follow multi-point maritime trajectories.
6. Confirm fallback routes still appear for unsupported pairs.
7. Confirm exporter and importer bubbles still render correctly.
8. Confirm the tooltip differentiates "Maritima" from "Linha reta".
9. Confirm the page still handles empty-state and error-state flows.
```

- [ ] **Step 5: Document the Sprint 3 validation outcome**

Update `branch/searoutes/spec.md` and `branch/searoutes/plan.md` with any final implementation notes that emerged from the local verification, without adding blob publication work.

- [ ] **Step 6: Prepare changes for user review**

```bash
git status --short
```
