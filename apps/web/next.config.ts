import type { NextConfig } from "next";

// Validate required env vars early (dev/build/start).
// This will throw a clear error if CF config is missing.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./config/env.js");

const nextConfig: NextConfig = {
  turbopack: {
    root: ".",
  },
  // Allow dev server WebSocket connections from production domain
  allowedDevOrigins: ['aaqarplus.tech', 'www.aaqarplus.tech'],
};

export default nextConfig;
