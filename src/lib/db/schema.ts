import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/* -------------------------------------------------------------------------- */
/* Kimlik ve kullanicilar                                                     */
/* -------------------------------------------------------------------------- */

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["user", "moderator", "admin"] })
      .notNull()
      .default("user"),
    /** Oturumlari topluca gecersiz kilmak icin artirilir. */
    sessionVersion: integer("session_version").notNull().default(1),
    /** Kutuphane varsayilan olarak gizlidir. */
    libraryVisibility: text("library_visibility", {
      enum: ["private", "followers", "public"],
    })
      .notNull()
      .default("private"),
    reviewsVisibility: text("reviews_visibility", {
      enum: ["private", "followers", "public"],
    })
      .notNull()
      .default("public"),
    bio: text("bio"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("users_email_unique").on(sql`lower(${t.email})`)],
);

/* -------------------------------------------------------------------------- */
/* Katalog                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * kind: movie | series | season | episode | franchise
 * Franchise kayitlari tek tek filmlerin yerine kullanilmaz; yalnizca gruplama.
 */
export const titles = sqliteTable(
  "titles",
  {
    id: text("id").primaryKey(),
    kind: text("kind", {
      enum: ["movie", "series", "season", "episode", "franchise"],
    }).notNull(),

    // Harici kimlikler (mukerrer kayit kontrolunun temeli)
    tmdbId: text("tmdb_id"),
    tvmazeId: text("tvmaze_id"),
    imdbId: text("imdb_id"),
    wikidataId: text("wikidata_id"),

    originalTitle: text("original_title").notNull(),
    /** Turkce/yerel baslik; yoksa null. */
    localizedTitle: text("localized_title"),
    originalLanguage: text("original_language"),
    overview: text("overview"),

    releaseDate: text("release_date"),
    releaseYear: integer("release_year"),
    endDate: text("end_date"),
    runtimeMinutes: integer("runtime_minutes"),

    posterUrl: text("poster_url"),
    backdropUrl: text("backdrop_url"),
    /** Resmi/uizerine cikmis fragman linki (kaynaklia; mevcutsa gosterilir). */
    trailerUrl: text("trailer_url"),
    homepageUrl: text("homepage_url"),

    // Hiyerarsi: sezon -> dizi, bolum -> sezon
    parentId: text("parent_id"),
    seasonNumber: integer("season_number"),
    episodeNumber: integer("episode_number"),

    /** Harici platform puanlari AYRI tutulur; kullanici puanlariyla karistirilmaz. */
    externalRating: real("external_rating"),
    externalRatingCount: integer("external_rating_count"),
    externalRatingSource: text("external_rating_source"),

    /** Verinin geldigi saglayici ve son dogrulama zamani. */
    metadataProvider: text("metadata_provider"),
    metadataUpdatedAt: text("metadata_updated_at"),
    /** Wikidata/Wikipedia gibi kaynaklarda kanit var mi? (0/1) */
    metadataVerified: integer("metadata_verified", { mode: "boolean" })
      .notNull()
      .default(false),

    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("titles_tmdb_unique").on(t.tmdbId),
    uniqueIndex("titles_tvmaze_unique").on(t.tvmazeId),
    uniqueIndex("titles_imdb_unique").on(t.imdbId),
    uniqueIndex("titles_wikidata_unique").on(t.wikidataId),
    index("titles_kind_idx").on(t.kind),
    index("titles_parent_idx").on(t.parentId),
    index("titles_original_title_idx").on(sql`lower(${t.originalTitle})`),
    index("titles_release_year_idx").on(t.releaseYear),
  ],
);

/** Alternatif / yerel basliklar; arama ve mukerrer kontrolu icin. */
export const titleAliases = sqliteTable(
  "title_aliases",
  {
    id: text("id").primaryKey(),
    titleId: text("title_id").notNull(),
    name: text("name").notNull(),
    language: text("language"),
    provider: text("provider"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("title_aliases_unique").on(t.titleId, sql`lower(${t.name})`),
    index("title_aliases_name_idx").on(sql`lower(${t.name})`),
  ],
);

export const genres = sqliteTable(
  "genres",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    nameTr: text("name_tr").notNull(),
    nameEn: text("name_en").notNull(),
  },
  (t) => [uniqueIndex("genres_slug_unique").on(t.slug)],
);

export const titleGenres = sqliteTable(
  "title_genres",
  {
    titleId: text("title_id").notNull(),
    genreId: text("genre_id").notNull(),
    provider: text("provider"),
  },
  (t) => [
    primaryKey({ columns: [t.titleId, t.genreId] }),
    index("title_genres_genre_idx").on(t.genreId),
  ],
);

export const people = sqliteTable(
  "people",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    tmdbId: text("tmdb_id"),
    tvmazeId: text("tvmaze_id"),
    wikidataId: text("wikidata_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("people_wikidata_unique").on(t.wikidataId),
    uniqueIndex("people_tmdb_unique").on(t.tmdbId),
    index("people_name_idx").on(sql`lower(${t.name})`),
  ],
);

export const credits = sqliteTable(
  "credits",
  {
    id: text("id").primaryKey(),
    titleId: text("title_id").notNull(),
    personId: text("person_id").notNull(),
    /** director | writer | actor | creator | composer */
    role: text("role", {
      enum: ["director", "writer", "actor", "creator", "composer"],
    }).notNull(),
    /** Bos string: karakter adi yok. (SQLite UNIQUE'te NULL'lar cakismaz.) */
    characterName: text("character_name").notNull().default(""),
    billingOrder: integer("billing_order"),
    provider: text("provider"),
  },
  (t) => [
    uniqueIndex("credits_unique").on(
      t.titleId,
      t.personId,
      t.role,
      t.characterName,
    ),
    index("credits_person_idx").on(t.personId),
    index("credits_title_idx").on(t.titleId),
  ],
);

export const franchises = sqliteTable("franchises", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  wikidataId: text("wikidata_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const franchiseTitles = sqliteTable(
  "franchise_titles",
  {
    franchiseId: text("franchise_id").notNull(),
    titleId: text("title_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.franchiseId, t.titleId] })],
);

/**
 * Yapim boyutlari (senaryo, atmosfer, tempo ...).
 * Bu degerler yalnizca ACIK kaynak/etiket varsa doldurulur; tahmin edilmez.
 * `source`: user | editorial | provider
 */
export const titleTraits = sqliteTable(
  "title_traits",
  {
    id: text("id").primaryKey(),
    titleId: text("title_id").notNull(),
    dimension: text("dimension").notNull(),
    score: real("score").notNull(),
    source: text("source", { enum: ["user", "editorial", "provider"] })
      .notNull()
      .default("user"),
    /** Bos string: kullaniciya ozel olmayan kayit. */
    userId: text("user_id").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("title_traits_unique").on(
      t.titleId,
      t.dimension,
      t.source,
      t.userId,
    ),
    index("title_traits_title_idx").on(t.titleId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Kisisel sinema hafizasi                                                    */
/* -------------------------------------------------------------------------- */

export const WATCH_STATUSES = [
  "watched",
  "not_watched",
  "watching",
  "dropped",
  "watchlist",
  "unsure",
] as const;

export type WatchStatus = (typeof WATCH_STATUSES)[number];

export const libraryEntries = sqliteTable(
  "library_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    titleId: text("title_id").notNull(),

    status: text("status", { enum: WATCH_STATUSES })
      .notNull()
      .default("not_watched"),

    /** Kullanici puani 1..10. Verilmediyse null (puan uretilmez). */
    rating: real("rating"),
    /** Izleme tarihi veya yaklasik donem. */
    watchedAt: text("watched_at"),
    watchedPeriod: text("watched_period"),

    notes: text("notes"),
    likedAspects: text("liked_aspects"),
    dislikedAspects: text("disliked_aspects"),
    memorableScenes: text("memorable_scenes"),
    rewatchIntent: text("rewatch_intent", {
      enum: ["yes", "maybe", "no"],
    }),

    /** Dizi spoiler kapsami: kullanicinin izledigi son sezon/bolum. */
    progressSeason: integer("progress_season"),
    progressEpisode: integer("progress_episode"),

    isFavorite: integer("is_favorite", { mode: "boolean" })
      .notNull()
      .default(false),

    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("library_entries_user_title_unique").on(t.userId, t.titleId),
    index("library_entries_user_status_idx").on(t.userId, t.status),
    index("library_entries_title_idx").on(t.titleId),
  ],
);

/** Kullanicinin yapim bazinda boyut degerlendirmesi (acik tercih). */
export const userTitleDimensions = sqliteTable(
  "user_title_dimensions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    titleId: text("title_id").notNull(),
    dimension: text("dimension").notNull(),
    score: real("score").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("user_title_dimensions_unique").on(
      t.userId,
      t.titleId,
      t.dimension,
    ),
    index("user_title_dimensions_user_idx").on(t.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Topluluk                                                                   */
/* -------------------------------------------------------------------------- */

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    titleId: text("title_id").notNull(),
    body: text("body").notNull(),
    rating: real("rating"),
    containsSpoiler: integer("contains_spoiler", { mode: "boolean" })
      .notNull()
      .default(false),
    spoilerScopeSeason: integer("spoiler_scope_season"),
    visibility: text("visibility", {
      enum: ["private", "followers", "public"],
    })
      .notNull()
      .default("public"),
    moderationStatus: text("moderation_status", {
      enum: ["visible", "hidden", "removed"],
    })
      .notNull()
      .default("visible"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("reviews_title_idx").on(t.titleId),
    index("reviews_user_idx").on(t.userId),
  ],
);

/** Yorum yanitlari (tek seviye derinlik). */
/** Harici kaynaklardan (internet) derlenen yorumlar. Kullanici incelemelerinden AYRI ve kaynaklia tutulur. */
export const externalComments = sqliteTable(
  "external_comments",
  {
    id: text("id").primaryKey(),
    titleId: text("title_id").notNull(),
    /** Kaynak site: "wikipedia-tr", "wikipedia-en", ... */
    source: text("source").notNull(),
    /** Makale/blog linki (attribution). */
    sourceUrl: text("source_url"),
    /** Sozu eden kritik/kurum; sitelerde mevcutsa. */
    author: text("author"),
    /** Kesin sayfa bolgesi (orn. "Critical reception"). */
    section: text("section"),
    /** "tr" | "en" | ... — yerli/yabanci ayriminin belasi. */
    language: text("language", { enum: ["tr", "en", "other"] })
      .notNull()
      .default("en"),
    body: text("body").notNull(),
    /** Ayni makaleden ayni metnin tekrar eklenmesini onleyen ozet. */
    contentHash: text("content_hash").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("external_comments_title_idx").on(t.titleId),
    index("external_comments_lang_idx").on(t.language),
  ],
);

export const reviewReplies = sqliteTable(
  "review_replies",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id").notNull(),
    userId: text("user_id").notNull(),
    body: text("body").notNull(),
    containsSpoiler: integer("contains_spoiler", { mode: "boolean" })
      .notNull()
      .default(false),
    moderationStatus: text("moderation_status", {
      enum: ["visible", "hidden", "removed"],
    })
      .notNull()
      .default("visible"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("review_replies_review_idx").on(t.reviewId)],
);

export const likes = sqliteTable(
  "likes",
  {
    userId: text("user_id").notNull(),
    targetType: text("target_type", { enum: ["review", "reply", "list"] })
      .notNull(),
    targetId: text("target_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] })],
);

export const discussionThreads = sqliteTable(
  "discussion_threads",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    titleId: text("title_id"),
    heading: text("heading").notNull(),
    body: text("body").notNull(),
    containsSpoiler: integer("contains_spoiler", { mode: "boolean" })
      .notNull()
      .default(false),
    visibility: text("visibility", {
      enum: ["private", "followers", "public"],
    })
      .notNull()
      .default("public"),
    moderationStatus: text("moderation_status", {
      enum: ["visible", "hidden", "removed"],
    })
      .notNull()
      .default("visible"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("threads_title_idx").on(t.titleId)],
);

export const discussionPosts = sqliteTable(
  "discussion_posts",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull(),
    userId: text("user_id").notNull(),
    body: text("body").notNull(),
    containsSpoiler: integer("contains_spoiler", { mode: "boolean" })
      .notNull()
      .default(false),
    moderationStatus: text("moderation_status", {
      enum: ["visible", "hidden", "removed"],
    })
      .notNull()
      .default("visible"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("discussion_posts_thread_idx").on(t.threadId)],
);

export const follows = sqliteTable(
  "follows",
  {
    followerId: text("follower_id").notNull(),
    followingId: text("following_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index("follows_following_idx").on(t.followingId),
  ],
);

export const blocks = sqliteTable(
  "blocks",
  {
    userId: text("user_id").notNull(),
    blockedUserId: text("blocked_user_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.blockedUserId] })],
);

export const mutes = sqliteTable(
  "mutes",
  {
    userId: text("user_id").notNull(),
    mutedUserId: text("muted_user_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.mutedUserId] })],
);

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id").notNull(),
  targetType: text("target_type", {
    enum: ["review", "reply", "thread", "post", "user"],
  }).notNull(),
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status", { enum: ["open", "resolved", "dismissed"] })
    .notNull()
    .default("open"),
  resolvedAt: text("resolved_at"),
  resolvedBy: text("resolved_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const userLists = sqliteTable("user_lists", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  visibility: text("visibility", {
    enum: ["private", "followers", "public"],
  })
    .notNull()
    .default("private"),
  moderationStatus: text("moderation_status", {
    enum: ["visible", "hidden", "removed"],
  })
    .notNull()
    .default("visible"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const userListItems = sqliteTable(
  "user_list_items",
  {
    listId: text("list_id").notNull(),
    titleId: text("title_id").notNull(),
    position: integer("position").notNull().default(0),
    note: text("note"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [primaryKey({ columns: [t.listId, t.titleId] })],
);

/* -------------------------------------------------------------------------- */
/* Veri saglayicilari, onbellek ve arastirma                                  */
/* -------------------------------------------------------------------------- */

export const dataProviders = sqliteTable(
  "data_providers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category", {
      enum: ["metadata", "ratings", "reviews", "ai", "images"],
    }).notNull(),
    requiresKey: integer("requires_key", { mode: "boolean" })
      .notNull()
      .default(false),
    licenseNote: text("license_note"),
    attribution: text("attribution"),
    lastSuccessAt: text("last_success_at"),
    lastErrorAt: text("last_error_at"),
    lastError: text("last_error"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [uniqueIndex("data_providers_name_unique").on(t.name)],
);

/** Dis isteklerin onbellegi: gereksiz tekrar indirmeyi onler. */
export const providerCache = sqliteTable(
  "provider_cache",
  {
    cacheKey: text("cache_key").primaryKey(),
    provider: text("provider").notNull(),
    payload: text("payload").notNull(),
    fetchedAt: text("fetched_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [index("provider_cache_expiry_idx").on(t.expiresAt)],
);

export const providerRequests = sqliteTable(
  "provider_requests",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    endpoint: text("endpoint").notNull(),
    status: text("status", { enum: ["ok", "error", "cache_hit", "rate_limited"] })
      .notNull(),
    httpStatus: integer("http_status"),
    durationMs: integer("duration_ms"),
    error: text("error"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("provider_requests_provider_idx").on(t.provider)],
);

export const researchSessions = sqliteTable("research_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  titleId: text("title_id").notNull(),
  question: text("question"),
  status: text("status", {
    enum: ["running", "completed", "partial", "failed"],
  })
    .notNull()
    .default("running"),
  summary: text("summary"),
  /** AI sentezi mi, yalnizca kaynak listesi mi? */
  summaryGeneratedByAi: integer("summary_generated_by_ai", {
    mode: "boolean",
  })
    .notNull()
    .default(false),
  sourceCount: integer("source_count").notNull().default(0),
  error: text("error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
});

export const researchItems = sqliteTable(
  "research_items",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    titleId: text("title_id").notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url").notNull(),
    /** Tekrar eden icerigi tespit etmek icin normalize metin hash'i. */
    contentHash: text("content_hash").notNull(),
    heading: text("heading"),
    /** Kisa alinti (telif icin tam metin saklanmaz). */
    excerpt: text("excerpt"),
    author: text("author"),
    publishedAt: text("published_at"),
    fetchedAt: text("fetched_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    /** low | medium | high | unknown */
    spoilerRisk: text("spoiler_risk", {
      enum: ["low", "medium", "high", "unknown"],
    })
      .notNull()
      .default("unknown"),
    /** Sahiplik/atıf bilgisi */
    licenseNote: text("license_note"),
    sentiment: text("sentiment", { enum: ["positive", "negative", "mixed", "neutral"] }),
    themes: text("themes"),
  },
  (t) => [
    uniqueIndex("research_items_dedupe").on(t.sessionId, t.contentHash),
    index("research_items_session_idx").on(t.sessionId),
  ],
);

/* -------------------------------------------------------------------------- */
/* AI tartismasi                                                              */
/* -------------------------------------------------------------------------- */

export const aiConversations = sqliteTable(
  "ai_conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    titleId: text("title_id"),
    heading: text("heading").notNull(),
    /** none | season | all */
    spoilerMode: text("spoiler_mode", {
      enum: ["none", "progress", "season", "all"],
    })
      .notNull()
      .default("progress"),
    spoilerSeason: integer("spoiler_season"),
    provider: text("provider"),
    model: text("model"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("ai_conversations_user_idx").on(t.userId)],
);

export const aiMessages = sqliteTable(
  "ai_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    role: text("role", { enum: ["system", "user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    /** AI yaniti mi, kullanici mi? Kaynak listesi varsa JSON. */
    citations: text("citations"),
    containsSpoiler: integer("contains_spoiler", { mode: "boolean" })
      .notNull()
      .default(false),
    provider: text("provider"),
    model: text("model"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("ai_messages_conversation_idx").on(t.conversationId)],
);

/* -------------------------------------------------------------------------- */
/* Tercih profili ve oneriler                                                 */
/* -------------------------------------------------------------------------- */

export const preferenceProfiles = sqliteTable("preference_profiles", {
  userId: text("user_id").primaryKey(),
  /** JSON: { genre: {slug: weight}, people: {...}, dimensions: {...}, decades: {...} } */
  profileJson: text("profile_json").notNull().default("{}"),
  /** 0..1 arasi kanit guveni. */
  confidence: real("confidence").notNull().default(0),
  ratedTitleCount: integer("rated_title_count").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const recommendations = sqliteTable(
  "recommendations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    titleId: text("title_id").notNull(),
    /** safe | discovery | rewatch */
    kind: text("kind", { enum: ["safe", "discovery", "rewatch"] })
      .notNull()
      .default("safe"),
    score: real("score").notNull(),
    /** 0..1 */
    confidence: real("confidence").notNull().default(0),
    uncertaintyNote: text("uncertainty_note"),
    /** JSON: [{factor, contribution, detail}] */
    reasonsJson: text("reasons_json").notNull().default("[]"),
    algorithm: text("algorithm").notNull().default("rules-v1"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("recommendations_user_title_unique").on(t.userId, t.titleId),
    index("recommendations_user_idx").on(t.userId),
  ],
);

export const recommendationFeedback = sqliteTable(
  "recommendation_feedback",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    titleId: text("title_id").notNull(),
    /** liked | not_interested | saved | watched */
    verdict: text("verdict", {
      enum: ["liked", "not_interested", "saved", "watched"],
    }).notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("recommendation_feedback_unique").on(
      t.userId,
      t.titleId,
      t.verdict,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Islem kayitlari                                                           */
/* -------------------------------------------------------------------------- */

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    detail: text("detail"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("audit_log_user_idx").on(t.userId)],
);

/* -------------------------------------------------------------------------- */
/* Web Push bildirim abonelikleri                                             */
/* -------------------------------------------------------------------------- */

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    /** JSON: { endpoint, keys: { p256dh, auth } } */
    subscriptionJson: text("subscription_json").notNull(),
    /** Kullanici tarayici/cihaz bilgisi (opsiyonel). */
    userAgent: text("user_agent"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("push_subscriptions_user_idx").on(t.userId),
    uniqueIndex("push_subscriptions_endpoint_unique").on(t.userId, t.subscriptionJson),
  ],
);

export const schemaMeta = sqliteTable("schema_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
