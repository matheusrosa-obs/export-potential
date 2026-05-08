import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketFlightsGLMap from "./MarketFlightsGLMap";

let capturedOption: any = null;

vi.mock("echarts", () => ({
  getMap: vi.fn(() => ({})),
  registerMap: vi.fn(),
}));

vi.mock("echarts-for-react", () => ({
  default: ({ option }: { option: any }) => {
    capturedOption = option;
    return <div data-testid="echarts-mock" />;
  },
}));

describe("MarketFlightsGLMap", () => {
  beforeEach(() => {
    capturedOption = null;
    vi.restoreAllMocks();
  });

  it("renders the empty-state prompt when importer or sh6 is missing", () => {
    render(<MarketFlightsGLMap importer={null} sh6={null} />);

    expect(
      screen.getByText(
        "Selecione um pais e um SH6 para visualizar os fluxos comerciais."
      )
    ).toBeInTheDocument();
  });

  it("consumes /api/market-flows-maritime and renders lines as polylines", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          importer: "USA",
          sh6: "020130",
          year: 2024,
          rows: [
            {
              exporter: "BRA",
              exporter_name: "Brazil",
              value: 120,
              route_mode: "maritime",
              path_coords: [
                [-48.55, -27.59],
                [-42.0, -23.0],
                [-80.0, 25.0],
              ],
              origin_coord: [-48.55, -27.59],
              importer_coord: [-95.71, 37.09],
            },
            {
              exporter: "ARG",
              exporter_name: "Argentina",
              value: 80,
              route_mode: "straight_fallback",
              path_coords: [
                [-58.38, -34.61],
                [-95.71, 37.09],
              ],
              origin_coord: [-58.38, -34.61],
              importer_coord: [-95.71, 37.09],
            },
            {
              exporter: "XXX",
              exporter_name: "Unknown",
              value: 20,
              route_mode: "unavailable",
              path_coords: [],
              origin_coord: [10, 10],
              importer_coord: [-95.71, 37.09],
            },
          ],
        }),
      } as Response);

    render(<MarketFlightsGLMap importer="USA" sh6="020130" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const calledUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(calledUrl).toContain("/api/market-flows-maritime?");
    expect(calledUrl).toContain("importer=USA");
    expect(calledUrl).toContain("sh6=020130");

    await waitFor(() => {
      expect(capturedOption).toBeTruthy();
    });

    const linesSeries = capturedOption.series?.[0];
    expect(linesSeries?.type).toBe("lines");
    expect(linesSeries?.polyline).toBe(true);
    expect(linesSeries?.data).toHaveLength(2);
    expect(linesSeries?.data?.[0]?.coords).toHaveLength(3);
    expect(linesSeries?.data?.[1]?.coords).toHaveLength(2);
  });
});
