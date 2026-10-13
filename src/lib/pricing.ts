import {
  LENGTHS,
  labelOf,
  type ClientAnswers,
  type LengthKey,
  type PriceLine,
  type Salon,
  type VolumeKey,
} from "./domain";

export type QuoteInput = {
  treatment: string;
  length: LengthKey;
  volume: VolumeKey;
  answers: ClientAnswers;
};

export type Quote =
  | { blocked: true; reason: "henna"; lines: PriceLine[] }
  | { blocked: false; low: number; high: number; lines: PriceLine[] };

type PricingConfig = Pick<Salon, "treatments" | "grid" | "supplements" | "settings" | "range_width">;

/**
 * Calcule le devis à partir de la grille de la lisseuse.
 * Prix = base (lissage × longueur) + suppléments ; fourchette = [prix, prix + largeur].
 */
export function computeQuote(salon: PricingConfig, input: QuoteInput): Quote {
  const treatment = salon.treatments.find((t) => t.key === input.treatment);
  const row = salon.grid[input.treatment];
  if (!treatment || !treatment.enabled || !Array.isArray(row)) {
    throw new Error(`Lissage inconnu ou désactivé : ${input.treatment}`);
  }

  if (input.answers.henna && salon.settings.block_henna) {
    return { blocked: true, reason: "henna", lines: [] };
  }

  const lengthIndex = LENGTHS.findIndex((l) => l.key === input.length);
  if (lengthIndex < 0) throw new Error(`Longueur inconnue : ${input.length}`);
  const base = row[lengthIndex];
  if (typeof base !== "number" || Number.isNaN(base)) {
    throw new Error(`Prix manquant pour ${treatment.name} · ${input.length}`);
  }

  const s = salon.supplements;
  const lines: PriceLine[] = [
    { label: `${treatment.name} · ${labelOf(LENGTHS, input.length).toLowerCase()}`, amount: base },
  ];
  if (input.volume === "medium" && s.volume_medium) lines.push({ label: "Volume moyen", amount: s.volume_medium });
  if (input.volume === "dense" && s.volume_dense) lines.push({ label: "Volume dense", amount: s.volume_dense });
  if (input.answers.nature === 3 && s.curly) lines.push({ label: "Cheveux bouclés", amount: s.curly });
  if (input.answers.nature === 4 && s.coily) lines.push({ label: "Cheveux crépus ou frisés", amount: s.coily });
  if (input.answers.coloring === "bleach" && s.bleach) {
    lines.push({ label: "Soin protecteur (décoloration)", amount: s.bleach });
  }

  const low = lines.reduce((sum, l) => sum + l.amount, 0);
  return { blocked: false, low, high: low + Math.max(0, salon.range_width), lines };
}

export const formatEuros = (n: number) => `${n.toLocaleString("fr-FR")} €`;
