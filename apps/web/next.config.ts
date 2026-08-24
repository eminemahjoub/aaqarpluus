import type { NextConfig } from "next";

// Validate required env vars early (dev/build/start).
// This will throw a clear error if CF config is missing.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./config/env.js");

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["qrcode"],
  turbopack: {
    root: __dirname,
  },
  // Allow dev server WebSocket connections from production domain
  allowedDevOrigins: ['aaqarplus.tech', 'www.aaqarplus.tech'],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'self' https://www.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
