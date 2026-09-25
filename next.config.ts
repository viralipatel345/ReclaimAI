import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for the Docker / Cloud Run image.
  output: "standalone",
  // Trace files from this project only (a lockfile higher up the tree would widen it).
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Platforms and third parties never learn a visitor came from Reclaim.
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Reclaim can't be framed by another site (clickjacking a survivor's case).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
