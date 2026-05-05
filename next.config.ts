import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "*": ["./public/data/competitors/**/*.parquet"],
  },
};

export default nextConfig;
