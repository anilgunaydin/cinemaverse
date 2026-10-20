"use client";

import { useEffect, useState } from "react";

export type PreferenceProfile = {
  userId: string;
  explicit: {
    tempo: number;
    realism: number;
    rewatch: string;
    spoilerTolerance: string;
    socialWeight: number;
  } | null;
  implicit: {
    genres: Record<string, number>;
    people: Record<string, number>;
    decades: Record<string, number>;
    dimensions: Record<string, number>;
    tempoPreference: number;
    realismPreference: number;
    avgRating: number;
    totalWatched: number;
    confidence: number;
  };
  combined: {
    genreWeights: Record<string, number>;
    peopleWeights: Record<string, number>;
    decadeWeights: Record<string, number>;
    dimensionWeights: Record<string, number>;
  };
  updatedAt: string;
};

export function usePreferenceProfile() {
  const [profile, setProfile] = useState<PreferenceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchProfile() {
      try {
        const res = await fetch("/api/preferences");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        if (mounted) setProfile(data);
      } catch (e: any) {
        if (mounted) setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchProfile();
    return () => { mounted = false; };
  }, []);

  const savePreferences = async (prefs: any) => {
    const res = await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    if (!res.ok) throw new Error("Failed to save");
    // Refresh profile
    const res2 = await fetch("/api/preferences");
    const data = await res2.json();
    setProfile(data);
  };

  return { profile, loading, error, savePreferences };
}