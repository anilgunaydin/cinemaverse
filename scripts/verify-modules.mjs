/**
 * Yeni modullerin (D: arastirma, E: AI, F: spoiler, veri aktarimi, inceleme)
 * uctan uca dogrulamasi. GERCEK sunucuya ve GERCEK dis kaynaklara karsi
 * calisir; yalnizca gelistirme ortaminda kullanin.
 *
 * Kullanim: node scripts/verify-modules.mjs [baseUrl]
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
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
}

function clearCookies() {
  jar.clear();
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
  results.push({ name, passed });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` â€” ${detail}` : ""}`);
}

const stamp = Date.now();
const email = `verify_${stamp}@cinemaverse.local`;

const register = await call("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({ email, password: "verify-test-123", displayName: "Verify" }),
});
record("Kayit olusturma", register.status === 201, `HTTP ${register.status}`);

const aiStatus = await call("/api/ai/status");
const aiEnabled = aiStatus.json?.enabled === true;
record(
  "AI durumu okundu",
  aiStatus.status === 200 && typeof aiStatus.json?.enabled === "boolean",
  `provider=${aiStatus.json?.provider}, enabled=${aiStatus.json?.enabled}`,
);
// AI kapaliysa provider "none" olmali; aciksa bulut saglayici olmali.
// Yerel Ollama desteklenmedigi icin provider asla "ollama" olamaz.
record(
  "AI saglayici durumu tutarli",
  aiEnabled
    ? aiStatus.json?.provider === "gemini" ||
        aiStatus.json?.provider === "openai-compatible"
    : aiStatus.json?.provider === "none",
  `provider=${aiStatus.json?.provider}`,
);

// Arama + ice aktarma (gercek Wikidata)
const search = await call("/api/search?q=inception&kind=movie");
const first = search.json?.results?.[0];
let titleId = null;
if (first) {
  const imported = await call("/api/catalog/import", {
    method: "POST",
    body: JSON.stringify({ provider: first.provider, providerId: first.providerId }),
  });
  titleId = imported.json?.titleId ?? null;
}
record("Yapim hazir (arama + ice aktarma)", Boolean(titleId), titleId ?? "yok");

// Kutuphane kaydi (izliyorum, ilerleme)
if (titleId) {
  const entry = await call("/api/library", {
    method: "POST",
    body: JSON.stringify({
      titleId,
      status: "watching",
      rating: 8,
      progressSeason: 1,
      progressEpisode: 2,
    }),
  });
  record("Kutuphane kaydi (ilerleme ile)", entry.status === 200 || entry.status === 201, `HTTP ${entry.status}`);
}

// Inceleme (spoiler + kapsam)
if (titleId) {
  const review = await call("/api/reviews", {
    method: "POST",
    body: JSON.stringify({
      titleId,
      body: "Bu film gerÃ§ekten etkileyici; gÃ¶rÃ¼ntÃ¼ yÃ¶netimi ve mÃ¼zikleri Ã§ok iyi.",
      rating: 8,
      containsSpoiler: true,
      spoilerScopeSeason: 2,
      visibility: "public",
    }),
  });
  record("Inceleme kaydedildi", review.status === 200 || review.status === 201, `HTTP ${review.status}`);

  const list = await call(`/api/reviews?titleId=${encodeURIComponent(titleId)}`);
  const hasItem = (list.json?.items?.length ?? 0) >= 1;
  record("Inceleme listelendi", list.status === 200 && hasItem, `${list.json?.items?.length ?? 0} kayit`);

  const publicList = await call("/api/reviews");
  record("Topluluk akisi calisiyor", publicList.status === 200, `${publicList.json?.items?.length ?? 0} kayit`);
}

// AI tartismasi: acik oldugu icin mesaj calismali (200/201)
const conversation = await call("/api/ai/conversations", {
  method: "POST",
  body: JSON.stringify({ titleId, heading: "Test tartisma", spoilerMode: "none" }),
});
const conversationId = conversation.json?.conversation?.id ?? null;
record("Tartisma olusturuldu", conversation.status === 201 && Boolean(conversationId), `HTTP ${conversation.status}`);

if (conversationId) {
  const message = await call(`/api/ai/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: "Merhaba, filmi anlat." }),
  });
  if (aiEnabled) {
    record(
      "AI acikken mesaj kabul edildi",
      message.status === 200 || message.status === 201,
      `HTTP ${message.status}`,
    );
  } else {
    // AI kapaliyken mesaj reddedilmeli ve hicbir veri gonderilmemeli.
    record(
      "AI kapaliyken mesaj reddedildi (ai_disabled)",
      message.status === 409 && message.json?.code === "ai_disabled",
      `HTTP ${message.status}`,
    );
  }
}

// Arastirma (Wikipedia; gercek ag istegi)
if (titleId) {
  const research = await call("/api/research", {
    method: "POST",
    body: JSON.stringify({ titleId }),
  });
  const count = research.json?.sourceCount ?? 0;
  const ok = research.status === 200 && (count > 0 || Boolean(research.json?.error) || research.json?.status === "partial");
  record(
    "Kaynak temelli arastirma calisti",
    ok,
    `status=${research.json?.status} kaynak=${count}`,
  );

  const sessions = await call(`/api/research?titleId=${encodeURIComponent(titleId)}`);
  record("Arastirma oturumlari listelendi", sessions.status === 200, `${sessions.json?.sessions?.length ?? 0} oturum`);
}

// Tartismalar (konu + yanit CRUD)
let threadId = null;
if (titleId) {
  const thread = await call("/api/discussions", {
    method: "POST",
    body: JSON.stringify({
      titleId,
      heading: "Dogrulama tartismasi",
      body: "Bu konu otomatik dogrulama betigi tarafindan olusturuldu.",
      containsSpoiler: false,
      visibility: "public",
    }),
  });
  threadId = thread.json?.threadId ?? null;
  record("Tartisma konusu olusturuldu", thread.status === 201 && Boolean(threadId), `HTTP ${thread.status}`);

  const list = await call(`/api/discussions?titleId=${encodeURIComponent(titleId)}`);
  const found = (list.json?.items ?? []).some((item) => item.id === threadId);
  record("Tartisma listelendi", list.status === 200 && found, `${list.json?.items?.length ?? 0} konu`);
}

let postId = null;
if (threadId) {
  const reply = await call(`/api/discussions/${threadId}/posts`, {
    method: "POST",
    body: JSON.stringify({ body: "Ilk yanit.", containsSpoiler: false }),
  });
  postId = reply.json?.postId ?? null;
  record("Tartismaya yanit eklendi", reply.status === 201 && Boolean(postId), `HTTP ${reply.status}`);

  const detail = await call(`/api/discussions/${threadId}`);
  const posts = detail.json?.thread?.posts?.length ?? 0;
  record(
    "Konu detayi yanitlariyla okundu",
    detail.status === 200 && posts === 1,
    `${posts} yanit`,
  );

  if (postId) {
    const deletePost = await call(`/api/discussions/${threadId}/posts/${postId}`, {
      method: "DELETE",
    });
    record("Kendi yanitini silme", deletePost.status === 200, `HTTP ${deletePost.status}`);
  }

  const deleteThread = await call(`/api/discussions/${threadId}`, { method: "DELETE" });
  record("Kendi konusunu silme", deleteThread.status === 200, `HTTP ${deleteThread.status}`);
}

// Gizlilik: ozel konu, oturum kapatildiginda gorunmez olmali.
if (titleId) {
  const priv = await call("/api/discussions", {
    method: "POST",
    body: JSON.stringify({
      titleId,
      heading: "Ozel konu",
      body: "Yalnizca ben gormeliyim.",
      visibility: "private",
    }),
  });
  const privId = priv.json?.threadId ?? null;
  clearCookies();
  const anonDetail = privId ? await call(`/api/discussions/${privId}`) : { status: 0 };
  const anonList = await call("/api/discussions");
  const leaked = (anonList.json?.items ?? []).some((item) => item.id === privId);
  record(
    "Ozel konu oturum kapatildiginda gizli",
    anonDetail.status === 404 && !leaked,
    `HTTP ${anonDetail.status}`,
  );

  // Tekrar giris yap (veri aktarimi testleri icin).
  const relogin = await call("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: "verify-test-123" }),
  });
  record("Tekrar giris (veri aktarimi icin)", relogin.status === 200, `HTTP ${relogin.status}`);
}

// Veri disa aktarma (JSON + CSV)
const jsonExport = await call("/api/data/export?format=json");
const exportLibrary = jsonExport.json?.library?.length ?? 0;
const exportReviews = jsonExport.json?.reviews?.length ?? 0;
record(
  "JSON yedegi alindi",
  jsonExport.status === 200 && exportLibrary >= 1 && exportReviews >= 1,
  `kutuphane=${exportLibrary} inceleme=${exportReviews}`,
);

const csvExport = await call("/api/data/export?format=csv");
record(
  "CSV yedegi alindi",
  csvExport.status === 200 && csvExport.text.includes("titleName"),
  `HTTP ${csvExport.status}`,
);

// Veri ice aktarma: disa aktarilan kutuphane kaydini geri yukle
if (jsonExport.json?.library?.length) {
  const importResult = await call("/api/data/import", {
    method: "POST",
    body: JSON.stringify({ library: jsonExport.json.library, reviews: [] }),
  });
  record(
    "JSON ice aktarma calisti",
    importResult.status === 200 && (importResult.json?.libraryImported ?? 0) >= 1,
    `aktarilan=${importResult.json?.libraryImported} atlanan=${importResult.json?.librarySkipped?.length ?? 0}`,
  );
}

console.log("\nOzet:");
console.log(`${results.filter((r) => r.passed).length}/${results.length} test gecti`);
process.exit(results.every((r) => r.passed) ? 0 : 1);
