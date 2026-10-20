/**
 * Uctan uca duman testi: gercek sunucuya karsi calisir.
 * Kullanim: node scripts/smoke.mjs [baseUrl]
 *
 * Not: Bu betik GERCEK veritabani ve GERCEK dis kaynaklari kullanir.
 * Yalnizca gelistirme ortaminda calistirin.
 */

const base = process.argv[2] ?? "http://localhost:3000";
const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  for (const cookie of raw) {
    const [pair] = cookie.split(";");
    const index = pair.indexOf("=");
    if (index > 0) {
      jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
  }
}

async function call(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(jar.size ? { Cookie: cookieHeader() } : {}),
      ...(options.headers ?? {}),
    },
  });
  storeCookies(response);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

const results = [];
function record(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const stamp = Date.now();
const email = `smoke_${stamp}@cinemaverse.local`;

// 1. Kayit
const register = await call("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    email,
    password: "smoke-test-123",
    displayName: "Smoke Test",
  }),
});
record("Kayit olusturma", register.status === 201, `HTTP ${register.status}`);

// 2. Zayif sifre reddi
const weak = await call("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    email: `weak_${stamp}@cinemaverse.local`,
    password: "123",
    displayName: "Zayif",
  }),
});
record("Zayif sifre reddedildi", weak.status === 400, `HTTP ${weak.status}`);

// 3. Arama
const search = await call("/api/search?q=inception&kind=movie");
const firstResult = search.json?.results?.[0];
record(
  "Gercek arama sonucu",
  search.status === 200 && Boolean(firstResult),
  firstResult ? `${firstResult.originalTitle} (${firstResult.releaseYear})` : `HTTP ${search.status}`,
);

// 4. Icerik aktarimi
let titleId = null;
if (firstResult) {
  const imported = await call("/api/catalog/import", {
    method: "POST",
    body: JSON.stringify({
      provider: firstResult.provider,
      providerId: firstResult.providerId,
    }),
  });
  titleId = imported.json?.titleId ?? null;
  record(
    "Yapim kutuphaneye aktarildi",
    imported.status === 200 || imported.status === 201,
    titleId ?? `HTTP ${imported.status}`,
  );
}

// 5. Yetkisiz erisim kontrolu
const anonymousJar = new Map(jar);
jar.clear();
const unauthorized = await call("/api/library");
record(
  "Giris yapmadan kutuphane reddedildi",
  unauthorized.status === 401,
  `HTTP ${unauthorized.status}`,
);
for (const [k, v] of anonymousJar) jar.set(k, v);

// 6. Kutuphane listesi
const library = await call("/api/library");
record("Kutuphane listesi", library.status === 200, `HTTP ${library.status}`);

console.log("\nOzet:");
console.log(
  `${results.filter((r) => r.passed).length}/${results.length} test gecti`,
);
process.exit(results.every((r) => r.passed) ? 0 : 1);
