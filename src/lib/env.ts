import "server-only";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Ortam degiskenleri tek yerden okunur. Hicbir gizli anahtar istemciye
 * gonderilmez; bu modul yalnizca sunucu tarafinda import edilebilir.
 */

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

let cachedSecret: string | undefined;

/**
 * Oturum imzalama anahtari. SESSION_SECRET tanimli degilse gelistirme
 * kolayligi icin dosyada kalici bir anahtar uretilir; uretimde mutlaka
 * ortam degiskeni verilmelidir.
 */
export function getSessionSecret(): string {
  if (cachedSecret) return cachedSecret;

  const fromEnv = optional("SESSION_SECRET");
  if (fromEnv) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }

  // Gelistirme icin: data klasorunde kalici rastgele anahtar.
  const dir = path.join(process.cwd(), "data");
  const file = path.join(dir, ".session-secret");
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(file)) {
    cachedSecret = fs.readFileSync(file, "utf8").trim();
  } else {
    cachedSecret = crypto.randomBytes(48).toString("base64url");
    fs.writeFileSync(file, cachedSecret, { mode: 0o600 });
  }
  return cachedSecret;
}

export const env = {
  get sessionSecret() {
    return getSessionSecret();
  },
  get appUrl() {
    return optional("APP_URL") ?? "http://localhost:3000";
  },
  get tmdbReadToken() {
    return optional("TMDB_READ_TOKEN");
  },
  get omdbApiKey() {
    return optional("OMDB_API_KEY");
  },
  get aiProvider() {
    const raw = (optional("AI_PROVIDER") ?? "none").toLowerCase();
    if (["ollama", "gemini", "openai-compatible"].includes(raw)) {
      return raw as "ollama" | "gemini" | "openai-compatible";
    }
    return "none" as const;
  },
  get ollamaBaseUrl() {
    return optional("OLLAMA_BASE_URL") ?? "http://127.0.0.1:11434";
  },
  get ollamaModel() {
    return optional("OLLAMA_MODEL") ?? "llama3.2";
  },
  /**
   * Modelin bellekte kalma suresi (Ollama `keep_alive`).
   * "0" model yanit verir vermez bellekten dusurulur; boylece model arka planda
   * RAM/CPU tutmaz. Varsayilan 5m (Ollama'nin kendi varsayilani).
   */
  get ollamaKeepAlive() {
    return optional("OLLAMA_KEEP_ALIVE") ?? "5m";
  },
  get geminiApiKey() {
    return optional("GEMINI_API_KEY");
  },
  get geminiModel() {
    return optional("GEMINI_MODEL") ?? "gemini-2.5-flash";
  },
  get openAiCompatBaseUrl() {
    return optional("OPENAI_COMPAT_BASE_URL");
  },
  get openAiCompatApiKey() {
    return optional("OPENAI_COMPAT_API_KEY");
  },
  get openAiCompatModel() {
    return optional("OPENAI_COMPAT_MODEL");
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};

export const APP_USER_AGENT = "CinemaVerse/0.1 (local personal project)";
