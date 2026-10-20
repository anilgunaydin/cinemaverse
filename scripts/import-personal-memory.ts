/**
 * Kisisel sinema hafizasi icer aktarimi (Anil hedef kullanici).
 *
 * Kullanim:
 *   npx tsx --conditions=react-server scripts/import-personal-memory.ts --dry-run
 *   npx tsx --conditions=react-server scripts/import-personal-memory.ts --apply
 *
 * Onemli:
 *  - Varsayilan mod DRY-RUN'dir: hicbir veritabani yazimi yapilmaz.
 *  - --apply modunda yalnizca hedef kullanicinin eksik kayitlari eklenir;
 *    mevcut kayitlarin puani UZERINE YAZILMAZ.
 *  - Kaynak dosyalar degistirilmez.
 *  - Islem idempotenttir: ayni dosyalar tekrar islenirse yeni kopya olusmaz.
 */

import fs from "node:fs";
import path from "node:path";

import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  franchises,
  libraryEntries,
  preferenceProfiles,
  titleAliases,
  titles,
  users,
} from "@/lib/db/schema";
import { newId, nowIso } from "@/lib/http";
import { hashPassword } from "@/lib/auth/password";
import { importTitle, searchCatalog } from "@/lib/catalog/service";
import { levenshtein, similarity } from "@/lib/catalog/matching";
import { providerFetchJson } from "@/lib/providers/http";
import {
  applyExplicitLikes,
  averageRating,
  mergeRecords,
  normalizeName,
  parseCsvSources,
  parseJsonSource,
  ratingDistribution,
  splitAltTitles,
  stripParenQualifiers,
  type MemoryRecord,
} from "@/lib/community/import/source";
import {
  buildPreferenceProfileJson,
  resolveTarget,
  scopeLabelTr,
  STATUS_LABELS_TR,
  type TitleKind,
} from "@/lib/community/import/mapping";

/* -------------------------------------------------------------------------- */
/* Argumanlar                                                                  */
/* -------------------------------------------------------------------------- */

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const DRY_RUN = !APPLY;
const sourceDirArg = args.find((a) => a.startsWith("--source-dir="));
const SOURCE_DIR = sourceDirArg
  ? sourceDirArg.split("=").slice(1).join("=")
  : path.resolve("anıl");
const REPORT_DIR = path.resolve("data/import-reports");

function argValue(name: string): string | null {
  const found = args.find((a) => a.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : null;
}

/** Hedef kullanici secimi (acikca istenirse). */
const USER_ID_ARG = argValue("--user-id");
const USER_EMAIL_ARG = argValue("--user-email");
const CREATE_USER = args.includes("--create-user");
const CREATE_EMAIL = argValue("--email");
const CREATE_PASSWORD = argValue("--password");
const CREATE_DISPLAY_NAME = argValue("--display-name");
/** Var olan yanlis franchise kayitlarini (film adiyla acilmis olanlari) duzeltir. */
const REPAIR = args.includes("--repair");

/* -------------------------------------------------------------------------- */
/* Tipler                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Bir kaydin cozumlenmis hedefi.
 *  - "title": katalogda hazir bir kayit.
 *  - "provider_title": provider'dan import edilecek tekil yapim.
 *  - "provider_series_season": dizi import edilip belirli sezon secilecek.
 *  - "franchise": Wikidata media franchise kaydi olusturulacak.
 */
type Resolution =
  | { type: "title"; titleId: string; label: string; how: string }
  | {
      type: "provider_title";
      provider: "wikidata" | "tvmaze";
      providerId: string;
      label: string;
      year: number | null;
      score: number;
    }
  | {
      type: "provider_series_season";
      provider: "wikidata" | "tvmaze";
      providerId: string;
      seriesName: string;
      seasonNumber: number;
      label: string;
    }
  | {
      type: "franchise";
      qid: string;
      /** Wikidata etiketi (ornegin "Harry Potter film series"). */
      label: string;
      /** Kaynak dosyadaki ozgun ad ("Harry Potter") — kayit bu adi tasir. */
      sourceName: string;
    };

type PlanRow = {
  record: MemoryRecord;
  targetKind: TitleKind;
  watchStatus: string;
  statusLabel: string;
  scopeLabel: string;
  resolution: Resolution | null;
  ambiguous: boolean;
  note: string;
};

type CatalogEntry = {
  id: string;
  kind: string;
  originalTitle: string;
  localizedTitle: string | null;
  releaseYear: number | null;
  wikidataId: string | null;
  tmdbId: string | null;
  tvmazeId: string | null;
  imdbId: string | null;
  parentId: string | null;
  seasonNumber: number | null;
};

/* -------------------------------------------------------------------------- */
/* Yardimcilar                                                                 */
/* -------------------------------------------------------------------------- */

function log(message: string) {
  console.log(message);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Provider 429 (hiz siniri) dondugunde kisa bekleyip yeniden dener.
 *
 * DIKKAT: Bir provider hata verip digerleri sonuc dondurunce bile yeniden
 * denenir; aksi halde eksik kalan kayit kalici olarak kaybolur.
 */
async function searchWithRetry(
  query: string,
  kind: "movie" | "series" | "all",
  year: number | null,
  attempts = 3,
): Promise<Awaited<ReturnType<typeof searchCatalog>>> {
  let last = await searchCatalog({ query, kind, year, language: "tr" });
  for (let attempt = 1; attempt < attempts; attempt += 1) {
    const failedProviders = last.providerStatus.filter(
      (status) => status.error && /429|hiz siniri|rate/i.test(status.error),
    );
    const anyProviderFailed = last.providerStatus.some((status) => status.error);
    if (failedProviders.length === 0 && !anyProviderFailed) break;
    await sleep(4000 * attempt);
    last = await searchCatalog({ query, kind, year, language: "tr" });
  }
  return last;
}

type ResolutionResult = {
  resolution: Resolution | null;
  ambiguous: boolean;
  note: string;
};

/* -------------------------------------------------------------------------- */
/* Ana akis                                                                    */
/* -------------------------------------------------------------------------- */

async function main() {
  const startedAt = new Date();

  log("=".repeat(78));
  log("CINEMAVERSE — KISISEL SINEMA HAFIZASI ICE AKTARIMI");
  log(`Mod: ${APPLY ? "APPLY (veritabanina yazilacak)" : "DRY-RUN (yazma yapilmaz)"}`);
  log(`Kaynak klasoru: ${SOURCE_DIR}`);
  log("=".repeat(78));

  /* --- 1. Kaynak dosyalarini oku --- */
  const jsonPath = path.join(
    SOURCE_DIR,
    "cinemaverse_personal_memory_import.json",
  );
  const csvScoredPath = path.join(SOURCE_DIR, "cinemaverse_scored_titles.csv");
  const csvStatusPath = path.join(SOURCE_DIR, "cinemaverse_watch_statuses.csv");

  for (const file of [jsonPath, csvScoredPath, csvStatusPath]) {
    if (!fs.existsSync(file)) {
      log(`\n[HATA] Kaynak dosya bulunamadi: ${file}`);
      log("Ice aktarim durduruldu. Eksik dosyayi belirleyip tekrar deneyin.");
      process.exit(1);
    }
  }
  log(`\n[1/8] Kaynak dosyalar bulundu (3/3).`);

  const jsonRaw = fs.readFileSync(jsonPath, "utf8");
  const csvScoredRaw = fs.readFileSync(csvScoredPath, "utf8");
  const csvStatusRaw = fs.readFileSync(csvStatusPath, "utf8");

  /* --- 2. Ayristir ve birlestir --- */
  const jsonParsed = parseJsonSource(jsonRaw);
  const csvParsed = parseCsvSources(csvScoredRaw, csvStatusRaw);
  const merged = mergeRecords(jsonParsed.records, csvParsed.records);
  const liked = applyExplicitLikes(merged.records, jsonParsed.explicitLikeTitles);

  log(`\n[2/8] Kaynaklar ayristirildi:`);
  log(
    `   JSON  : puanlanan=${jsonParsed.stats.jsonScored} izlenmemis=${jsonParsed.stats.jsonUnwatched} yarim=${jsonParsed.stats.jsonPartially} izlenmis-puansiz=${jsonParsed.stats.jsonWatchedUnrated} belirsiz=${jsonParsed.stats.jsonUnknown} sevilenler=${jsonParsed.stats.explicitLikes}`,
  );
  log(
    `   CSV   : puanlanan=${csvParsed.stats.csvScored} izleme-durumu=${csvParsed.stats.csvWatchStatuses}`,
  );
  log(
    `   Birlesik kayit: ${merged.records.length} (mukerrer kayitlar tek kayda indirgendi)`,
  );
  log(
    `   Eslesen "sevdikleri" listesi: ${jsonParsed.explicitLikeTitles.length - liked.unmatched.length}/${jsonParsed.explicitLikeTitles.length}`,
  );
  if (liked.unmatched.length > 0) {
    log(`   Eslesmeyen sevilenler: ${liked.unmatched.join(", ")}`);
  }
  if (merged.discrepancies.length > 0) {
    log(`   CSV/JSON uyumsuzluklari (${merged.discrepancies.length}):`);
    for (const d of merged.discrepancies.slice(0, 20)) log(`      - ${d}`);
  }

  /* --- 3. Hedef kullaniciyi bul --- */
  const db = getDb();
  const allUsers = await db.select().from(users);
  let target = findTargetUser(allUsers, "Anıl");

  log(`\n[3/8] Hedef kullanici aramasi:`);

  if (!target && CREATE_USER) {
    if (!CREATE_EMAIL || !CREATE_PASSWORD) {
      log(`   HATA: --create-user icin --email ve --password zorunlu.`);
      process.exit(3);
    }
    const displayName = CREATE_DISPLAY_NAME ?? "Anıl";
    const existing = allUsers.find(
      (u) => u.email.toLowerCase() === CREATE_EMAIL.toLowerCase(),
    );
    if (existing) {
      log(`   HATA: ${CREATE_EMAIL} e-postasina sahip bir hesap zaten var (${existing.id}).`);
      log(`   Ikincil hesap olusturulmaz.`);
      process.exit(3);
    }
    const created = await createUserAccount({
      email: CREATE_EMAIL,
      password: CREATE_PASSWORD,
      displayName,
    });
    log(`   YENI HESAP OLUSTURULDU: ${created.id} | ${created.email} | "${created.displayName}"`);
    target = created;
  }

  if (!target) {
    log(`   HATA: "Anil" adiyla ESLESEN kullanici bulunamadi.`);
    log(`   Veritabanindaki ${allUsers.length} kullanici:`);
    for (const u of allUsers) {
      log(`      ${u.id} | ${u.email} | "${u.displayName}" | role=${u.role}`);
    }
    log(
      `\n   Talimat geregi veriler BASKA bir hesaba aktarilmayacak; ek aktarim yapilmayacak.`,
    );
    log(
      `   Eslestirme plani yine de hesaplanip raporlanacak (salt-okunur; hicbir yazma yapilmaz).`,
    );
  } else {
    log(
      `   ESLESILDI: ${target.id} | ${target.email} | "${target.displayName}" | role=${target.role}`,
    );
    log(`   (Hesap/parola/rol degistirilmedi.)`);
  }

  const existingEntries = target
    ? await db
        .select()
        .from(libraryEntries)
        .where(eq(libraryEntries.userId, target.id))
    : [];
  log(`   Mevcut kutuphane kaydi: ${existingEntries.length}`);

  /* --- 4. Katalogu yukle --- */
  const catalogRows = await db.select().from(titles);
  const aliasRows = await db.select().from(titleAliases);
  const franchiseRows = await db.select().from(franchises);
  const catalog: CatalogEntry[] = catalogRows.map((t) => ({
    id: t.id,
    kind: t.kind,
    originalTitle: t.originalTitle,
    localizedTitle: t.localizedTitle,
    releaseYear: t.releaseYear,
    wikidataId: t.wikidataId,
    tmdbId: t.tmdbId,
    tvmazeId: t.tvmazeId,
    imdbId: t.imdbId,
    parentId: t.parentId,
    seasonNumber: t.seasonNumber,
  }));

  const importedNames = new Map<string, string>();
  for (const title of catalog) {
    importedNames.set(normalizeName(title.originalTitle), title.id);
    if (title.localizedTitle) {
      importedNames.set(normalizeName(title.localizedTitle), title.id);
    }
  }
  for (const alias of aliasRows) {
    importedNames.set(normalizeName(alias.name), alias.titleId);
  }

  log(
    `\n[4/8] Katalog: ${catalog.length} yapim, ${aliasRows.length} alternatif baslik, ${franchiseRows.length} franchise.`,
  );

  /* --- 5. Eslestirme plani --- */
  log(`\n[5/8] Eslestirme plani hesaplaniyor (${merged.records.length} kayit)...`);

  const plan: PlanRow[] = [];
  let providerCalls = 0;

  for (const record of liked.records) {
    const { titleKind, watchStatus, scopeMismatch } = resolveTarget(record);
    const row: PlanRow = {
      record,
      targetKind: titleKind,
      watchStatus,
      statusLabel: STATUS_LABELS_TR[record.status],
      scopeLabel: scopeLabelTr(record.scope),
      resolution: null,
      ambiguous: false,
      note: scopeMismatch
        ? "Puan kapsami ile kayit turu uyumsuz; kaynak kapsami korundu."
        : "",
    };

    // a) Yerel katalog
    const local = matchInCatalog(
      record,
      titleKind,
      catalog,
      aliasRows,
      franchiseRows,
      importedNames,
    );
    if (local) {
      row.resolution = local;
      plan.push(row);
      continue;
    }

    // b) Franchise: Wikidata media franchise ara
    if (titleKind === "franchise") {
      const found = await resolveFranchise(record);
      if (found.resolution) {
        row.resolution = found.resolution;
        importedNames.set(normalizeName(record.rawTitle), "__franchise_pending__");
        plan.push(row);
        continue;
      }
      row.ambiguous = found.ambiguous;
      row.note = [row.note, found.note].filter(Boolean).join(" ");
      plan.push(row);
      continue;
    }

    // c) Provider aramasi
    const searched = await matchWithProvider(record, titleKind);
    providerCalls += 1;
    if (searched.resolution) {
      row.resolution = searched.resolution;
    } else {
      row.ambiguous = searched.ambiguous;
      row.note = [row.note, searched.note].filter(Boolean).join(" ");
    }
    plan.push(row);

    if (providerCalls % 10 === 0) {
      log(
        `   ... ${plan.length}/${merged.records.length} kayit islendi (provider cagrisi: ${providerCalls})`,
      );
    }
  }

  /* --- 6. Rapor --- */
  const stats = buildStats(plan);
  const report = buildReport({
    plan,
    stats,
    target,
    preferences: jsonParsed.preferences,
    integrityRules: jsonParsed.integrityRules,
    existingEntryCount: existingEntries.length,
    providerCalls,
    dryRun: DRY_RUN,
    startedAt,
  });

  printReport(report, plan);

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(REPORT_DIR, `import-report-${stamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  log(`\nRapor dosyasi: ${reportPath}`);

  if (DRY_RUN) {
    log(`\n>>> DRY-RUN tamamlandi. Veritabanina HICBIR yazma yapilmadi.`);
    if (!target) {
      log(
        `>>> UYARI: "Anil" hedef hesabi bulunamadi. Aktarim icin once hedef hesabin belirlenmesi gerekir.`,
      );
    } else {
      log(`>>> Gercek aktarim icin: --apply bayragini kullanin.`);
    }
    return;
  }

  if (!target) {
    log(
      `\n>>> UYGULAMA YAPILMADI: "Anil" hedef hesabi bulunamadi. Veriler baska bir hesaba aktarilmadi.`,
    );
    process.exit(2);
  }

  /* --- 7. Uygula --- */
  if (REPAIR && target) {
    log(`\n[7/8] Kapsam onarimi basliyor...`);
    const sourceFranchiseNames = liked.records
      .filter((record) => record.kind === "film_franchise")
      .map((record) => record.rawTitle);
    const result = await repairFranchiseScope(target.id, sourceFranchiseNames);
    log(`   Duzeltilen franchise: ${result.repaired} | yeniden adlandirilan: ${result.renamed}`);
  }

  log(`\n[7/8] Uygulama basliyor...`);
  const applyResult = await applyPlan(plan, target.id, jsonParsed.preferences);
  log(`\n[8/8] Uygulama tamamlandi.`);

  /* --- 8. Dogrulama --- */
  await verify(target.id, applyResult);
}

/* -------------------------------------------------------------------------- */
/* Hedef kullanici                                                             */
/* -------------------------------------------------------------------------- */

function findTargetUser(
  allUsers: (typeof users.$inferSelect)[],
  targetName: string,
): (typeof users.$inferSelect) | null {
  // 0) CLI ile acikca secilen kullanici (kimlik veya e-posta).
  if (USER_ID_ARG) {
    const byId = allUsers.find((u) => u.id === USER_ID_ARG);
    if (byId) return byId;
  }
  if (USER_EMAIL_ARG) {
    const byEmail = allUsers.find(
      (u) => u.email.toLowerCase() === USER_EMAIL_ARG.toLowerCase(),
    );
    if (byEmail) return byEmail;
  }

  const wanted = normalizeName(targetName);

  // 1) Goruntulenen ad tam eslesmesi
  const exact = allUsers.filter((u) => normalizeName(u.displayName) === wanted);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return exact[0];

  // 2) E-posta yerel kismi tam eslesmesi
  const byEmail = allUsers.filter(
    (u) => normalizeName(u.email.split("@")[0]) === wanted,
  );
  if (byEmail.length === 1) return byEmail[0];
  if (byEmail.length > 1) return byEmail[0];

  // 3) Tek kullanicida geciyor
  const contains = allUsers.filter(
    (u) =>
      normalizeName(u.displayName).includes(wanted) ||
      normalizeName(u.email).includes(wanted),
  );
  if (contains.length === 1) return contains[0];

  return null;
}

/**
 * Yeni kullanici hesabi olusturur. Yalnizca kullanici acikca isteginde
 * calistirilir; mevcut hesaplara dokunmaz.
 */
async function createUserAccount(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<typeof users.$inferSelect> {
  const db = getDb();
  const passwordHash = await hashPassword(input.password);
  const id = newId("usr");
  const now = nowIso();
  await db.insert(users).values({
    id,
    email: input.email.trim().toLowerCase(),
    passwordHash,
    displayName: input.displayName.trim(),
    role: "user",
    sessionVersion: 1,
    libraryVisibility: "private",
    reviewsVisibility: "public",
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0];
}

/* -------------------------------------------------------------------------- */
/* Yerel katalog eslestirmesi                                                  */
/* -------------------------------------------------------------------------- */

function matchInCatalog(
  record: MemoryRecord,
  targetKind: TitleKind,
  catalog: CatalogEntry[],
  aliasRows: (typeof titleAliases.$inferSelect)[],
  franchiseRows: (typeof franchises.$inferSelect)[],
  importedNames: Map<string, string>,
): Resolution | null {
  const names = [record.rawTitle, ...record.altTitles];

  if (targetKind === "franchise") {
    for (const name of names) {
      const key = normalizeName(name);
      const hit = franchiseRows.find((f) => normalizeName(f.name) === key);
      if (hit) {
        const title = catalog.find(
          (t) => t.kind === "franchise" && t.wikidataId === hit.wikidataId,
        );
        if (title) {
          return {
            type: "title",
            titleId: title.id,
            label: `${title.originalTitle} (franchise kaydi)`,
            how: "catalog",
          };
        }
      }
    }
  }

  const kindOk = (kind: string) =>
    targetKind === "unknown" || kind === targetKind;

  for (const name of names) {
    const key = normalizeName(name);
    if (!key) continue;

    for (const title of catalog) {
      if (!kindOk(title.kind)) continue;
      const titleKeys = [normalizeName(title.originalTitle)];
      if (title.localizedTitle) {
        titleKeys.push(normalizeName(title.localizedTitle));
      }
      if (!titleKeys.includes(key)) continue;
      if (!yearCompatible(record.year, title.releaseYear)) continue;
      return {
        type: "title",
        titleId: title.id,
        label: `${title.originalTitle} (${title.releaseYear ?? "?"})`,
        how: "catalog",
      };
    }

    for (const alias of aliasRows) {
      if (normalizeName(alias.name) !== key) continue;
      const title = catalog.find((t) => t.id === alias.titleId);
      if (!title) continue;
      if (!kindOk(title.kind)) continue;
      if (!yearCompatible(record.year, title.releaseYear)) continue;
      return {
        type: "title",
        titleId: title.id,
        label: `${title.originalTitle} (${title.releaseYear ?? "?"}) — alias "${alias.name}"`,
        how: "catalog_alias",
      };
    }

    const importedId = importedNames.get(key);
    if (importedId && importedId !== "__franchise_pending__") {
      const title = catalog.find((t) => t.id === importedId);
      if (
        title &&
        kindOk(title.kind) &&
        yearCompatible(record.year, title.releaseYear)
      ) {
        return {
          type: "title",
          titleId: title.id,
          label: `${title.originalTitle} (${title.releaseYear ?? "?"})`,
          how: "catalog",
        };
      }
    }
  }

  return null;
}

function yearCompatible(
  expected: number | null,
  actual: number | null,
): boolean {
  if (expected === null || actual === null) return true;
  return Math.abs(expected - actual) <= 1;
}

/* -------------------------------------------------------------------------- */
/* Provider eslestirmesi                                                       */
/* -------------------------------------------------------------------------- */

async function matchWithProvider(
  record: MemoryRecord,
  targetKind: TitleKind,
): Promise<ResolutionResult> {
  if (targetKind === "season") {
    return matchSeasonWithProvider(record);
  }

  // Arama terimleri: ham ad, parantez ekleri temizlenmis ad ve alternatifler.
  const searchTerms = buildSearchTerms(record);
  const searchKind =
    targetKind === "movie"
      ? "movie"
      : targetKind === "series"
        ? "series"
        : "all";

  const candidates: Array<{
    provider: "wikidata" | "tvmaze";
    providerId: string;
    label: string;
    year: number | null;
    score: number;
    normalizedName: string;
  }> = [];

  for (const term of searchTerms) {
    const query = term.raw.trim();
    if (query.length < 2) continue;

    let outcome;
    try {
      outcome = await searchWithRetry(query, searchKind, record.year);
    } catch (error) {
      return {
        resolution: null,
        ambiguous: false,
        note: `Arama hatasi: ${(error as Error).message}`,
      };
    }

    // Tur kisitli arama bos donduyse ("Behzat Ç." Wikidata'da media franchise
    // olarak siniflandirilmis oldugu icin dizi aramasi sonuc vermez), tum
    // turlerde yeniden aranir. Bu durumda tur filtresi uygulanmaz.
    let usedAllFallback = false;
    if (outcome.results.length === 0 && searchKind !== "all") {
      outcome = await searchWithRetry(query, "all", record.year);
      usedAllFallback = true;
    }

    if (process.env.IMPORT_DEBUG) {
      log(
        `   [arama] "${query}" (kind=${searchKind}) -> ${outcome.results.length} sonuc` +
          (outcome.providerStatus.some((s) => s.error)
            ? ` | hata: ${outcome.providerStatus.map((s) => s.error).join(" ; ")}`
            : ""),
      );
    }
    for (const result of outcome.results) {
      const nameScore = Math.max(
        similarity(query, result.originalTitle),
        similarity(term.clean, result.originalTitle),
        result.localizedTitle
          ? similarity(term.clean, result.localizedTitle)
          : 0,
      );
      if (process.env.IMPORT_DEBUG) {
        log(
          `      aday: ${result.provider}/${result.providerId} "${result.originalTitle}" (${result.releaseYear ?? "?"}) kind=${result.kind} score=${nameScore.toFixed(3)}`,
        );
      }
      if (nameScore < 0.9) continue;
      if (!usedAllFallback) {
        if (targetKind === "movie" && result.kind !== "movie") continue;
        if (targetKind === "series" && result.kind !== "series") continue;
      }
      candidates.push({
        provider: result.provider as "wikidata" | "tvmaze",
        providerId: result.providerId,
        label: result.originalTitle,
        year: result.releaseYear,
        score: nameScore,
        normalizedName: normalizeName(result.originalTitle),
      });
    }

    if (candidates.length > 0) break;
  }

  if (candidates.length === 0) {
    return {
      resolution: null,
      ambiguous: false,
      note: "Provider aramasinda eslesen kayit bulunamadi.",
    };
  }

  // Ayni film iki provider'dan (wikidata + tvmaze) gelebilir; ayni ad + uyumlu
  // yil ise TEK aday sayilir.
  const unique = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) {
    const key = `${candidate.normalizedName}|${candidate.year ?? "null"}`;
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, candidate);
      continue;
    }
    // Yillardan biri bilinmiyorsa ayni film sayilir.
    if (
      existing.year === null ||
      candidate.year === null ||
      existing.year === candidate.year
    ) {
      // Skoru daha yuksek olan korunur.
      if (candidate.score > existing.score) unique.set(key, candidate);
    } else {
      unique.set(
        `${key}#${candidate.providerId}`,
        candidate,
      );
    }
  }
  let list = [...unique.values()].sort((a, b) => b.score - a.score);

  // Yil verilmisse: yili tam eslesen adaylara daralt.
  if (record.year !== null) {
    const exact = list.filter(
      (candidate) => candidate.year === null || candidate.year === record.year,
    );
    const exactYear = list.filter((candidate) => candidate.year === record.year);
    if (exactYear.length > 0) {
      list = exactYear;
    } else if (exact.length > 0) {
      list = exact;
    }
  }

  // Once kaynak adiyla BIREBIR ayni olan aday varsa o secilir
  // ("The Intouchables" -> "The Intouchables", "The Untouchables" degil).
  const exactNameMatch = list.find(
    (candidate) =>
      candidate.normalizedName === normalizeName(record.rawTitle) ||
      record.altTitles.some(
        (alt) => normalizeName(alt) === candidate.normalizedName,
      ),
  );
  if (exactNameMatch && list.length > 1) {
    list = [
      exactNameMatch,
      ...list.filter((candidate) => candidate !== exactNameMatch),
    ];
  }

  let note = "";
  if (list.length > 1) {
    // Birden fazla aday var. Rastgele secim YAPILMAZ; her adayin populerlik
    // sinyali (TVmaze IMDb ortalamasi / Wikidata sitelink sayisi) olculur ve
    // en yuksek olan secilir. Karar raporda gerekcesiyle yazilir.
    const scored = await Promise.all(
      // TUM adaylar olculur (sinirlamak yanlis secime yol acardi).
      list.slice(0, 14).map(async (candidate) => ({
        candidate,
        popularity: await popularityOf(candidate),
      })),
    );
    scored.sort((a, b) => b.popularity - a.popularity);
    const winner = scored[0];
    const runnerUp = scored[1];
    if (
      runnerUp &&
      winner.popularity - runnerUp.popularity < 0.2 &&
      winner.popularity === runnerUp.popularity
    ) {
      return {
        resolution: null,
        ambiguous: true,
        note: `Birden fazla benzer aday (populerlik sinyali ayirt edemedi): ${scored
          .map((s) => `${s.candidate.label} (${s.candidate.year ?? "?"}, pop=${s.popularity.toFixed(1)})`)
          .join(" | ")}`,
      };
    }
    note = `Coklu aday; populerlik sinyaliyle secildi: ${winner.candidate.label} (${
      winner.candidate.year ?? "?"
    }, pop=${winner.popularity.toFixed(1)}; digerleri: ${scored
      .slice(1, 3)
      .map((s) => `${s.candidate.label} pop=${s.popularity.toFixed(1)}`)
      .join(", ")})`;
    list = [winner.candidate, ...scored.slice(1).map((s) => s.candidate)];
  }

  const best = list[0];

  // Yakin ama FARKLI yapimlar ("The Intouchables" -> "The Untouchables")
  // yanlis eslesme uretir. Burada sozel degisiklik tespit edilir ve kayit
  // inceleme raporuna birakilir.
  if (looksLikeDifferentTitle(record.rawTitle, best.label)) {
    return {
      resolution: null,
      ambiguous: true,
      note: `Yakin ama farkli aday: kaynak "${record.rawTitle}" -> "${best.label}"; elle dogrulanmali`,
    };
  }

  return {
    resolution: {
      type: "provider_title",
      provider: best.provider,
      providerId: best.providerId,
      label: best.label,
      year: best.year,
      score: best.score,
    },
    ambiguous: false,
    note,
  };
}

/**
 * Iki ad ayni yapimi mi, yoksa yakin ama farkli yapimlari mi gosterir?
 * "The Intouchables" / "The Untouchables" -> FARKLI (ilk anlamli kelimenin
 * bas harfi degisiyor ve toplam mesafe kucuk).
 * "Boy in the Striped Pyjamas" / "Pajamas" -> AYNI (yazim varyanti).
 */
function looksLikeDifferentTitle(source: string, candidate: string): boolean {
  const sourceWords = normalizeName(source).split(" ").filter(Boolean);
  const candidateWords = normalizeName(candidate).split(" ").filter(Boolean);
  if (sourceWords.length === 0 || candidateWords.length === 0) return false;

  // Kaynak adindaki alternatifleri de gozden gecir.
  const sourceVariants = [source, ...splitAltTitles(source)];

  for (const variant of sourceVariants) {
    const words = normalizeName(variant).split(" ").filter(Boolean);
    if (words.length === 0) continue;
    const candidateKey = normalizeName(candidate);
    if (candidateKey.includes(normalizeName(variant))) return false;

    // Ilk anlamli kelime (onek/banane gibi durak kelimeler haric).
    const meaningful = words.filter(
      (w) => !["the", "a", "an", "of", "and", "le", "la", "les", "el"].includes(w),
    );
    const candidateMeaningful = candidateWords.filter(
      (w) => !["the", "a", "an", "of", "and", "le", "la", "les", "el"].includes(w),
    );
    if (meaningful.length === 0 || candidateMeaningful.length === 0) continue;

    const distance = levenshtein(normalizeName(variant), candidateKey);
    if (distance > 2) continue;

    const sourceHead = meaningful[0];
    const candidateHead = candidateMeaningful[0];
    if (sourceHead[0] !== candidateHead[0]) {
      return true;
    }
  }
  return false;
}

/**
 * Populerlik sinyali (0..10 arasi, buyuk = daha popüler).
 *  - TVmaze: show rating (IMDb ortalamasi).
 *  - Wikidata: sitelink sayisi / 10 (cok dilli makale = daha popüler).
 */
async function popularityOf(candidate: {
  provider: "wikidata" | "tvmaze";
  providerId: string;
}): Promise<number> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      if (candidate.provider === "tvmaze") {
        const { data } = await providerFetchJson<{
          rating?: { average?: number | null };
        }>({
          provider: "tvmaze",
          url: `https://api.tvmaze.com/shows/${candidate.providerId}`,
          cacheTtlSeconds: 60 * 60 * 24 * 30,
          timeoutMs: 15_000,
        });
        return data.rating?.average ?? 0;
      }
      const { data } = await providerFetchJson<{
        entities?: Record<string, { sitelinks?: Record<string, unknown> }>;
      }>({
        provider: "wikidata",
        url: `https://www.wikidata.org/wiki/Special:EntityData/${candidate.providerId}.json`,
        cacheTtlSeconds: 60 * 60 * 24 * 30,
        timeoutMs: 20_000,
      });
      const entity = data.entities?.[candidate.providerId];
      const count = entity?.sitelinks ? Object.keys(entity.sitelinks).length : 0;
      return count / 10;
    } catch {
      if (attempt === 0) await sleep(2000);
    }
  }
  return 0;
}

/**
 * Arama icin kullanilacak ad varyantlari.
 * Hem ham ad hem de parantez ekleri temizlenmis hali AYRI ayri denenir
 * ("Shameless (US)" -> once ham, sonra "Shameless").
 */
function buildSearchTerms(record: MemoryRecord): Array<{ raw: string; clean: string }> {
  const names = [record.rawTitle, ...record.altTitles];
  const terms: Array<{ raw: string; clean: string }> = [];
  const push = (raw: string, clean: string) => {
    if (raw.length < 2) return;
    if (terms.some((t) => t.raw === raw)) return;
    terms.push({ raw, clean });
  };

  for (const name of names) {
    const clean = stripParenQualifiers(name);
    push(name, clean);
    // Parantez ekleri temizlenmis hali ("Shameless (US)" -> "Shameless").
    if (clean && clean !== normalizeName(name)) push(clean, clean);
    // Tamamen normalize edilmis hali ("Behzat Ç." -> "behzat c").
    const normalized = normalizeName(name);
    if (normalized && normalized !== clean && normalized !== normalizeName(name)) {
      push(normalized, normalized);
    }
  }
  return terms;
}

/**
 * "True Detective — Season 1" gibi kaynak adlarindan dizi adini ve sezon
 * numarasini ayristirir.
 */
function parseSeasonSuffix(rawTitle: string): {
  seriesName: string;
  seasonNumber: number | null;
} {
  const dash = rawTitle.match(/^(.*?)\s*[—–-]\s*Season\s*(\d+)\s*$/i);
  if (dash) {
    return { seriesName: dash[1].trim(), seasonNumber: Number(dash[2]) };
  }
  const paren = rawTitle.match(/^(.*?)\s*\(\s*Season\s*(\d+)\s*\)\s*$/i);
  if (paren) {
    return { seriesName: paren[1].trim(), seasonNumber: Number(paren[2]) };
  }
  return { seriesName: rawTitle, seasonNumber: null };
}

async function matchSeasonWithProvider(
  record: MemoryRecord,
): Promise<ResolutionResult> {
  const { seriesName, seasonNumber } = parseSeasonSuffix(record.rawTitle);
  if (seasonNumber === null) {
    return {
      resolution: null,
      ambiguous: false,
      note: "Sezon numarasi kaynak adindan ayristirilamadi.",
    };
  }

  let outcome;
  try {
    outcome = await searchWithRetry(seriesName, "series", record.year);
  } catch (error) {
    return {
      resolution: null,
      ambiguous: false,
      note: `Dizi arama hatasi: ${(error as Error).message}`,
    };
  }

  const candidates = outcome.results
    .filter((result) => result.kind === "series")
    .map((result) => ({
      provider: result.provider as "wikidata" | "tvmaze",
      providerId: result.providerId,
      label: result.originalTitle,
      score: similarity(seriesName, result.originalTitle),
    }))
    .filter((candidate) => candidate.score >= 0.9)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return {
      resolution: null,
      ambiguous: false,
      note: `Dizi bulunamadi: "${seriesName}"`,
    };
  }
  if (
    candidates.length > 1 &&
    Math.abs(candidates[0].score - candidates[1].score) < 0.02
  ) {
    return {
      resolution: null,
      ambiguous: true,
      note: `Birden fazla benzer dizi: ${candidates
        .slice(0, 3)
        .map((c) => c.label)
        .join(" | ")}`,
    };
  }

  const best = candidates[0];
  return {
    resolution: {
      type: "provider_series_season",
      provider: best.provider,
      providerId: best.providerId,
      seriesName,
      seasonNumber,
      label: `${best.label} ${seasonNumber}. sezon`,
    },
    ambiguous: false,
    note: "",
  };
}

/* -------------------------------------------------------------------------- */
/* Franchise cozumleme                                                         */
/* -------------------------------------------------------------------------- */

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

async function sparql(
  query: string,
  attempts = 4,
): Promise<Array<Record<string, { value: string }>>> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
      const { data } = await providerFetchJson<{
        results: { bindings: Record<string, Record<string, { value: string }>> };
      }>({
        provider: "wikidata",
        url,
        headers: { Accept: "application/sparql-results+json" },
        cacheTtlSeconds: 60 * 60 * 24,
        timeoutMs: 45_000,
      });
      const bindings = data.results?.bindings ?? {};
      return Object.values(bindings);
    } catch (error) {
      const message = (error as Error).message ?? "";
      if (!/429|hiz siniri|rate/i.test(message) || attempt === attempts - 1) {
        throw error;
      }
      await sleep(5000 * (attempt + 1));
    }
  }
  return [];
}

/**
 * Franchise cozumlemesi.
 *
 * Sirasiyla denenir:
 *  1) Adin kendisi bir "media franchise" (Q196600) mi?
 *  2) Adin kendisi bir "film series" (Q11424) mi?
 *  3) Ayni adi tasiyan bir filmin P179 (part of the series) zinciri franchise'a
 *     ulasiyor mu?
 *
 * Yalnizca adi kaynak adiyla birebir ayni olan franchise kabul edilir; boyle
 * ce "Wizarding World" gibi kaynak adina yabanci kayitlar elenir.
 */
async function resolveFranchise(
  record: MemoryRecord,
): Promise<ResolutionResult> {
  const names = [record.rawTitle, ...record.altTitles];
  const wanted = normalizeName(record.rawTitle);

  for (const name of names) {
    const query = name.trim();
    if (query.length < 2) continue;

    let rows: Array<Record<string, { value: string }>> = [];
    try {
      rows = await sparql(`
SELECT ?item ?itemLabel WHERE {
  SERVICE wikibase:mwapi {
    bd:serviceParam wikibase:api "EntitySearch";
                    wikibase:endpoint "www.wikidata.org";
                    mwapi:search "${query.replace(/"/g, '\\"')}";
                    mwapi:language "en".
    ?item wikibase:apiOutputItem mwapi:item.
  }
  OPTIONAL { ?item rdfs:label ?itemLabel FILTER(LANG(?itemLabel) = "en") }
}
LIMIT 40`);
    } catch (error) {
      return {
        resolution: null,
        ambiguous: false,
        note: `Franchise arama hatasi: ${(error as Error).message}`,
      };
    }

    const qids = rows
      .map((row) => row.item.value.split("/").pop() ?? row.item.value)
      .filter((qid): qid is string => Boolean(qid));
    if (qids.length === 0) continue;

    let details: Array<Record<string, { value: string }>> = [];
    try {
      details = await sparql(`
SELECT ?item ?type ?itemLabel ?p179 ?p179Type ?p179Label WHERE {
  VALUES ?item { ${qids.map((qid) => `wd:${qid}`).join(" ")} }
  ?item wdt:P31 ?type .
  OPTIONAL { ?item rdfs:label ?itemLabel FILTER(LANG(?itemLabel) = "en") }
  OPTIONAL {
    ?item wdt:P179 ?p179 .
    ?p179 wdt:P31 ?p179Type .
    OPTIONAL { ?p179 rdfs:label ?p179Label FILTER(LANG(?p179Label) = "en") }
  }
}
LIMIT 300`);
    } catch (error) {
      return {
        resolution: null,
        ambiguous: false,
        note: `Franchise ayrinti hatasi: ${(error as Error).message}`,
      };
    }

    // 1) Kendisi media franchise
    const direct = details.find(
      (row) =>
        row.type?.value.endsWith("Q196600") &&
        labelMatches(row.itemLabel?.value ?? "", wanted),
    );
    if (direct) {
      return {
        resolution: {
          type: "franchise",
          qid: direct.item.value.split("/").pop() ?? direct.item.value,
          label: direct.itemLabel?.value ?? query,
          sourceName: record.rawTitle,
        },
        ambiguous: false,
        note: "",
      };
    }

    // 2) Kendisi film series
    const filmSeries = details.find(
      (row) =>
        row.type?.value.endsWith("Q11424") &&
        labelMatches(row.itemLabel?.value ?? "", wanted),
    );
    if (filmSeries) {
      return {
        resolution: {
          type: "franchise",
          qid: filmSeries.item.value.split("/").pop() ?? filmSeries.item.value,
          label: filmSeries.itemLabel?.value ?? query,
          sourceName: record.rawTitle,
        },
        ambiguous: false,
        note: "",
      };
    }

    // 3) P179 zinciri: film -> film series / franchise.
    //    Once "media franchise" (Q196600) tercih edilir; yoksa diger
    //    franchise-benzeri tipler kabul edilir. Wikidata'da "The Lord of the
    //    Rings" franchise'inin tipi Q13593818 oldugu icin tip filtresi
    //    kullanilmaz; etiket eslesmesi belirleyicidir.
    const chainMatches = details.filter((row) =>
      labelMatches(row.p179Label?.value ?? "", wanted),
    );
    const viaChain =
      chainMatches.find((row) => row.p179Type?.value.endsWith("Q196600")) ??
      chainMatches[0];
    if (viaChain) {
      return {
        resolution: {
          type: "franchise",
          qid: viaChain.p179.value.split("/").pop() ?? viaChain.p179.value,
          label: viaChain.p179Label?.value ?? query,
          sourceName: record.rawTitle,
        },
        ambiguous: false,
        note: "",
      };
    }
  }

  return {
    resolution: null,
    ambiguous: false,
    note:
      "Franchise, Wikidata'da adi birebir ayni olan franchise/film-series kaydiyla eslesmedi; kaynak adiyla manuel kayit olusturulacak.",
  };
}


/**
 * Wikidata etiketi kaynak adiyla eslesiyor mu?
 * "The Hobbit film series" etiketi "The Hobbit" kaydiyla eslesir (sonek toleransi);
 * "Wizarding World" gibi farkli adlar ESLESMEZ.
 */
const FRANCHISE_SUFFIXES = new Set([
  "film series",
  "series",
  "franchise",
  "media franchise",
  "trilogy",
  "collection",
  "film collection",
  "movie series",
  "video game franchise",
]);

function labelMatches(label: string, wantedNormalized: string): boolean {
  const normalized = normalizeName(label);
  if (!normalized || !wantedNormalized) return false;
  if (normalized === wantedNormalized) return true;
  if (!normalized.startsWith(`${wantedNormalized} `)) return false;
  // Yalnizca "Harry Potter film series" gibi franchise son ekleri kabul edilir;
  // "Harry Potter and the Goblet of Fire" gibi tekil film adlari ELENIR.
  const rest = normalized.slice(wantedNormalized.length + 1);
  return FRANCHISE_SUFFIXES.has(rest);
}

/* -------------------------------------------------------------------------- */
/* Istatistikler ve rapor                                                       */
/* -------------------------------------------------------------------------- */

function buildStats(plan: PlanRow[]) {
  const matched = plan.filter((p) => p.resolution);
  const ambiguous = plan.filter((p) => !p.resolution && p.ambiguous);
  const unmatched = plan.filter((p) => !p.resolution && !p.ambiguous);
  const distribution = ratingDistribution(
    plan.map((p) => p.record).filter((r) => r.rating !== null),
  );
  return {
    total: plan.length,
    matched: matched.length,
    ambiguous: ambiguous.length,
    unmatched: unmatched.length,
    rated: plan.filter((p) => p.record.rating !== null).length,
    likes: plan.filter((p) => p.record.explicitLike).length,
    distribution: Object.fromEntries(
      [...distribution.entries()].sort((a, b) => b[0] - a[0]),
    ),
    average: averageRating(plan.map((p) => p.record)),
  };
}

function buildReport(input: {
  plan: PlanRow[];
  stats: ReturnType<typeof buildStats>;
  target: (typeof users.$inferSelect) | null;
  preferences: Record<string, unknown>;
  integrityRules: string[];
  existingEntryCount: number;
  providerCalls: number;
  dryRun: boolean;
  startedAt: Date;
}) {
  return {
    generatedAt: input.startedAt.toISOString(),
    mode: input.dryRun ? "dry-run" : "apply",
    sourceDir: SOURCE_DIR,
    targetUser: input.target
      ? {
          id: input.target.id,
          email: input.target.email,
          displayName: input.target.displayName,
          role: input.target.role,
        }
      : null,
    existingLibraryEntries: input.existingEntryCount,
    providerSearchCalls: input.providerCalls,
    stats: input.stats,
    preferences: buildPreferenceProfileJson(
      input.preferences,
      input.startedAt.toISOString(),
    ),
    integrityRules: input.integrityRules,
    rows: input.plan.map((row) => ({
      title: row.record.rawTitle,
      altTitles: row.record.altTitles,
      year: row.record.year,
      kind: row.record.kind,
      targetKind: row.targetKind,
      rating: row.record.rating,
      scope: row.record.scope,
      scopeLabel: row.scopeLabel,
      status: row.record.status,
      statusLabel: row.statusLabel,
      watchStatus: row.watchStatus,
      explicitLike: row.record.explicitLike,
      resolution: row.resolution,
      ambiguous: row.ambiguous,
      note: row.note,
      sources: row.record.seenIn,
    })),
  };
}

function printReport(
  report: ReturnType<typeof buildReport>,
  plan: PlanRow[],
) {
  const s = report.stats;
  log("\n" + "=".repeat(78));
  log("ON IZLEME RAPORU (DRY-RUN)" + (APPLY ? " / UYGULAMA SONUCU" : ""));
  log("=".repeat(78));
  log(
    `Hedef kullanici      : ${report.targetUser?.displayName} (${report.targetUser?.id})`,
  );
  log(`Toplam kayit         : ${s.total}`);
  log(`  eslesen            : ${s.matched}`);
  log(`  belirsiz (bekliyor): ${s.ambiguous}`);
  log(`  eslesmeyen         : ${s.unmatched}`);
  log(`Puanli kayit         : ${s.rated}`);
  log(`Acikca sevilen       : ${s.likes}`);
  log(`Mevcut kutuphane kaydi: ${report.existingLibraryEntries}`);
  log(`Provider arama cagrisi: ${report.providerSearchCalls}`);

  log(`\nPuan dagilimi (kaynak ile karsilastirma icin):`);
  const expected: Record<string, number> = {
    "10": 4,
    "9.5": 5,
    "9": 15,
    "8.5": 17,
    "8": 17,
    "7.5": 1,
    "7": 3,
  };
  for (const [rating, count] of Object.entries(s.distribution)) {
    const want = expected[rating] ?? 0;
    const mark = want === count ? "OK " : "!  ";
    log(
      `   ${mark} ${rating.padStart(4)} : ${String(count).padStart(3)} (beklenen ${want})`,
    );
  }
  const expectedTotal = Object.values(expected).reduce((a, b) => a + b, 0);
  log(`   Toplam puanli: ${s.rated} (beklenen ${expectedTotal})`);
  log(
    `   Ortalama: ${s.average !== null ? s.average.toFixed(2) : "-"} (beklenen ~8.57)`,
  );

  const ambiguous = plan.filter((p) => !p.resolution && p.ambiguous);
  if (ambiguous.length > 0) {
    log(`\nBelirsiz eslesmeler (${ambiguous.length}):`);
    for (const row of ambiguous) {
      log(
        `   - "${row.record.rawTitle}" (${row.record.year ?? "?"}) :: ${row.note}`,
      );
    }
  }
  const unmatched = plan.filter((p) => !p.resolution && !p.ambiguous);
  if (unmatched.length > 0) {
    log(`\nEslesmeyen kayitlar (${unmatched.length}):`);
    for (const row of unmatched) {
      log(
        `   - "${row.record.rawTitle}" (${row.record.year ?? "?"}) :: ${row.note}`,
      );
    }
  }
  const franchiseRows = plan.filter((p) => p.targetKind === "franchise");
  log(`\nFranchise kapsamli kayit: ${franchiseRows.length}`);
  for (const row of franchiseRows) {
    const r = row.resolution;
    log(
      `   - ${row.record.rawTitle} puan=${row.record.rating} -> ${r ? r.type : "MANUEL KAYIT"}`,
    );
  }
  const seasonRows = plan.filter((p) => p.targetKind === "season");
  log(`\nSezon kapsamli kayit: ${seasonRows.length}`);
  for (const row of seasonRows) {
    log(
      `   - ${row.record.rawTitle} puan=${row.record.rating} -> ${row.resolution?.type ?? "-"}`,
    );
  }
  log("=".repeat(78));
}

/* -------------------------------------------------------------------------- */
/* Uygulama                                                                    */
/* -------------------------------------------------------------------------- */

async function applyPlan(
  plan: PlanRow[],
  userId: string,
  preferences: Record<string, unknown>,
) {
  const db = getDb();
  const now = nowIso();
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let imported = 0;
  const conflicts: string[] = [];
  const failures: string[] = [];

  const existing = await db
    .select()
    .from(libraryEntries)
    .where(eq(libraryEntries.userId, userId));
  const existingByTitle = new Map(existing.map((e) => [e.titleId, e]));

  for (const row of plan) {
    const record = row.record;
    let titleId: string | null = null;

    if (row.resolution) {
      const resolution = await materialise(row.resolution);
      if (resolution.ok) {
        titleId = resolution.titleId;
        if (resolution.imported) imported += 1;
      } else {
        failures.push(`"${record.rawTitle}": ${resolution.error}`);
        skipped += 1;
        continue;
      }
    } else {
      skipped += 1;
      continue;
    }

    const likedAspects = extractLikedAspects(record.notes);
    const notes = record.notes.length > 0 ? record.notes : null;

    const current = existingByTitle.get(titleId);
    if (current) {
      if (
        current.rating !== null &&
        record.rating !== null &&
        current.rating !== record.rating
      ) {
        conflicts.push(
          `"${record.rawTitle}" puan cakismasi: mevcut=${current.rating} kaynak=${record.rating} — mevcut korundu`,
        );
      }
      if (current.rating === null && record.rating !== null) {
        await db
          .update(libraryEntries)
          .set({ rating: record.rating, updatedAt: now })
          .where(eq(libraryEntries.id, current.id));
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    await db.insert(libraryEntries).values({
      id: newId("lib"),
      userId,
      titleId,
      status: row.watchStatus as never,
      rating: record.rating,
      notes,
      likedAspects,
      isFavorite: record.explicitLike,
      createdAt: now,
      updatedAt: now,
    });
    existingByTitle.set(titleId, {
      id: "",
      userId,
      titleId,
      status: row.watchStatus as never,
      rating: record.rating,
      notes,
      likedAspects,
      isFavorite: record.explicitLike,
      createdAt: now,
      updatedAt: now,
    } as never);
    added += 1;
  }

  log(`   Katalog import edilen: ${imported}`);
  log(`   Kutuphane: eklendi=${added} guncellendi=${updated} atlandi=${skipped}`);
  if (conflicts.length > 0) {
    log(`   Puan cakismalari (mevcut deger korundu): ${conflicts.length}`);
    for (const c of conflicts) log(`      - ${c}`);
  }
  if (failures.length > 0) {
    log(`   Basarisiz kayitlar: ${failures.length}`);
    for (const f of failures.slice(0, 30)) log(`      - ${f}`);
  }

  // Tercih profili
  const profileJson = buildPreferenceProfileJson(preferences, now);
  await db
    .insert(preferenceProfiles)
    .values({
      userId,
      profileJson: JSON.stringify(profileJson),
      confidence: 0,
      ratedTitleCount: plan.filter((p) => p.record.rating !== null).length,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: preferenceProfiles.userId,
      set: {
        profileJson: JSON.stringify(profileJson),
        ratedTitleCount: plan.filter((p) => p.record.rating !== null).length,
        updatedAt: now,
      },
    });
  log(`   Tercih profili yazildi (${Object.keys(profileJson).length} alan).`);

  return { added, updated, skipped, imported, conflicts, failures };
}

/**
 * Provider'dan yapim kaydini ice aktarir.
 *
 * Wikidata/TVmaze hiz siniri (429) sikliginda istekler arasi beklenip
 * yeniden denenir; aksi halde aktarim yarida kalir.
 */
async function importWithRetry(
  provider: "wikidata" | "tvmaze",
  providerId: string,
  attempts = 4,
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const imported = await importTitle({ provider, providerId, language: "tr" });
      // Istekler arasi kisa gecikme (hiz sinirini azaltir).
      await sleep(500);
      return imported;
    } catch (error) {
      const message = (error as Error).message ?? "";
      if (!/429|hiz siniri|rate/i.test(message)) {
        return null;
      }
      await sleep(5000 * (attempt + 1));
    }
  }
  return null;
}

/** Cozumleme sonucunu gercek bir titleId'ye cevirir (gerekirse import eder). */
async function materialise(
  resolution: Resolution,
): Promise<{ ok: true; titleId: string; imported: boolean } | { ok: false; error: string }> {
  const db = getDb();

  if (resolution.type === "title") {
    return { ok: true, titleId: resolution.titleId, imported: false };
  }

  if (resolution.type === "provider_title") {
    const imported = await importWithRetry(
      resolution.provider,
      resolution.providerId,
    );
    if (!imported) {
      return {
        ok: false,
        error: "import hatasi: provider hiz siniri (429) — tekrar denendi, basarisiz",
      };
    }
    return { ok: true, titleId: imported.titleId, imported: imported.created };
  }

  if (resolution.type === "provider_series_season") {
    try {
      const imported = await importWithRetry(
        resolution.provider,
        resolution.providerId,
      );
      if (!imported) {
        return { ok: false, error: "dizi import hatasi: provider hiz siniri (429)" };
      }
      const seasonRows = await db
        .select()
        .from(titles)
        .where(
          and(
            eq(titles.parentId, imported.titleId),
            eq(titles.seasonNumber, resolution.seasonNumber),
            eq(titles.kind, "season"),
          ),
        )
        .limit(1);
      const season = seasonRows[0];
      if (!season) {
        return {
          ok: false,
          error: `sezon bulunamadi: ${resolution.seriesName} ${resolution.seasonNumber}`,
        };
      }
      return { ok: true, titleId: season.id, imported: imported.created };
    } catch (error) {
      return { ok: false, error: `dizi import hatasi: ${(error as Error).message}` };
    }
  }

  // franchise
  try {
    const now = nowIso();
    const existingTitle = await db
      .select({ id: titles.id })
      .from(titles)
      .where(
        and(
          eq(titles.kind, "franchise"),
          eq(titles.wikidataId, resolution.qid),
        ),
      )
      .limit(1);
    if (existingTitle[0]) {
      return { ok: true, titleId: existingTitle[0].id, imported: false };
    }

    const titleId = newId("ttl");
    await db.insert(titles).values({
      id: titleId,
      kind: "franchise",
      wikidataId: resolution.qid,
      // Kayit, kaynak dosyadaki ozgun adi tasir ("Harry Potter").
      // Wikidata etiketi ("Harry Potter film series") alias olarak eklenir.
      originalTitle: resolution.sourceName,
      localizedTitle: null,
      metadataProvider: "wikidata",
      metadataUpdatedAt: now,
      metadataVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    const existingFranchise = await db
      .select({ id: franchises.id })
      .from(franchises)
      .where(eq(franchises.wikidataId, resolution.qid))
      .limit(1);
    if (!existingFranchise[0]) {
      await db.insert(franchises).values({
        id: newId("frn"),
        name: resolution.sourceName,
        wikidataId: resolution.qid,
        createdAt: now,
      });
    }

    if (resolution.label !== resolution.sourceName) {
      await db
        .insert(titleAliases)
        .values({
          id: newId("als"),
          titleId,
          name: resolution.label,
          language: "en",
          provider: "import",
        })
        .onConflictDoNothing();
    }

    return { ok: true, titleId, imported: true };
  } catch (error) {
    return { ok: false, error: `franchise hatasi: ${(error as Error).message}` };
  }
}

function extractLikedAspects(notes: string): string | null {
  const marker = "Sevilen yönler:";
  const index = notes.indexOf(marker);
  if (index === -1) return null;
  const rest = notes.slice(index + marker.length).trim();
  const stop = rest.indexOf(". Puanın neden");
  const aspects = (stop === -1 ? rest : rest.slice(0, stop)).trim();
  return aspects.length > 0 ? aspects : null;
}

/**
 * YANLIS KAPSAM DUZELTMESI.
 *
 * Ilk aktarimda bazi franchise kayitlari, P179 zinciri yanlis cozumlendigi icin
 * TEKIL FILM adlariyla (ornegin "Harry Potter and the Goblet of Fire") franchise
 * turuyle acilmis olabilir. Bu duzeltme:
 *   1) Hatali franchise kayitlarini dogru franchise kayitlariyla degistirir.
 *   2) Kullanici puanini/durumunu/favori isaretini AYNEN tasir.
 *   3) Eski (hatali) kaydi siler.
 *
 * Kaynak dosya DEGISTIRILMEZ; yalnizca veritabanindaki hatali kayit duzeltilir.
 */
async function repairFranchiseScope(
  userId: string,
  sourceFranchiseNames: string[],
): Promise<{ repaired: number; renamed: number }> {
  const db = getDb();
  const now = nowIso();
  let repaired = 0;
  let renamed = 0;

  const entries = await db
    .select({
      entry: libraryEntries,
      title: titles,
    })
    .from(libraryEntries)
    .innerJoin(titles, eq(titles.id, libraryEntries.titleId))
    .where(eq(libraryEntries.userId, userId));

  // Kaynak franchise adlarinin normalize karsiliklari.
  const sourceNames = sourceFranchiseNames.map((name) => ({
    raw: name,
    normalized: normalizeName(name),
  }));

  for (const { entry, title } of entries) {
    // a) QID ya da Latin alfabesi disi adli kayitlar (etiket alinamamisti)
    //    -> yeniden import ile dogru adla duzeltilir.
    const looksBroken =
      /^Q\d+$/.test(title.originalTitle) ||
      /[^\u0000-\u007F]/.test(title.originalTitle);
    if (looksBroken) {
      const refreshed = await importWithRetry("wikidata", title.wikidataId ?? "", 2);
      if (refreshed) {
        renamed += 1;
        log(
          `   Yeniden adlandirildi: "${title.originalTitle}" -> "${refreshed.details.originalTitle}"`,
        );
      }
      continue;
    }

    if (title.kind !== "franchise") continue;

    // b) Kaynak adiyla eslesen franchise mi?
    const titleKey = normalizeName(title.originalTitle);
    const source = sourceNames.find((item) => item.normalized === titleKey);
    if (source) continue; // zaten dogru

    // c) Yanlis franchise: dogru franchise'i cozumle ve degistir.
    // Hatali kaydin adi, kaynak franchise adinin onek olabilir
    // ("Harry Potter and the Goblet of Fire" -> "Harry Potter").
    const candidates = sourceNames
      .filter((item) => titleKey.startsWith(item.normalized + " "))
      .map((item) => item.raw);
    if (candidates.length === 0) {
      log(
        `   [ONARILAMADI] "${title.originalTitle}" icin kaynak franchise adi bulunamadi; kayit yerinde birakildi.`,
      );
      continue;
    }

    let resolution: Resolution | null = null;
    let lastNote = "";
    for (const candidate of candidates) {
      const found = await resolveFranchise({
        key: "repair",
        rawTitle: candidate,
        altTitles: [],
        year: null,
        kind: "film_franchise",
        rating: entry.rating,
        scope: "overall_franchise",
        status: "watched",
        notes: "",
        explicitLike: false,
        seenIn: ["repair"],
      });
      lastNote = found.note;
      if (found.resolution && found.resolution.type === "franchise") {
        resolution = found.resolution;
        break;
      }
    }

    if (!resolution) {
      log(
        `   [ONARILAMADI] "${title.originalTitle}" icin dogru franchise bulunamadi; kayit yerinde birakildi.`,
      );
      if (lastNote) log(`      sebep: ${lastNote}`);
      continue;
    }

    const materialised = await materialise(resolution);
    if (!materialised.ok) {
      log(`   [ONARILAMADI] "${title.originalTitle}": ${materialised.error}`);
      continue;
    }

    // Eski kayittan yeni kayita: puan/durum/favori/notlar AYNEN tasinir.
    await db
      .update(libraryEntries)
      .set({ titleId: materialised.titleId, updatedAt: now })
      .where(eq(libraryEntries.id, entry.id));

    // Eski (hatali) title artik kullanilmiyor; silinir.
    const remaining = await db
      .select({ id: libraryEntries.id })
      .from(libraryEntries)
      .where(eq(libraryEntries.titleId, title.id))
      .limit(1);
    if (remaining.length === 0) {
      await db.delete(titleAliases).where(eq(titleAliases.titleId, title.id));
      await db.delete(titles).where(eq(titles.id, title.id));
    }

    repaired += 1;
    log(
      `   Duzeltildi: "${title.originalTitle}" -> "${resolution.sourceName}" (puan=${entry.rating ?? "null"})`,
    );
  }

  return { repaired, renamed };
}

/* -------------------------------------------------------------------------- */
/* Dogrulama                                                                   */
/* -------------------------------------------------------------------------- */

async function verify(
  userId: string,
  applyResult: {
    added: number;
    updated: number;
    skipped: number;
    imported: number;
    conflicts: string[];
    failures: string[];
  },
) {
  const db = getDb();
  const entries = await db
    .select()
    .from(libraryEntries)
    .where(eq(libraryEntries.userId, userId));

  const distribution = new Map<number, number>();
  for (const entry of entries) {
    if (entry.rating === null) continue;
    distribution.set(entry.rating, (distribution.get(entry.rating) ?? 0) + 1);
  }

  log("\n" + "=".repeat(78));
  log("DOGRULAMA (veritabanindan gercek okuma)");
  log("=".repeat(78));
  log(`Eklendi=${applyResult.added} Guncellendi=${applyResult.updated} Atlandi=${applyResult.skipped} Import=${applyResult.imported}`);
  log(`Hedef kullanici kutuphane kaydi: ${entries.length}`);
  log(`Puanli kayit: ${entries.filter((e) => e.rating !== null).length}`);
  log(`Favori isaretli: ${entries.filter((e) => e.isFavorite).length}`);
  log(`Durum dagilimi:`);
  const byStatus = new Map<string, number>();
  for (const entry of entries) {
    byStatus.set(entry.status, (byStatus.get(entry.status) ?? 0) + 1);
  }
  for (const [status, count] of byStatus) {
    log(`   ${status.padEnd(14)}: ${count}`);
  }
  log(`Puan dagilimi:`);
  for (const [rating, count] of [...distribution.entries()].sort(
    (a, b) => b[0] - a[0],
  )) {
    log(`   ${rating}: ${count}`);
  }
  const rated = entries.filter((e) => e.rating !== null);
  const avg =
    rated.length > 0
      ? rated.reduce((s, e) => s + (e.rating as number), 0) / rated.length
      : null;
  log(`Ortalama: ${avg !== null ? avg.toFixed(2) : "-"}`);

  const titleCounts = new Map<string, number>();
  for (const entry of entries) {
    titleCounts.set(entry.titleId, (titleCounts.get(entry.titleId) ?? 0) + 1);
  }
  const duplicates = [...titleCounts.entries()].filter(([, c]) => c > 1);
  log(`Mukerrer title kaydi: ${duplicates.length}`);

  const ownerCounts = await db
    .select({ userId: libraryEntries.userId, count: sql<number>`count(*)` })
    .from(libraryEntries)
    .groupBy(libraryEntries.userId);
  const otherTotal = ownerCounts
    .filter((row) => row.userId !== userId)
    .reduce((sum, row) => sum + Number(row.count), 0);
  log(`Baska kullanicilarin kayitlari: ${otherTotal} (degistirilmedi)`);

  const profile = await db
    .select()
    .from(preferenceProfiles)
    .where(eq(preferenceProfiles.userId, userId))
    .limit(1);
  log(
    `Tercih profili: ${profile[0] ? `${profile[0].ratedTitleCount} puanli kayit` : "YOK"}`,
  );
  log("=".repeat(78));
}

/* -------------------------------------------------------------------------- */

main().then(
  () => process.exit(0),
  (error) => {
    console.error("\n[HATA]", error);
    process.exit(1);
  },
);
