import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "*": ["./public/data/competitors/**/*.parquet"],
  },
  outputFileTracingIncludes: {
    "/api/**": [
      "./public/data/*.parquet",
      "./public/data/**/index*.json",
    ],
  },
};

export default nextConfig;
