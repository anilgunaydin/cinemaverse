/**
 * AI tartismasi icin sistem talimati (prompt) olusturucu (saf fonksiyon).
 *
 * Bu bir GUVENLIK ve DAVRANIS katmanidir: spoiler modu ne olursa olsun,
 * modelin kullaniciya kesinlikle uymasi gereken sinirlar burada yazilir.
 * Boylece ayni kurallar tek yerden yonetilir ve test edilebilir.
 */

export type ChatSpoilerMode = "none" | "progress" | "season" | "all";

export type SystemPromptInput = {
  titleName: string;
  kind: string;
  year: number | null;
  spoilerMode: ChatSpoilerMode;
  /** Kullanicinin izledigi son sezon (progress/season modlarinda). */
  spoilerSeason: number | null;
};

export function buildSystemPrompt(input: SystemPromptInput): string {
  const kindLabel = input.kind === "series" ? "dizi" : "film";
  const year = input.year ? ` (${input.year})` : "";

  const base = [
    `Sen CinemaVerse içindeki bir sinema tartışma asistanısın.`,
    `Tartışılan yapım: "${input.titleName}" adlı ${kindLabel}${year}.`,
    `Türkçe, tarafsız ve saygılı yanıt ver.`,
    `Bilmediğin veya emin olmadığın bir şeyi uydurma; "bilmiyorum" demekten çekinme.`,
    `Yanıtların bir yapay zekâ tarafından üretildiği kullanıcıya açıkça belirtilir; sen de abartılı kesinlik ifadelerinden kaçın.`,
  ];

  let spoilerRule: string;
  switch (input.spoilerMode) {
    case "none":
      spoilerRule =
        "SPOILER KURALI: Hiçbir spoiler verme. Olay örgüsünün sonunu, " +
        "sürprizleri, karakter ölümlerini veya kilit gelişmeleri anlatma. " +
        "Yalnızca spoiler içermeyen genel bilgi, tema ve atmosfer tartış.";
      break;
    case "all":
      spoilerRule =
        "SPOILER KURALI: Kullanıcı yapımın tamamını izlediğini belirtti. " +
        "Tüm olay örgüsünü, sonu ve sürprizleri tartışabilirsin.";
      break;
    case "season":
    case "progress": {
      const season = input.spoilerSeason;
      spoilerRule =
        season === null
          ? "SPOILER KURALI: Kullanıcının izleme ilerlemesi bilinmiyor. " +
            "Bu nedenle spoiler verme; yalnızca genel ve spoiler içermeyen bilgi ver."
          : `SPOILER KURALI: Kullanıcı ${season}. sezona kadar izledi. ` +
            `${season}. sezonun sonrasına dair hiçbir olay, sürpriz veya gelişme anlatma. ` +
            `Yalnızca ${season}. sezona kadar olan içeriği tartış.`;
      break;
    }
    default:
      spoilerRule =
        "SPOILER KURALI: Emin değilsen spoiler verme; yalnızca güvenli bilgi ver.";
  }

  return [...base, spoilerRule].join("\n");
}
