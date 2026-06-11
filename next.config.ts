import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // PGlite (embedded local-dev Postgres) is loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
