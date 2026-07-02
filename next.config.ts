import type { NextConfig } from "next";

const serverActionAllowedOrigins = (process.env.SERVER_ACTION_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3"],
  experimental: serverActionAllowedOrigins.length
    ? {
        serverActions: {
          allowedOrigins: serverActionAllowedOrigins,
        },
      }
    : undefined,
};

export default nextConfig;
