import "server-only";

import { and, gt, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { providerCache, providerRequests } from "@/lib/db/schema";
import { APP_USER_AGENT } from "@/lib/env";
import { newId } from "@/lib/http";

export type ProviderName = "wikidata" | "wikipedia" | "tvmaze" | "tmdb" | "omdb";

export type ProviderFetchOptions = {
  provider: ProviderName;
  url: string;
  headers?: Record<string, string>;
  /** Saniye. 0 verilirse onbellek kullanilmaz. */
  cacheTtlSeconds?: number;
  timeoutMs?: number;
};

export class ProviderError extends Error {
  provider: ProviderName;
  httpStatus?: number;

  constructor(
    provider: ProviderName,
    message: string,
    httpStatus?: number,
  ) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.httpStatus = httpStatus;
  }
}

function cacheKeyFor(provider: ProviderName, url: string): string {
  return `${provider}:${url}`;
}

async function logRequest(input: {
  provider: ProviderName;
  endpoint: string;
  status: "ok" | "error" | "cache_hit" | "rate_limited";
  httpStatus?: number;
  durationMs?: number;
  error?: string;
}): Promise<void> {
  try {
    await getDb()
      .insert(providerRequests)
      .values({
        id: newId("req"),
        provider: input.provider,
        endpoint: input.endpoint.slice(0, 500),
        status: input.status,
        httpStatus: input.httpStatus ?? null,
        durationMs: input.durationMs ?? null,
        error: input.error?.slice(0, 500) ?? null,
      });
  } catch {
    // Loglama hatasi ana islevi bozmamali.
  }
}

async function readCache<T>(
  provider: ProviderName,
  url: string,
): Promise<T | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(providerCache)
    .where(
      and(
        eq(providerCache.cacheKey, cacheKeyFor(provider, url)),
        gt(providerCache.expiresAt, new Date().toISOString()),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;
  try {
    return JSON.parse(rows[0].payload) as T;
  } catch {
    return null;
  }
}

async function writeCache(
  provider: ProviderName,
  url: string,
  payload: unknown,
  ttlSeconds: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const db = getDb();
  await db
    .insert(providerCache)
    .values({
      cacheKey: cacheKeyFor(provider, url),
      provider,
      payload: JSON.stringify(payload),
      fetchedAt: new Date().toISOString(),
      expiresAt,
    })
    .onConflictDoUpdate({
      target: providerCache.cacheKey,
      set: {
        payload: JSON.stringify(payload),
        fetchedAt: new Date().toISOString(),
        expiresAt,
      },
    });
}

/**
 * Dis kaynak istegi: onbellek -> ag -> log.
 * Hata durumunda ProviderError firlatir; cagiran taraf yedek kaynaga gecebilir.
 */
export async function providerFetchJson<T>(
  options: ProviderFetchOptions,
): Promise<{ data: T; fromCache: boolean }> {
  const {
    provider,
    url,
    headers = {},
    cacheTtlSeconds = 3600,
    timeoutMs = 15_000,
  } = options;

  if (cacheTtlSeconds > 0) {
    const cached = await readCache<T>(provider, url);
    if (cached !== null) {
      await logRequest({
        provider,
        endpoint: url,
        status: "cache_hit",
      });
      return { data: cached, fromCache: true };
    }
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": APP_USER_AGENT,
        Accept: "application/json",
        ...headers,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    const durationMs = Date.now() - startedAt;

    if (response.status === 429) {
      await logRequest({
        provider,
        endpoint: url,
        status: "rate_limited",
        httpStatus: 429,
        durationMs,
        error: "Kota/hiz siniri asildi.",
      });
      throw new ProviderError(
        provider,
        "Kaynak hiz siniri (429). Lutfen biraz sonra tekrar deneyin.",
        429,
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      await logRequest({
        provider,
        endpoint: url,
        status: "error",
        httpStatus: response.status,
        durationMs,
        error: text.slice(0, 300),
      });
      throw new ProviderError(
        provider,
        `Kaynak ${response.status} dondurdu.`,
        response.status,
      );
    }

    const data = (await response.json()) as T;

    if (cacheTtlSeconds > 0) {
      await writeCache(provider, url, data, cacheTtlSeconds);
    }

    await logRequest({
      provider,
      endpoint: url,
      status: "ok",
      httpStatus: response.status,
      durationMs,
    });

    return { data, fromCache: false };
  } catch (error) {
    if (error instanceof ProviderError) throw error;

    const durationMs = Date.now() - startedAt;
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Kaynak zaman asimina ugradi."
        : error instanceof Error
          ? error.message
          : "Bilinmeyen ag hatasi.";

    await logRequest({
      provider,
      endpoint: url,
      status: "error",
      durationMs,
      error: message,
    });

    throw new ProviderError(provider, message);
  } finally {
    clearTimeout(timeout);
  }
}
