export const runtime = "edge";

// Serve a lightweight favicon without binary files.
// Browsers request /favicon.ico specifically; Next will route it here.
export async function GET() {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10b981"/>
      <stop offset="1" stop-color="#065f46"/>
    </linearGradient>
  </defs>
  <rect x="6" y="6" width="52" height="52" rx="14" fill="url(#g)"/>
  <path d="M20 34 L32 22 L44 34 V46 H20 Z" fill="#ffffff" opacity="0.95"/>
  <rect x="29" y="36" width="6" height="10" rx="2" fill="#10b981"/>
</svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      // Many browsers accept SVG for favicon even on .ico path.
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}

