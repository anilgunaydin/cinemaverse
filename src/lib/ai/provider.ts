import "server-only";

import { env } from "@/lib/env";
import { resolveAiConfig, type AiProviderName, type ResolvedAiConfig } from "./config";

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatSuccess = {
  ok: true;
  provider: Exclude<AiProviderName, "none">;
  model: string;
  content: string;
};

export type ChatFailure = {
  ok: false;
  provider: AiProviderName;
  reason: "disabled" | "not_configured" | "error";
  message: string;
};

export type ChatResult = ChatSuccess | ChatFailure;

export type ChatOptions = {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

/** Ortam degiskenlerinden AI durumunu okur (ag erisimi yok). */
export function getAiStatus(): ResolvedAiConfig {
  return resolveAiConfig({
    provider: env.aiProvider,
    ollamaBaseUrl: env.ollamaBaseUrl,
    ollamaModel: env.ollamaModel,
    geminiApiKey: env.geminiApiKey,
    geminiModel: env.geminiModel,
    openAiCompatBaseUrl: env.openAiCompatBaseUrl,
    openAiCompatApiKey: env.openAiCompatApiKey,
    openAiCompatModel: env.openAiCompatModel,
  });
}

async function withTimeout<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "AI sağlayıcısı zaman aşımına uğradı.";
  }
  return error instanceof Error ? error.message : "Bilinmeyen AI hatası.";
}

async function callOllama(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  options: ChatOptions,
): Promise<string> {
  const base = baseUrl.replace(/\/+$/, "");
  const response = await withTimeout(options.timeoutMs ?? 60_000, (signal) =>
    fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 800,
        },
      }),
      signal,
      cache: "no-store",
    }),
  );

  if (!response.ok) {
    throw new Error(`Ollama ${response.status} döndürdü.`);
  }
  const data = (await response.json()) as {
    message?: { content?: string };
  };
  const content = data.message?.content?.trim();
  if (!content) throw new Error("Ollama boş yanıt döndürdü.");
  return content;
}

async function callGemini(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  options: ChatOptions,
): Promise<string> {
  const systemParts = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await withTimeout(options.timeoutMs ?? 60_000, (signal) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(systemParts
          ? { systemInstruction: { parts: [{ text: systemParts }] } }
          : {}),
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 800,
        },
      }),
      signal,
      cache: "no-store",
    }),
  );

  if (!response.ok) {
    throw new Error(`Gemini ${response.status} döndürdü.`);
  }
  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const content = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!content) throw new Error("Gemini boş yanıt döndürdü.");
  return content;
}

async function callOpenAiCompatible(
  baseUrl: string,
  apiKey: string | null,
  model: string,
  messages: ChatMessage[],
  options: ChatOptions,
): Promise<string> {
  const base = baseUrl.replace(/\/+$/, "");
  const response = await withTimeout(options.timeoutMs ?? 60_000, (signal) =>
    fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 800,
      }),
      signal,
      cache: "no-store",
    }),
  );

  if (!response.ok) {
    throw new Error(`Sağlayıcı ${response.status} döndürdü.`);
  }
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Sağlayıcı boş yanıt döndürdü.");
  return content;
}

/**
 * Sohbet tamamlama. AI kapaliysa veya yapilandirma eksikse aga CIKMAZ;
 * acikca hata dondurur. Boylece hicbir zaman sessizce dis servise
 * baglanilmaz.
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<ChatResult> {
  const status = getAiStatus();

  if (!status.enabled || status.provider === "none" || !status.model) {
    return {
      ok: false,
      provider: status.provider,
      reason: "disabled",
      message: status.reason,
    };
  }

  try {
    let content: string;
    if (status.provider === "ollama") {
      content = await callOllama(env.ollamaBaseUrl, status.model, messages, options);
    } else if (status.provider === "gemini") {
      content = await callGemini(
        env.geminiApiKey ?? "",
        status.model,
        messages,
        options,
      );
    } else {
      content = await callOpenAiCompatible(
        env.openAiCompatBaseUrl ?? "",
        env.openAiCompatApiKey ?? null,
        status.model,
        messages,
        options,
      );
    }

    return {
      ok: true,
      provider: status.provider,
      model: status.model,
      content,
    };
  } catch (error) {
    return {
      ok: false,
      provider: status.provider,
      reason: "error",
      message: describeError(error),
    };
  }
}
