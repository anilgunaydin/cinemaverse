import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { externalComments } from "@/lib/db/schema";
import { chat } from "./provider";
import { cleanTranslation } from "./translation-text";

/**
 * Yabanci (tr disi) internet yorumlarini Turkceye cevirir.
 *
 * - Ceviri DB'de saklanir (external_comments.body_tr): ayni yorum ikinci kez
 *   cevrilmez, sayfa yenilense de kalir.
 * - Kaynak metin ASLA degistirilmez; ceviri ayri alanda tutulur.
 * - AI kapaliysa aga cikilmaz, acikca hata dondurulur.
 */

const SYSTEM_PROMPT = [
  "Sen İngilizce film eleştirisi metinlerini Türkçeye çeviren bir çevirmensin.",
  "Kurallar:",
  "- Yalnızca Türkçe çeviriyi yaz. Açıklama, başlık, tırnak veya \"Çeviri:\" etiketi ekleme.",
  "- Cümleyi kelime kelime değil, anlamı koruyarak doğal Türkçe ile yeniden kur.",
  "- Çeviride İngilizce kelime bırakma; yalnızca özel adlar (kişi, film, site, kurum) İngilizce kalabilir.",
  "- Türkçe karakterleri doğru kullan: ç, ğ, ı, İ, ö, ş, ü.",
  "- Terimler: critical consensus = eleştirmen görüşü, approval rating = onay oranı, " +
    "review = inceleme, audiences = seyirciler, grade = not, pacing = tempo, " +
    "cinematography = görüntü yönetimi, ending = final, ambiguous = belirsiz, " +
    "bold choice = cesur tercih, plot = olay örgüsü, thrilling = heyecan verici, " +
    "smart = zekice, innovative = yenilikçi.",
  "- Kaynakta olmayan bilgi ekleme.",
].join("\n");

/**
 * Sifir ornekle Ingilizce kelime birakma egilimi olabiliyor; film elestirisi
 * alanindan 3 ornek ciktiyi belirgin sekilde iyilestiriyor.
 */
const FEW_SHOT: { user: string; assistant: string }[] = [
  {
    user: "Rotten Tomatoes reports an 87% approval rating based on 363 reviews.",
    assistant:
      "Rotten Tomatoes, 363 incelemeye dayanarak %87 onay oranı bildiriyor.",
  },
  {
    user:
      'Audiences polled by CinemaScore gave the film an average grade of "B+".',
    assistant: 'CinemaScore seyirci anketinde film ortalama "B+" notu aldı.',
  },
  {
    user:
      "The film received widespread critical acclaim, with critics praising the performances and the direction.",
    assistant:
      "Film, eleştirmenlerin oyunculukları ve yönetmenliği övmesiyle geniş çapta beğeni topladı.",
  },
  {
    user:
      "Some viewers found the ending confusing, while others saw it as a bold choice.",
    assistant:
      "Bazı seyirciler finali kafa karıştırıcı buldu, bazıları ise cesur bir tercih olarak gördü.",
  },
];

export type TranslateOutcome =
  | {
      ok: true;
      translation: string;
      model: string | null;
      cached: boolean;
    }
  | {
      ok: false;
      reason: "not_found" | "already_turkish" | "disabled" | "error";
      message: string;
    };

/** Modelin dondurdugu metni guvenli hale getirir (etiket/tirnak temizligi). */
export { cleanTranslation };

export async function translateExternalComment(
  commentId: string,
): Promise<TranslateOutcome> {
  const db = getDb();
  const rows = await db
    .select({
      id: externalComments.id,
      body: externalComments.body,
      language: externalComments.language,
      bodyTr: externalComments.bodyTr,
      translationModel: externalComments.translationModel,
    })
    .from(externalComments)
    .where(eq(externalComments.id, commentId))
    .limit(1);

  const comment = rows[0];
  if (!comment) {
    return {
      ok: false,
      reason: "not_found",
      message: "Yorum bulunamadı.",
    };
  }

  if (comment.language === "tr") {
    return {
      ok: false,
      reason: "already_turkish",
      message: "Bu yorum zaten Türkçe.",
    };
  }

  if (comment.bodyTr) {
    return {
      ok: true,
      translation: comment.bodyTr,
      model: comment.translationModel,
      cached: true,
    };
  }

  const result = await chat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      ...FEW_SHOT.flatMap((example) => [
        { role: "user" as const, content: example.user },
        { role: "assistant" as const, content: example.assistant },
      ]),
      { role: "user", content: comment.body },
    ],
    {
      temperature: 0.3,
      maxTokens: Math.min(1200, Math.ceil(comment.body.length / 3) + 200),
      timeoutMs: 90_000,
    },
  );

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason === "disabled" ? "disabled" : "error",
      message:
        result.reason === "disabled"
          ? "Çeviri için yapay zekâ sağlayıcısı kapalı."
          : `Çeviri yapılamadı: ${result.message}`,
    };
  }

  const translation = cleanTranslation(result.content);
  if (!translation) {
    return {
      ok: false,
      reason: "error",
      message: "Çeviri boş döndü, tekrar deneyin.",
    };
  }

  await db
    .update(externalComments)
    .set({
      bodyTr: translation,
      translationModel: result.model,
      translatedAt: new Date().toISOString(),
    })
    .where(eq(externalComments.id, comment.id));

  return {
    ok: true,
    translation,
    model: result.model,
    cached: false,
  };
}
