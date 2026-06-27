import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static", "fluent-ffmpeg"],
  experimental: {
    serverActions: {
      bodySizeLimit: "200mb",
    },
  },
  // Tell Vercel's bundler to include the ffmpeg native binary
  outputFileTracingIncludes: {
    "/api/transcribe": ["./node_modules/ffmpeg-static/**/*"],
  },
};

export default nextConfig;
