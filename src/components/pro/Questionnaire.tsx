"use client";

import { useState } from "react";
import type { Salon, Treatment } from "@/lib/domain";
import { PrimaryButton } from "@/components/ui";
import type { SaveSalon } from "./ProApp";

const FLOW = [
  { label: "Choix du lissage", by: "Cliente" },
  { label: "3 photos guidées (dos, profil, racines)", by: "IA" },
  { label: "Longueur, volume, repousses, pointes", by: "IA" },
  { label: "Nature des cheveux (types 1 à 4, A B C)", by: "Cliente" },
  { label: "Coloration", by: "Cliente" },
  { label: "Ancien lissage", by: "Cliente" },
  { label: "Henné", by: "Cliente" },
  { label: "Prénom, nom, téléphone, e-mail + consentement", by: "Cliente" },
];

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex h-8 w-[52px] flex-none rounded-full p-[3px] ${checked ? "justify-end bg-ink" : "justify-start bg-[#d3bfaf]"}`}
    >
      <span className="h-[26px] w-[26px] rounded-full bg-cream" />
    </button>
  );
}

export function Questionnaire({ salon, save }: { salon: Salon; save: SaveSalon }) {
  const [treatments, setTreatments] = useState<Treatment[]>(() => salon.treatments.map((t) => ({ ...t })));
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(treatments) !== JSON.stringify(salon.treatments);
  const enabledCount = treatments.filter((t) => t.enabled).length;

  const patch = (key: string, p: Partial<Treatment>) => setTreatments((list) => list.map((t) => (t.key === key ? { ...t, ...p } : t)));

  async function onSave() {
    setSaving(true);
    const err = await save({ treatments });
    setSaving(false);
    setStatus(err ?? "Enregistré.");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[44px] leading-none">Questionnaire</h1>
        <p className="max-w-2xl text-[15px] text-body">Les lissages que tu proposes, et ce que tes clientes voient, dans l&apos;ordre.</p>
      </div>
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-1 rounded-[22px] bg-white px-5 py-5">
          <span className="pb-1.5 text-xs font-extrabold tracking-wide text-muted">LISSAGES PROPOSÉS</span>
          {treatments.map((t) => (
            <div key={t.key} className="flex items-center gap-3 border-b border-hair py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label className="sr-only" htmlFor={`name-${t.key}`}>
                  Nom du lissage
                </label>
                <input id={`name-${t.key}`} value={t.name} maxLength={40} onChange={(e) => patch(t.key, { name: e.target.value })} className="h-10 rounded-lg border border-transparent px-1 text-[15px] font-bold hover:border-line focus:border-line" />
                <label className="sr-only" htmlFor={`desc-${t.key}`}>
                  Description
                </label>
                <input id={`desc-${t.key}`} value={t.description} maxLength={60} onChange={(e) => patch(t.key, { description: e.target.value })} className="h-9 rounded-lg border border-transparent px-1 text-[13px] text-muted hover:border-line focus:border-line" />
              </div>
              <Switch checked={t.enabled} label={`Proposer ${t.name}`} onChange={(v) => (v || enabledCount > 1 ? patch(t.key, { enabled: v }) : undefined)} />
            </div>
          ))}
          <p className="pt-2 text-xs text-muted">Au moins un lissage doit rester actif.</p>
          <div className="flex flex-wrap items-center gap-4 pt-3">
            <PrimaryButton onClick={onSave} disabled={!dirty || saving} className="w-auto px-7">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </PrimaryButton>
            {status && (
              <span role="status" className="text-sm font-semibold text-body">
                {status}
              </span>
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1 rounded-[22px] bg-white px-5 py-5">
          <span className="pb-1.5 text-xs font-extrabold tracking-wide text-muted">PARCOURS DE LA CLIENTE</span>
          <ol className="flex flex-col">
            {FLOW.map((f, i) => (
              <li key={f.label} className="flex items-center gap-3 border-b border-hair py-2.5">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-ground text-[13px] font-extrabold">{i + 1}</span>
                <span className="flex-1 text-sm font-semibold">{f.label}</span>
                <span className="whitespace-nowrap rounded-[10px] bg-gold-soft px-2 py-1 text-xs font-bold text-gold-ink">{f.by}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
