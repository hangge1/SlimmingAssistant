import type { NextConfig } from "next";

const serverActionOriginEnvKeys = [
  "SERVER_ACTION_ALLOWED_ORIGINS",
  "APP_ORIGIN",
  "APP_URL",
  "SITE_ORIGIN",
  "SITE_URL",
  "PUBLIC_ORIGIN",
  "PUBLIC_URL",
  "NEXT_PUBLIC_APP_ORIGIN",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_ORIGIN",
  "NEXT_PUBLIC_SITE_URL",
  "BT_PUBLIC_HOST",
] as const;

function normalizeServerActionOrigin(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith("*.") || trimmed.startsWith("**.")) {
    return trimmed.replace(/:(80|443)$/i, "");
  }

  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return parsed.host.replace(/:(80|443)$/i, "");
  } catch {
    return undefined;
  }
}

const serverActionAllowedOriginSet = new Set<string>();

for (const key of serverActionOriginEnvKeys) {
  for (const origin of (process.env[key] ?? "").split(",")) {
    const normalizedOrigin = normalizeServerActionOrigin(origin);

    if (normalizedOrigin) {
      serverActionAllowedOriginSet.add(normalizedOrigin);
    }
  }
}

const serverActionAllowedOrigins = [...serverActionAllowedOriginSet];

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
