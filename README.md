# 🎬 CinemaVerse

**Kişisel Sinema Hafızası** — izlediğin filmleri kaydet, zevkini anlayan bir profil oluştur, yapay zekâ ile tartış, toplulukla paylaş.

[![CI](https://github.com/anilgunaydin/cinemaverse/actions/workflows/ci.yml/badge.svg)](https://github.com/anilgunaydin/cinemaverse/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-MIT-gold.svg)](LICENSE)

---

## ✨ Özellikler

| Alan | Özellik |
|---|---|
| **Kişisel Hafıza** | 149 kayıt, puanlama, durum, notlar, "beğendiğin yönler", sahne notları, tekrar izleme isteği |
| **AI Tartışma** | Ollama (llama3.2) ile yapım bazında spoiler-korumalı sohbet, yerel & ücretsiz |
| **Sinema Karakterin** | Kütüphaneden yola çıkarak hesaplanan kişilik profili + OG paylaşım kartı |
| **Sinema Wrapped** | Yıl özeti: tür haritası, dekad tüneli, saat, en yüksek puan |
| **Tercih Motoru** | Tür/dekad/boyut/kadro ağırlıkları, mikro onboarding (5 soru), haftalık batch |
| **Netflix-stili Grid** | 16:9 yatay afişler, hover'da otomatik fragman, global ses durumu |
| **Türkiye Yayın Platformları** | TMDb watch/providers → abonelik/kiralama/satın alma, çoklu kaynak seçimi |
| **İnternet Yorumları** | Wikipedia TR/EN "Reception" bölümlerinden derlenmiş, atıflı (CC BY-SA) |
| **Topluluk** | İncelemeler, tartışmalar, listeler, takip, moderasyon paneli, raporlar |
| **Bildirimler** | Takip/inceleme/yanıt/rapor bildirimleri, Web Push (VAPID), okunmamış rozeti |
| **PWA** | Manifest, maskable ikonlar, splash screen, offline cache, background sync |
| **Arama** | Türkçe karakter normalizasyonu, fuzzy eşleşme, sonuç vurgulama |

---

## 🛠 Teknoloji

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript 5**
- **Drizzle ORM** + **SQLite** (WAL)
- **Tailwind CSS 4**
- **Ollama** (`llama3.2`) — yerel AI, ücretsiz, internet gerektirmez
- **TMDb** — fragman, backdrop, puan, yayın platformu
- **Wikidata / TVmaze / Wikipedia** — metadata, yorumlar
- **Playwright** — E2E testler · **Vitest** — birim testler
- **web-push** — VAPID bildirimleri

---

## 🚀 Kurulum

```bash
npm install
cp .env.example .env      # .env'i düzenle
npx tsx scripts/apply-migrations.ts   # veritabanı tabloları
npm run dev
```

**Gerekli olmayan ama önerilen `.env` değişkenleri:**

```env
# AI (varsayılan: ollama)
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2

# TMDb (fragman + backdrop + yayın platformu)
TMDB_API_KEY=...
TMDB_READ_TOKEN=...

# Oturum imzalama (üretimde mutlaka)
SESSION_SECRET=...
```

---

## 🧪 Testler

```bash
npm run lint          # ESLint
npx tsc --noEmit     # Tip kontrolü
npx vitest run       # Birim testler (90)
npx playwright test  # E2E testler (19)
node scripts/verify-modules.mjs   # Entegrasyon doğrulama (23)
```

**CI**, her push'ta: typecheck → unit → build → Playwright E2E → entegrasyon doğrulaması.

---

## 📁 Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Production build |
| `npm run preferences:update` | Haftalık tercih profili yenileme (cron) |
| `npx tsx scripts/apply-migrations.ts` | Drizzle migration uygula |
| `node scripts/seed-demo.mjs --apply` | Demo verisi yükle |
| `npx tsx scripts/seed-ci.ts` | CI test verisi yükle |

---

## 🗂 Veri Kaynakları

Tüm veriler kaynağında doğrulandığı şekilde gösterilir; eksik alanlar tahminle doldurulmaz.

- **TMDb** — fragman, arka plan görseli, harici puan, TR yayın platformları
- **Wikidata** — film/dizi kimlikleri, ekip, türler
- **TVmaze** — dizi detayları, bölüm/sezon bilgisi
- **Wikipedia** — "Reception / Eleştiriler" bölümlerinden yorum derlemesi (CC BY-SA)

---

## 📄 Lisans

MIT
