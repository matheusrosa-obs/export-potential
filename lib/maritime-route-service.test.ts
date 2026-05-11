import { describe, expect, it } from "vitest";
import { resolveMaritimeRoutesIndexEntry } from "./maritime-route-service";

describe("maritime route service", () => {
  it("resolves an importer partition from index entries", () => {
    const entry = resolveMaritimeRoutesIndexEntry(
      [{ importer: "USA", file_name: "importer=USA.parquet" }],
      "usa"
    );

    expect(entry?.file_name).toBe("importer=USA.parquet");
  });
});