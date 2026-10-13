"use client";

import { useMemo, useState } from "react";
import { LENGTHS, type Salon, type Supplements } from "@/lib/domain";
import { computeQuote, formatEuros } from "@/lib/pricing";
import { PrimaryButton } from "@/components/ui";
import type { SaveSalon } from "./ProApp";

const SUPPLEMENTS: { key: keyof Supplements; label: string }[] = [
  { key: "volume_medium", label: "Volume moyen" },
  { key: "volume_dense", label: "Volume dense" },
  { key: "curly", label: "Cheveux bouclés (type 3)" },
  { key: "coily", label: "Cheveux crépus ou frisés (type 4)" },
  { key: "bleach", label: "Soin après décoloration" },
];

const toInt = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
};

export function PricingEditor({ salon, save }: { salon: Salon; save: SaveSalon }) {
  const [grid, setGrid] = useState(() => structuredClone(salon.grid));
  const [supplements, setSupplements] = useState<Supplements>(() => ({ ...salon.supplements }));
  const [range, setRange] = useState(salon.range_width);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const treatments = salon.treatments.filter((t) => Array.isArray(grid[t.key]));
  const dirty =
    JSON.stringify(grid) !== JSON.stringify(salon.grid) ||
    JSON.stringify(supplements) !== JSON.stringify(salon.supplements) ||
    range !== salon.range_width;

  const preview = useMemo(() => {
    const first = treatments.find((t) => t.enabled) ?? treatments[0];
    if (!first) return null;
    try {
      const q = computeQuote(
        { ...salon, grid, supplements, range_width: range, treatments: salon.treatments.map((t) => ({ ...t, enabled: true })) },
        {
          treatment: first.key,
          length: "mid_back",
          volume: "medium",
          answers: { nature: 2, nature_subtype: null, coloring: "bleach", previous_straightening: "never", henna: false },
        },
      );
      return q.blocked ? null : { name: first.name, text: `${q.low} – ${formatEuros(q.high)}` };
    } catch {
      return null;
    }
  }, [salon, grid, supplements, range, treatments]);

  async function onSave() {
    setSaving(true);
    const err = await save({ grid, supplements, range_width: range });
    setSaving(false);
    setStatus(err ?? "Grille enregistrée : les prochains devis l'utilisent.");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[44px] leading-none">Grille tarifaire</h1>
        <p className="max-w-2xl text-[15px] text-body">
          Tes prix de base par lissage et par longueur. Chaque devis est calculé à partir de cette grille.
        </p>
      </div>

      <div className="overflow-x-auto rounded-[22px] bg-white px-5 py-4">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="px-2 py-2.5 text-left text-xs font-extrabold tracking-wide text-muted">
                LONGUEUR
              </th>
              {treatments.map((t) => (
                <th key={t.key} scope="col" className="px-2 py-2.5 text-left text-xs font-extrabold uppercase tracking-wide text-muted">
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LENGTHS.map((l, li) => (
              <tr key={l.key} className="border-t border-hair">
                <th scope="row" className="px-2 py-2.5 text-left font-bold">
                  {l.label}
                </th>
                {treatments.map((t) => (
                  <td key={t.key} className="p-2">
                    <span className="inline-flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        step={5}
                        inputMode="numeric"
                        aria-label={`${t.name}, ${l.label}`}
                        value={grid[t.key][li]}
                        onChange={(e) =>
                          setGrid((g) => {
                            const next = structuredClone(g);
                            next[t.key][li] = toInt(e.target.value);
                            return next;
                          })
                        }
                        className="h-11 w-[88px] rounded-xl border-[1.5px] border-line bg-[#fbf6f2] px-2.5 text-[15px] font-bold"
                      />
                      <span className="font-bold text-muted">€</span>
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex min-w-0 flex-[2_1_420px] flex-col gap-1 rounded-[22px] bg-white px-5 py-5">
          <span className="pb-1.5 text-xs font-extrabold tracking-wide text-muted">SUPPLÉMENTS</span>
          {SUPPLEMENTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3 border-b border-hair py-2">
              <label htmlFor={`supp-${s.key}`} className="text-sm">
                {s.label}
              </label>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-bold text-muted">+</span>
                <input
                  id={`supp-${s.key}`}
                  type="number"
                  min={0}
                  step={5}
                  inputMode="numeric"
                  value={supplements[s.key]}
                  onChange={(e) => setSupplements((x) => ({ ...x, [s.key]: toInt(e.target.value) }))}
                  className="h-11 w-20 rounded-xl border-[1.5px] border-line bg-[#fbf6f2] px-2.5 text-[15px] font-bold"
                />
                <span className="font-bold text-muted">€</span>
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 py-2">
            <label htmlFor="range" className="text-sm">
              Largeur de la fourchette affichée
            </label>
            <span className="inline-flex items-center gap-1.5">
              <input
                id="range"
                type="number"
                min={0}
                step={5}
                inputMode="numeric"
                value={range}
                onChange={(e) => setRange(toInt(e.target.value))}
                className="h-11 w-20 rounded-xl border-[1.5px] border-line bg-[#fbf6f2] px-2.5 text-[15px] font-bold"
              />
              <span className="font-bold text-muted">€</span>
            </span>
          </div>
        </div>
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2.5 rounded-[22px] bg-ink p-6 text-ground">
          <span className="text-xs font-extrabold tracking-wide text-[#b7a597]">APERÇU EN DIRECT</span>
          <span className="text-sm leading-snug text-[#d9c9bc]">
            {preview?.name ?? "Lissage"} · milieu du dos · volume moyen · mèches décolorées
          </span>
          <span className="font-serif text-5xl leading-none">{preview?.text ?? "—"}</span>
          <span className="text-[13px] text-[#b7a597]">Ce que verrait une cliente avec ce profil.</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <PrimaryButton onClick={onSave} disabled={!dirty || saving} className="w-auto px-8">
          {saving ? "Enregistrement…" : "Enregistrer la grille"}
        </PrimaryButton>
        {status && (
          <span role="status" className="text-sm font-semibold text-body">
            {status}
          </span>
        )}
      </div>
    </div>
  );
}
