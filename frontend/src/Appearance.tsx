import { useEffect, useState } from "react";
import { Check, LockKeyhole, Palette } from "lucide-react";
import { api } from "./api";
type Theme = {
  id: string;
  name: string;
  description: string;
  badge?: string;
  target?: number;
};
const themes: Theme[] = [
  { id: "garden", name: "Garden", description: "Fresh mint & golden light" },
  { id: "ocean", name: "Ocean", description: "Deep blue & sea glass" },
  { id: "iris", name: "Iris", description: "Soft lilac & rich violet" },
  { id: "sunset", name: "Sunset", description: "Warm peach & terracotta" },
  {
    id: "bloom",
    name: "Bloom",
    description: "Rose petals & warm cream",
    badge: "total-1",
    target: 1,
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Teal skies & lavender light",
    badge: "total-10",
    target: 10,
  },
  {
    id: "starlight",
    name: "Starlight",
    description: "Indigo & soft champagne",
    badge: "total-25",
    target: 25,
  },
];
type Milestones = {
  collection: { id: string; earned: string | null }[];
  total_checkins: number;
};
export function themeReward(badge: string) {
  return themes.find((t) => t.badge === badge)?.name;
}
export async function restoreUnlockedAppearance() {
  try {
    const saved = localStorage.getItem("spendshield-theme");
    const theme = themes.find((t) => t.id === saved);
    if (!theme?.badge) return;
    document.documentElement.dataset.theme = "garden";
    const data = await api<Milestones>("/planning");
    if (
      localStorage.getItem("spendshield-theme") === saved &&
      data.collection.some((b) => b.id === theme.badge && b.earned)
    )
      document.documentElement.dataset.theme = theme.id;
  } catch {
    /* Keep an available base theme when offline. */
  }
}
export function restoreAppearance() {
  let theme = "garden";
  try {
    const saved = localStorage.getItem("spendshield-theme");
    if (themes.some((t) => t.id === saved && !t.badge)) theme = saved!;
  } catch {
    /* Browser storage is optional. */
  }
  document.documentElement.dataset.theme = theme;
}
export function Appearance() {
  const [selected, setSelected] = useState(
    document.documentElement.dataset.theme || "garden",
  );
  const [notice, setNotice] = useState("");
  const [milestones, setMilestones] = useState<Milestones | null>(null);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let alive = true;
    api<Milestones>("/planning")
      .then((d) => {
        if (alive) setMilestones(d);
      })
      .catch(() => {
        if (alive) setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  function unlocked(t: Theme) {
    return (
      !t.badge ||
      !!milestones?.collection.some((b) => b.id === t.badge && b.earned)
    );
  }

  function choose(id: string) {
    const theme = themes.find((t) => t.id === id);
    if (!theme || !unlocked(theme)) return;
    document.documentElement.dataset.theme = id;
    setSelected(id);
    try {
      localStorage.setItem("spendshield-theme", id);
      setNotice("Theme saved for this browser.");
    } catch {
      setNotice(
        "Theme applied for this visit. Browser storage is unavailable.",
      );
    }
  }
  return (
    <section className="appearance">
      <h3>
        <Palette size={18} /> Make it your space
      </h3>
      <p>
        Four palettes are always available. Three optional palettes celebrate
        the daily reviews you already record in My Plan. No purchases or perfect
        streaks needed.
      </p>
      <p className="fine-print">
        Your selected palette stays on this browser. Unlocks follow this
        profile’s earned achievements.
      </p>
      <div className="theme-options" role="group" aria-label="Color theme">
        {themes.map((t) => (
          <button
            type="button"
            className={"theme-option theme-" + t.id}
            key={t.id}
            aria-pressed={selected === t.id}
            disabled={!unlocked(t)}
            onClick={() => choose(t.id)}
          >
            <span className="theme-preview" aria-hidden="true">
              <i />
              <i />
              <i />
              {selected === t.id && <Check size={17} />}
            </span>
            <strong>{t.name}</strong>
            <small>{t.description}</small>
            {t.badge && (
              <span className="theme-unlock">
                {unlocked(t) ? (
                  <>
                    <Check size={13} /> Unlocked
                  </>
                ) : (
                  <>
                    <LockKeyhole size={13} />
                    {loadError
                      ? "Cannot check progress right now"
                      : !milestones
                        ? "Checking achievements…"
                        : `${Math.min(milestones.total_checkins, t.target!)} / ${t.target} daily ${t.target === 1 ? "review" : "reviews"}`}
                  </>
                )}
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="fine-print">
        To unlock these, start any challenge in My Plan and record reviews on
        separate dates. Past reviews count; missed days never reset progress.
        Bloom unlocks at 1 review, Aurora at 10, and Starlight at 25.
      </p>
      <p className="fine-print" role="status">
        {notice}
      </p>
    </section>
  );
}
