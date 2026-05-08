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

const filteredPairs = buildDirectedPairs(
  {
    BRA: [-48.55, -27.59],
    USA: [-95.71, 37.09],
    CAN: [-106.34, 56.13],
  },
  ["USA"]
);

assert.equal(filteredPairs.length, 2);
assert.ok(filteredPairs.every((pair) => pair.importer === "USA"));
