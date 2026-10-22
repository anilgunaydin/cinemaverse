/**
 * AI saglayici yapilandirmasinin saf (pure) cozumleyicisi.
 *
 * Amac: "AI kapali mi, hangi saglayici, hangi model?" sorusunu ag erisimi
 * olmadan, test edilebilir bicimde yanitlamak. Gercek ag cagrilari
 * `provider.ts` icindedir.
 *
 * Tasarim ilkesi: varsayilan olarak AI KAPALIDIR. Kullanici acikca bir
 * saglayici secmedikce hicbir dis AI servisine istek gonderilmez.
 *
 * Not: Yerel Ollama destegi tamamen kaldirildi. Model bilgisayarda CPU/RAM
 * tukettigi icin uygulama artik Ollama'ya baglanmaz.
 */

export type AiProviderName =
  | "none"
  | "gemini"
  | "deepseek"
  | "openai-compatible";

export type AiConfigInput = {
  provider?: string | null;
  geminiApiKey?: string | null;
  geminiModel?: string | null;
  deepseekApiKey?: string | null;
  deepseekModel?: string | null;
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
  "gemini",
  "deepseek",
  "openai-compatible",
];

const OLLAMA_REMOVED_REASON =
  "Yerel Ollama desteği kaldırıldı (bilgisayarı yorduğu için uygulama artık " +
  "Ollama'ya bağlanmıyor). AI özellikleri için .env dosyasında " +
  "AI_PROVIDER=gemini + GEMINI_API_KEY veya AI_PROVIDER=deepseek + " +
  "DEEPSEEK_API_KEY tanımlayın; kullanmayacaksanız AI_PROVIDER=none bırakın.";

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
  const raw = clean(input.provider)?.toLowerCase();

  // Eski .env dosyalarinda kalan AI_PROVIDER=ollama sessizce yok sayilmaz;
  // acik bir mesajla kapali kalir. Boylece hicbir zaman yerel modele istek
  // gitmez.
  if (raw === "ollama") {
    return {
      provider: "none",
      model: null,
      enabled: false,
      reason: OLLAMA_REMOVED_REASON,
    };
  }

  const provider = normalizeProvider(raw);

  if (provider === "none") {
    return {
      provider: "none",
      model: null,
      enabled: false,
      reason:
        "Yapay zekâ destekli özellikler şu anda kapalı (AI_PROVIDER=none). " +
        "Bu özellik isteğe bağlıdır; açmak için .env dosyasında " +
        "AI_PROVIDER=gemini + GEMINI_API_KEY veya AI_PROVIDER=deepseek + " +
        "DEEPSEEK_API_KEY tanımlayın.",
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

  if (provider === "deepseek") {
    const model = clean(input.deepseekModel) ?? "deepseek-chat";
    if (!clean(input.deepseekApiKey)) {
      return {
        provider: "deepseek",
        model: null,
        enabled: false,
        reason:
          "AI_PROVIDER=deepseek seçildi ancak DEEPSEEK_API_KEY tanımlı değil. " +
          "Anahtar olmadan istek gönderilmez.",
      };
    }
    return {
      provider: "deepseek",
      model,
      enabled: true,
      reason: `DeepSeek sağlayıcısı etkin (model: ${model}).`,
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
