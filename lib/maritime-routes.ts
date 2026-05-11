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

export function parsePersistedRouteMode(value: string): PersistedRouteMode {
  return value === "maritime" ? "maritime" : "unavailable";
}

export function parsePathCoordsJson(value: string): [number, number][] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((entry) => {
      if (
        Array.isArray(entry) &&
        entry.length >= 2 &&
        typeof entry[0] === "number" &&
        typeof entry[1] === "number"
      ) {
        return [[entry[0], entry[1]] as [number, number]];
      }

      return [];
    });
  } catch {
    return [];
  }
}

export function hydrateRouteByExporter(
  rows: MaritimeRouteRow[]
): Map<string, HydratedMaritimeRoute> {
  return new Map(
    rows.map((row) => [
      row.exporter,
      {
        importer: row.importer,
        exporter: row.exporter,
        distanceKm: Number(row.distance_km) || 0,
        routeMode: parsePersistedRouteMode(row.route_mode),
        pathCoords: parsePathCoordsJson(row.path_coords_json),
        snapOrigin: Boolean(row.snap_origin),
        snapDestination: Boolean(row.snap_destination),
        source: row.source,
      },
    ])
  );
}
