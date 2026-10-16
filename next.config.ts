import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.CONTENT_STUDIO_DIST_DIR ?? ".next",
  typescript: { tsconfigPath: process.env.CONTENT_STUDIO_TSCONFIG_PATH ?? "tsconfig.json" },
  serverExternalPackages: ["playwright", "youtubei.js"],
};

export default nextConfig;
