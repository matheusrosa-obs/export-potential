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