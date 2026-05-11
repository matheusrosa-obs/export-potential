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
