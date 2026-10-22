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
| **AI Tartışma** | Gemini (ücretsiz kota) veya OpenAI uyumlu sağlayıcı ile yapım bazında spoiler-korumalı sohbet; yerel model çalıştırmaz |
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
- **Gemini / OpenAI uyumlu sağlayıcı** — bulut AI (opsiyonel; yerel model yok)
- **TMDb** — fragman, backdrop, puan, yayın platformu
- **Wikidata / TVmaze / Wikipedia** — metadata, yorumlar
- **Playwright** — E2E testler · **Vitest** — birim testler
- **web-push** — VAPID bildirimleri

---

## 🚀 Kurulum

### Windows (en kolay)

Projeyi çift tıklayarak **`start.bat`** çalıştırın. Script sırasıyla:
1. Node.js kurulu mu kontrol eder
2. Eksik bağımlılıkları kurar (`npm install`)
3. `.env` yoksa `.env.example`'dan kopyalar
4. AI sağlayıcısını kontrol eder (Gemini anahtarı varsa AI açılır, yoksa kapalı kalır)
5. Veritabanı migration'larını uygular
6. Tarayıcıyı açar ve geliştirme sunucusunu başlatır

Sunucuyu durdurmak için: **`stop.bat`** çalıştırın (veya konsolda `Ctrl+C`).

### Manuel

```bash
npm install
cp .env.example .env      # .env'i düzenle
npm run db:migrate         # veritabanı tabloları
npm run dev
```

**Gerekli olmayan ama önerilen `.env` değişkenleri:**

```env
# AI (varsayılan: kapalı; yerel model çalıştırılmaz)
# Açmak için: AI_PROVIDER=gemini + GEMINI_API_KEY
AI_PROVIDER=none

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
| `npm run db:migrate` | Drizzle migration uygula |
| `npm run preferences:update` | Haftalık tercih profili yenileme (cron) |
| `npm run seed:demo` | Demo verisi yükle |
| `npm run seed:ci` | CI test verisi yükle |
| `npx tsc --noEmit` | Tip kontrolü |
| `npx vitest run` | Birim testler |
| `npx playwright test` | E2E testler |
| `node scripts/verify-modules.mjs` | Entegrasyon doğrulaması |

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
