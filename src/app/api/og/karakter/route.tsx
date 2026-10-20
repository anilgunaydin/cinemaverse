import { ImageResponse } from "next/og";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getFullProfile } from "@/lib/preference/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BG = "#0f0f12";
const GOLD = "#d4a94f";
const MIST = "#8b8b96";
const WHITE = "#f5f5f7";

const DIM_LABELS: Record<string, string> = {
  atmosfer: "Atmosfer",
  karakter: "Karakter Derinliği",
  tempo: "Tempo",
  gorsel: "Görsel Estetik",
  konu: "Konu",
};

function archetypeFor(profile: any): string {
  const { explicit, implicit } = profile;
  if (explicit?.tempo >= 8) return "Aksiyon ve Tempo Tutkunu";
  if (explicit?.tempo <= 3) return "Yavaş Sinema ve Atmosfer Severi";
  if (explicit?.realism >= 8) return "Gerçekçilik Severi";
  if (explicit?.realism <= 3) return "Fantastik ve Bilimkurgu Hayalperi";

  const dims: Record<string, number> = implicit?.dimensions ?? {};
  const top = Object.entries(dims).sort((a, b) => b[1] - a[1])[0]?.[0];
  const map: Record<string, string> = {
    atmosfer: "Atmosfer Avcısı",
    karakter: "Karakter Çalışması Tutkunu",
    tempo: "Tempolu Sinemasever",
    gorsel: "Görsel Estetikçisi",
    konu: "Konu Odaklı İzleyici",
  };
  return top ? map[top] ?? "Sinema Tutkunu" : "Sinema Tutkunu";
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: BG,
            color: WHITE,
            fontSize: 48,
          }}
        >
          CinemaVerse
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  const profile = await getFullProfile(user.id);
  const archetype = archetypeFor(profile);

  const topGenres = Object.entries(profile.implicit.genres)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const topPeople = Object.entries(profile.implicit.people)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const topDims = Object.entries(profile.implicit.dimensions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(135deg, ${BG} 0%, #16161d 60%, #1d1a14 100%)`,
          padding: 60,
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              border: `2px solid ${GOLD}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: GOLD,
              fontSize: 22,
            }}
          >
            ▶
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: WHITE, fontSize: 26, fontWeight: 700 }}>
              CinemaVerse
            </span>
            <span style={{ color: MIST, fontSize: 14, letterSpacing: 2 }}>
              SİNEMA KARAKTERİN
            </span>
          </div>
        </div>

        {/* Archetype */}
        <div
          style={{
            marginTop: 40,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span
            style={{
              color: GOLD,
              fontSize: 15,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            {user.displayName}&apos;in arketipi
          </span>
          <span
            style={{
              color: WHITE,
              fontSize: 68,
              fontWeight: 800,
              lineHeight: 1.1,
              marginTop: 8,
            }}
          >
            {archetype}
          </span>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 16, marginTop: 36 }}>
          <StatBox
            value={String(profile.implicit.totalWatched)}
            label="YAPIM"
          />
          <StatBox
            value={profile.implicit.avgRating.toFixed(1)}
            label="ORT. PUAN"
          />
          <StatBox
            value={`${Math.round(profile.implicit.confidence * 100)}%`}
            label="GÜVEN"
          />
        </div>

        {/* Details */}
        <div style={{ display: "flex", gap: 48, marginTop: 40 }}>
          <Column
            title="Güçlü Yönler"
            items={topDims.map(([d]) => DIM_LABELS[d] ?? d)}
          />
          <Column
            title="Sevilen Türler"
            items={topGenres.map(([g]) => g)}
          />
          {topPeople.length > 0 ? (
            <Column
              title="Favori Kadro"
              items={topPeople.map(([p]) => p)}
            />
          ) : null}
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: MIST, fontSize: 15 }}>
            {profile.implicit.totalWatched} film ·{" "}
            {profile.implicit.decades &&
            Object.keys(profile.implicit.decades).length > 0
              ? `${Object.entries(profile.implicit.decades).sort((a, b) => b[1] - a[1])[0]?.[0]} favorisi`
              : "sinema tutkunu"}
          </span>
          <span style={{ color: GOLD, fontSize: 15, fontWeight: 600 }}>
            cinemaverse.app
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 14,
        padding: "14px 24px",
        minWidth: 150,
      }}
    >
      <span style={{ color: WHITE, fontSize: 32, fontWeight: 800 }}>{value}</span>
      <span style={{ color: MIST, fontSize: 12, letterSpacing: 2 }}>{label}</span>
    </div>
  );
}

function Column({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ color: GOLD, fontSize: 15, fontWeight: 700 }}>{title}</span>
      {items.length === 0 ? (
        <span style={{ color: MIST, fontSize: 15 }}>—</span>
      ) : (
        items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: GOLD, fontSize: 14 }}>•</span>
            <span style={{ color: WHITE, fontSize: 17 }}>{item}</span>
          </div>
        ))
      )}
    </div>
  );
}