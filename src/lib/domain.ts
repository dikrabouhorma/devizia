// Vocabulaire métier partagé entre le parcours cliente, l'API et l'espace lisseuse.

export const LENGTHS = [
  { key: "shoulders", label: "Épaules" },
  { key: "shoulder_blades", label: "Omoplates" },
  { key: "mid_back", label: "Milieu du dos" },
  { key: "waist", label: "Taille" },
  { key: "below_waist", label: "Au-delà de la taille" },
] as const;
export type LengthKey = (typeof LENGTHS)[number]["key"];

export const VOLUMES = [
  { key: "fine", label: "Fin" },
  { key: "medium", label: "Moyen" },
  { key: "dense", label: "Dense" },
] as const;
export type VolumeKey = (typeof VOLUMES)[number]["key"];

export const REGROWTH = [
  { key: "none", label: "Aucune" },
  { key: "light", label: "Légères" },
  { key: "visible", label: "Visibles" },
] as const;
export type RegrowthKey = (typeof REGROWTH)[number]["key"];

export const ENDS = [
  { key: "healthy", label: "Saines" },
  { key: "slightly_dry", label: "Légèrement sèches" },
  { key: "damaged", label: "Abîmées" },
] as const;
export type EndsKey = (typeof ENDS)[number]["key"];

/** Classification des cheveux : 1 lisse, 2 ondulé, 3 bouclé, 4 crépu / frisé. */
export const NATURES = [
  { key: 1, label: "Lisse" },
  { key: 2, label: "Ondulé" },
  { key: 3, label: "Bouclé" },
  { key: 4, label: "Crépu / frisé" },
] as const;
export type NatureKey = 1 | 2 | 3 | 4;
export type NatureSubtype = "A" | "B" | "C" | null;

export const COLORINGS = [
  { key: "none", label: "Aucune" },
  { key: "color", label: "Coloration" },
  { key: "bleach", label: "Mèches ou décoloration" },
] as const;
export type ColoringKey = (typeof COLORINGS)[number]["key"];

export const PREVIOUS = [
  { key: "never", label: "Jamais" },
  { key: "over_6_months", label: "Il y a + de 6 mois" },
  { key: "under_6_months", label: "Il y a - de 6 mois" },
] as const;
export type PreviousKey = (typeof PREVIOUS)[number]["key"];

export type Treatment = {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
};

export type Supplements = {
  volume_medium: number;
  volume_dense: number;
  curly: number;
  coily: number;
  bleach: number;
};

export type SalonSettings = {
  notify_email: boolean;
  reminder: boolean;
  block_henna: boolean;
  auto_send: boolean;
};

export type Salon = {
  id: string;
  owner_id: string | null;
  slug: string;
  name: string;
  planity_url: string | null;
  deposit: number;
  range_width: number;
  treatments: Treatment[];
  grid: Record<string, number[]>;
  supplements: Supplements;
  settings: SalonSettings;
  created_at: string;
};

/** Ce que l'IA renvoie après analyse des photos. */
export type HairAnalysis = {
  usable: boolean;
  issue: string | null;
  length: LengthKey;
  length_confidence: number;
  volume: VolumeKey;
  volume_confidence: number;
  regrowth: RegrowthKey;
  regrowth_confidence: number;
  ends: EndsKey;
  ends_confidence: number;
  mock?: boolean;
};

/** Ce que la cliente déclare dans le formulaire. */
export type ClientAnswers = {
  nature: NatureKey;
  nature_subtype: NatureSubtype;
  coloring: ColoringKey;
  previous_straightening: PreviousKey;
  henna: boolean;
};

/** Valeurs de l'analyse que la cliente a corrigées sur l'écran de résultats. */
export type Corrections = Partial<{ length: LengthKey; volume: VolumeKey }>;

export type QuoteRequest = {
  id: string;
  salon_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  treatment: string;
  answers: ClientAnswers;
  analysis: HairAnalysis;
  corrections: Corrections;
  blocked: boolean;
  price_low: number | null;
  price_high: number | null;
  breakdown: PriceLine[];
  adjustment: number;
  status: "new" | "sent" | "archived";
  photo_paths: string[];
  created_at: string;
};

export type PriceLine = { label: string; amount: number };

export const labelOf = <T extends { key: string | number; label: string }>(
  list: readonly T[],
  key: T["key"] | null | undefined,
): string => list.find((x) => x.key === key)?.label ?? "";

export const natureLabel = (n: NatureKey, sub: NatureSubtype) =>
  `${labelOf(NATURES, n)}${sub ? ` · ${n}${sub}` : ""}`;

/** Données du salon exposées publiquement au parcours cliente. */
export type PublicSalon = {
  slug: string;
  name: string;
  planityUrl: string | null;
  deposit: number;
  treatments: { key: string; name: string; description: string; fromPrice: number }[];
};

export function toPublicSalon(s: Salon): PublicSalon {
  return {
    slug: s.slug,
    name: s.name,
    planityUrl: s.planity_url,
    deposit: s.deposit,
    treatments: s.treatments
      .filter((t) => t.enabled && Array.isArray(s.grid[t.key]))
      .map((t) => ({
        key: t.key,
        name: t.name,
        description: t.description,
        fromPrice: Math.min(...s.grid[t.key]),
      })),
  };
}
