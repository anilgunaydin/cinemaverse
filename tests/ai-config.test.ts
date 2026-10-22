import { describe, expect, it } from "vitest";

import { resolveAiConfig } from "@/lib/ai/config";

describe("resolveAiConfig", () => {
  it("varsayilan olarak AI kapalidir", () => {
    const config = resolveAiConfig({});
    expect(config.provider).toBe("none");
    expect(config.enabled).toBe(false);
    expect(config.model).toBeNull();
    expect(config.reason).toContain("kapalÄ±");
  });

  it("bilinmeyen saglayici adini 'none' kabul eder", () => {
    const config = resolveAiConfig({ provider: "chatgpt-9000" });
    expect(config.provider).toBe("none");
    expect(config.enabled).toBe(false);
  });

  it("ollama artik desteklenmez; istek gonderilmez", () => {
    const config = resolveAiConfig({ provider: "ollama" });
    expect(config.provider).toBe("none");
    expect(config.enabled).toBe(false);
    expect(config.model).toBeNull();
    expect(config.reason).toContain("Ollama");
  });

  it("gemini anahtar yoksa devre disi kalir", () => {
    const config = resolveAiConfig({ provider: "gemini" });
    expect(config.enabled).toBe(false);
    expect(config.reason).toContain("GEMINI_API_KEY");
  });

  it("gemini anahtar varsa etkin olur", () => {
    const config = resolveAiConfig({ provider: "gemini", geminiApiKey: "abc" });
    expect(config.enabled).toBe(true);
    expect(config.model).toBe("gemini-3.6-flash");
  });

  it("deepseek anahtar yoksa devre disi kalir", () => {
    const config = resolveAiConfig({ provider: "deepseek" });
    expect(config.enabled).toBe(false);
    expect(config.reason).toContain("DEEPSEEK_API_KEY");
  });

  it("deepseek anahtar varsa etkin olur", () => {
    const config = resolveAiConfig({
      provider: "deepseek",
      deepseekApiKey: "abc",
    });
    expect(config.enabled).toBe(true);
    expect(config.provider).toBe("deepseek");
    expect(config.model).toBe("deepseek-chat");
  });

  it("openai-compatible eksik yapilandirmada devre disi kalir", () => {
    const config = resolveAiConfig({ provider: "openai-compatible" });
    expect(config.enabled).toBe(false);
    expect(config.reason).toContain("OPENAI_COMPAT_BASE_URL");
  });

  it("yerel openai-compatible adres anahtar istemez", () => {
    const config = resolveAiConfig({
      provider: "openai-compatible",
      openAiCompatBaseUrl: "http://localhost:1234/v1",
      openAiCompatModel: "local-model",
    });
    expect(config.enabled).toBe(true);
  });

  it("uzak openai-compatible adres anahtar ister", () => {
    const config = resolveAiConfig({
      provider: "openai-compatible",
      openAiCompatBaseUrl: "https://api.example.com/v1",
      openAiCompatModel: "gpt-x",
    });
    expect(config.enabled).toBe(false);
    expect(config.reason).toContain("OPENAI_COMPAT_API_KEY");
  });
});
