import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Library guides and their evidence are read from disk at runtime by server routes, so ship them.
  outputFileTracingIncludes: { "/**": ["./guides/**/*.json", "./evidence/**/*"] },
};

export default nextConfig;
