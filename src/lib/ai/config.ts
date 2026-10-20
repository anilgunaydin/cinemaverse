/**
 * AI saglayici yapilandirmasinin saf (pure) cozumleyicisi.
 *
 * Amac: "AI kapali mi, hangi saglayici, hangi model?" sorusunu ag erisimi
 * olmadan, test edilebilir bicimde yanitlamak. Gercek ag cagrilari
 * `provider.ts` icindedir.
 *
 * Tasarim ilkesi: varsayilan olarak AI KAPALIDIR. Kullanici acikca bir
 * saglayici secmedikce hicbir dis AI servisine istek gonderilmez.
 */

export type AiProviderName = "none" | "ollama" | "gemini" | "openai-compatible";

export type AiConfigInput = {
  provider?: string | null;
  ollamaBaseUrl?: string | null;
  ollamaModel?: string | null;
  geminiApiKey?: string | null;
  geminiModel?: string | null;
  openAiCompatBaseUrl?: string | null;
  openAiCompatApiKey?: string | null;
  openAiCompatModel?: string | null;
};

export type ResolvedAiConfig = {
  provider: AiProviderName;
  /** Kullanilacak model adi (kapali ise null). */
  model: string | null;
  enabled: boolean;
  /** Kullaniciya gosterilecek, insan okunur Turkce aciklama. */
  reason: string;
};

const KNOWN_PROVIDERS: AiProviderName[] = [
  "none",
  "ollama",
  "gemini",
  "openai-compatible",
];

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeProvider(value: string | null | undefined): AiProviderName {
  const raw = clean(value)?.toLowerCase();
  if (raw && (KNOWN_PROVIDERS as string[]).includes(raw)) {
    return raw as AiProviderName;
  }
  return "none";
}

export function resolveAiConfig(input: AiConfigInput): ResolvedAiConfig {
  const provider = normalizeProvider(input.provider);

  if (provider === "none") {
    return {
      provider: "none",
      model: null,
      enabled: false,
      reason:
        "Yapay zekâ destekli tartışma şu anda kapalı (AI_PROVIDER=none). " +
        "Bu özellik tamamen isteğe bağlıdır; açmak için .env dosyasında bir " +
        "sağlayıcı tanımlamanız gerekir.",
    };
  }

  if (provider === "ollama") {
    const model = clean(input.ollamaModel) ?? "llama3.2";
    return {
      provider: "ollama",
      model,
      enabled: true,
      reason: `Yerel Ollama sağlayıcısı etkin (model: ${model}).`,
    };
  }

  if (provider === "gemini") {
    const model = clean(input.geminiModel) ?? "gemini-2.5-flash";
    if (!clean(input.geminiApiKey)) {
      return {
        provider: "gemini",
        model: null,
        enabled: false,
        reason:
          "AI_PROVIDER=gemini seçildi ancak GEMINI_API_KEY tanımlı değil. " +
          "Anahtar olmadan istek gönderilmez.",
      };
    }
    return {
      provider: "gemini",
      model,
      enabled: true,
      reason: `Google Gemini sağlayıcısı etkin (model: ${model}).`,
    };
  }

  // openai-compatible
  const baseUrl = clean(input.openAiCompatBaseUrl);
  const model = clean(input.openAiCompatModel);
  if (!baseUrl || !model) {
    return {
      provider: "openai-compatible",
      model: null,
      enabled: false,
      reason:
        "AI_PROVIDER=openai-compatible seçildi ancak OPENAI_COMPAT_BASE_URL " +
        "ve OPENAI_COMPAT_MODEL tanımlı değil. Eksik yapılandırmayla istek " +
        "gönderilmez.",
    };
  }
  const needsKey = !/localhost|127\.0\.0\.1/i.test(baseUrl);
  if (needsKey && !clean(input.openAiCompatApiKey)) {
    return {
      provider: "openai-compatible",
      model: null,
      enabled: false,
      reason:
        "Uzak OpenAI uyumlu sağlayıcı için OPENAI_COMPAT_API_KEY gerekli " +
        "ancak tanımlı değil.",
    };
  }
  return {
    provider: "openai-compatible",
    model,
    enabled: true,
    reason: `OpenAI uyumlu sağlayıcı etkin (model: ${model}).`,
  };
}
