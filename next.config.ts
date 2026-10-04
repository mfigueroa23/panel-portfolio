import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for the Docker fallback; Vercel ignores it.
  output: "standalone",
  // Inlined at build time (Vercel env vars, Docker build args, CI secrets).
  env: {
    API_URL: process.env.API_URL || "https://api.figueroa-sanchez.com",
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  },
};

export default nextConfig;
