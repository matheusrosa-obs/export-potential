import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@duckdb/node-api",
    "@duckdb/node-bindings",
    "@duckdb/node-bindings-win32-x64",
  ],
  outputFileTracingExcludes: {
    "*": ["./public/data/competitors/**/*.parquet"],
  },
};

export default nextConfig;
