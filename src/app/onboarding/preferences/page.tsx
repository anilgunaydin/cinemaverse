"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Prefs = {
  tempo: number;
  realism: number;
  rewatch: "nadir" | "bazen" | "siklik";
  spoilerTolerance: "yok" | "az" | "onemsiz";
  socialWeight: number;
};

const INITIAL_PREFS: Prefs = {
  tempo: 5,
  realism: 5,
  rewatch: "bazen",
  spoilerTolerance: "az",
  socialWeight: 5,
};

const REWATCH_OPTIONS = [
  { value: "nadir", label: "Nadir — Sadece sevdiğim filmleri tekrar izlerim" },
  { value: "bazen", label: "Bazen — Sevdiğim veya detayları kaçırdığım filmler" },
  { value: "siklik", label: "Sık sık — Konfor filmlerimi defalarca izlerim" },
];

const SPOILER_OPTIONS = [
  { value: "yok", label: "Kesinlikle istemem — Hiçbir detay söylenmesin" },
  { value: "az", label: "Az — Genel özet/ton okurum, kritik detaylar yok" },
  { value: "onemsiz", label: "Önemli değil — Spoiler beni rahatsız etmez" },
];

export default function PreferencesPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(INITIAL_PREFS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (key: keyof Prefs, value: any) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kaydedilemedi");

      router.push("/profile");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const Slider = ({ label, value, onChange, min = 1, max = 10, leftLabel, rightLabel }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    leftLabel?: string;
    rightLabel?: string;
  }) => (
    <div className="space-y-2">
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        <span className="text-xs text-mist-500 w-24 text-right">{leftLabel}</span>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-2 bg-ink-700 rounded-lg appearance-none accent-gold-500"
        />
        <span className="text-xs text-mist-500 w-24">{rightLabel}</span>
        <span className="w-8 text-center font-mono text-gold-300">{value}</span>
      </div>
    </div>
  );

  const RadioGroup = ({ label, value, onChange, options }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <div className="space-y-2">
      <label className="label">{label}</label>
      <div className="space-y-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer ${
              value === opt.value
                ? "border-gold-500/50 bg-gold-500/10"
                : "border-ink-600 bg-ink-900 hover:border-ink-500"
            }`}
          >
            <input
              type="radio"
              name={label}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="accent-gold-500"
            />
            <span className="text-sm text-mist-300">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <main className="mx-auto max-w-2xl py-10 px-4">
      <header className="mb-10 text-center">
        <h1 className="font-display text-3xl font-bold text-mist-100 mb-2">Hoş Geldiniz</h1>
        <p className="text-mist-400">5 soru, 2 dakika — size özel sinema deneyimi için.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Slider
          label="Film temposu nasıl olsun?"
          value={prefs.tempo}
          onChange={(v) => handleChange("tempo", v)}
          leftLabel="Yavaş / Atmosferik"
          rightLabel="Hızlı / Aksiyon"
        />

        <Slider
          label="Gerçekçi mi, kurgu mu?"
          value={prefs.realism}
          onChange={(v) => handleChange("realism", v)}
          leftLabel="Gerçekçi / Drama"
          rightLabel="Bilimkurgu / Fantastik"
        />

        <RadioGroup
          label="Yeniden izleme eğiliminiz?"
          value={prefs.rewatch}
          onChange={(v) => handleChange("rewatch", v)}
          options={REWATCH_OPTIONS}
        />

        <RadioGroup
          label="Spoiler hassasiyeti?"
          value={prefs.spoilerTolerance}
          onChange={(v) => handleChange("spoilerTolerance", v)}
          options={SPOILER_OPTIONS}
        />

        <Slider
          label="Arkadaş/Topluluk önerileri ne kadar etkiler?"
          value={prefs.socialWeight}
          onChange={(v) => handleChange("socialWeight", v)}
          leftLabel="Kendi kararım"
          rightLabel="Topluluk etkili"
        />

        {error && (
          <p className="text-sm text-rose-400 text-center">{error}</p>
        )}

        <div className="flex gap-3 pt-4">
          <Link
            href="/profile"
            className="btn btn-ghost flex-1"
            onClick={(e) => {
              e.preventDefault();
              router.push("/profile");
            }}
          >
            Atla
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary flex-1 py-2.5"
          >
            {saving ? "Kaydediliyor…" : "Kaydet ve Devam Et"}
          </button>
        </div>
      </form>
    </main>
  );
}