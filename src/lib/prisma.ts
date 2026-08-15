import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Vercel 等のサーバーレスでは接続を使い回し、1 インスタンスあたり 1 接続に抑える。
 * Supabase Transaction pooler（6543 + pgbouncer=true）と併用する前提。
 */
function datasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (!u.searchParams.has("pgbouncer")) {
      u.searchParams.set("pgbouncer", "true");
    }
    if (!u.searchParams.has("connection_limit")) {
      u.searchParams.set("connection_limit", "1");
    }
    if (!u.searchParams.has("pool_timeout")) {
      u.searchParams.set("pool_timeout", "20");
    }
    // Session mode (5432) は pool_size が小さく枯渇しやすい → Transaction (6543) を優先
    if (u.port === "5432" && u.hostname.includes("pooler.supabase.com")) {
      u.port = "6543";
    }
    return u.toString();
  } catch {
    return raw;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: { url: datasourceUrl() },
    },
  });

// Warm なサーバーレスインスタンスでもクライアントを再利用する
globalForPrisma.prisma = prisma;
