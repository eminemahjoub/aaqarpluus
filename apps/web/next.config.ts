import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: ".",
  },
  // Allow dev server WebSocket connections from production domain
  allowedDevOrigins: ['aaqarplus.tech', 'www.aaqarplus.tech'],
};

export default nextConfig;
