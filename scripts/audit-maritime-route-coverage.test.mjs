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
