"use client";

import { usePreferenceProfile } from "@/hooks/usePreferenceProfile";

export function PersonalityBadge() {
  const { profile, loading, error } = usePreferenceProfile();

  if (loading) {
    return (
      <div className="surface p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-ink-800" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 bg-ink-800 rounded" />
            <div className="h-3 w-1/2 bg-ink-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="surface p-4 text-center text-mist-500">
        Profil henüz hazır değil.
      </div>
    );
  }

  const { explicit, implicit } = profile;

  // Arketip belirle
  const getArchetype = () => {
    if (profile.explicit?.tempo && profile.explicit.tempo >= 8) return "Aksiyon ve Tempo Tutkunu";
    if (profile.explicit?.tempo && profile.explicit.tempo <= 3) return "Yavaş Sinema ve Atmosfer Severi";
    if (profile.explicit?.realism && profile.explicit.realism >= 8) return "Gerçekçilik ve Gerçek Hayat Severi";
    if (profile.explicit?.realism && profile.explicit.realism <= 3) return "Fantastik ve Bilimkurgu Hayalperi";

    const dims = profile.implicit.dimensions;
    const topDim = Object.entries(profile.implicit.dimensions).sort((a, b) => b[1] - a[1])[0]?.[0];
    const archetypes: Record<string, string> = {
      atmosfer: "Atmosfer Avcısı",
      karakter: "Karakter Çalışması Tutkunu",
      tempo: "Tempolu Sinemasever",
      gorsel: "Görsel Estetikçisi",
      konu: "Konu Odaklı İzleyici",
    };
    return dims[0] ? archetypes[topDim] || "Sinema Tutkunu" : "Sinema Tutkünü";
  };

  const archetype = getArchetype();

  // En güçlü 3 boyut
  const topDimensions = Object.entries(profile.implicit.dimensions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // En sevilen 3 tür
  const topGenres = Object.entries(profile.implicit.genres)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // En sevilen 3 dekad
  const topDecades = Object.entries(profile.implicit.decades)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // En sevilen 5 kişi (oyuncu/yönetmen)
  const topPeople = Object.entries(profile.implicit.people)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const DIM_LABELS: Record<string, string> = {
    atmosfer: "Atmosfer",
    karakter: "Karakter Derinliği",
    tempo: "Tempo / Aksiyon",
    gorsel: "Görsel Estetik",
    konu: "Konu / Mesaj",
  };

  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs text-gold-300 uppercase tracking-wide">Sinema Arketipin</p>
          <h3 className="font-display text-xl font-bold text-mist-100">{archetype}</h3>
        </div>
        <span className="chip chip-gold text-xs">
          {Math.round(profile.implicit.confidence * 100)}% güven
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <StatBox label="İzlenen" value={profile.implicit.totalWatched} icon="🎬" />
        <StatBox label="Ort. Puan" value={profile.implicit.avgRating.toFixed(1)} suffix="/10" icon="⭐" />
        <StatBox label="Favori" value={Math.round((profile.implicit.confidence * 10))} suffix="%" icon="❤️" />
        <StatBox label="Güven" value={Math.round(profile.implicit.confidence * 100)} suffix="%" icon="📊" />
      </div>

      <div className="space-y-4">
        <Section title="Güçlü Yönlerin" icon="💪">
          <div className="flex flex-wrap gap-2">
            {topDimensions.map(([dim, score]) => (
              <span key={dim} className="chip">
                {DIM_LABELS[dim] ?? dim} <span className="text-gold-300">{Math.round(score * 100)}%</span>
              </span>
            ))}
          </div>
        </Section>

        <Section title="Sevdiğin Türler" icon="🎭">
          <div className="flex flex-wrap gap-2">
            {topGenres.map(([slug, score]) => (
              <span key={slug} className="chip chip-gold">
                {slug} <span className="text-gold-300">{Math.round(score * 100)}%</span>
              </span>
            ))}
          </div>
        </Section>

        <Section title="Favori Dekadlar" icon="📅">
          <div className="flex flex-wrap gap-2">
            {topDecades.map(([dec, score]) => (
              <span key={dec} className="chip">
                {dec} <span className="text-gold-300">{Math.round(score * 100)}%</span>
              </span>
            ))}
          </div>
        </Section>

        {topPeople.length > 0 && (
          <Section title="Favori Kadro" icon="🎬">
            <div className="flex flex-wrap gap-2">
              {topPeople.map(([name, score]) => (
                <span key={name} className="chip">
                  {name} <span className="text-gold-300">{Math.round(score * 100)}%</span>
                </span>
              ))}
            </div>
            <p className="mt-2 text-[0.68rem] text-mist-500">
              Yüksek puanlı ve favori filmlerindeki yönetmen/oyuncu ağırlıklarından hesaplandı.
            </p>
          </Section>
        )}

        {profile.explicit && (
          <Section title="Açık Tercihlerin" icon="📝">
            <div className="grid gap-2 sm:grid-cols-2">
              <StatItem label="Tempo" value={`${profile.explicit.tempo}/10`} desc="Yavaş ↔ Hızlı" />
              <StatItem label="Gerçekçilik" value={`${profile.explicit.realism}/10`} desc="Gerçekçi ↔ Kurgu" />
              <StatItem label="Tekrar İzleme" value={profile.explicit.rewatch} />
              <StatItem label="Spoiler" value={profile.explicit.spoilerTolerance} />
              <StatItem label="Sosyal Etki" value={`${profile.explicit.socialWeight}/10`} />
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850/80 p-4">
      <h4 className="font-semibold text-mist-100 mb-3 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h4>
      {children}
    </div>
  );
}

function StatBox({ label, value, suffix = "", icon }: { label: string; value: string | number; suffix?: string; icon: string }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850/80 p-4 text-center">
      <span className="text-2xl">{icon}</span>
      <div className="mt-1 font-display text-2xl font-bold text-mist-100">
        {value}{suffix}
      </div>
      <div className="text-xs text-mist-500">{label}</div>
    </div>
  );
}

function StatItem({ label, value, desc }: { label: string; value: string; desc?: string }) {
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-900/50 p-3">
      <p className="text-xs text-mist-500">{label}</p>
      <p className="font-medium text-mist-100">{value}</p>
      {desc && <p className="text-xs text-mist-500">{desc}</p>}
    </div>
  );
}

const DIM_LABELS: Record<string, string> = {
  atmosfer: "Atmosfer",
  karakter: "Karakter Derinliği",
  tempo: "Tempo / Aksiyon",
  gorsel: "Görsel Estetik",
  konu: "Konu / Mesaj",
};