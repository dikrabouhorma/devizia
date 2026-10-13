"use client";

import { useState } from "react";
import type { Salon } from "@/lib/domain";
import { PrimaryButton } from "@/components/ui";
import type { SaveSalon } from "./ProApp";
import { Switch } from "./Questionnaire";

export function SettingsPanel({ salon, save }: { salon: Salon; save: SaveSalon }) {
  const [name, setName] = useState(salon.name);
  const [planity, setPlanity] = useState(salon.planity_url ?? "");
  const [deposit, setDeposit] = useState(salon.deposit);
  const [blockHenna, setBlockHenna] = useState(salon.settings.block_henna);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const planityValid = planity.trim() === "" || /^https:\/\/\S+$/.test(planity.trim());
  const dirty =
    name !== salon.name ||
    planity !== (salon.planity_url ?? "") ||
    deposit !== salon.deposit ||
    blockHenna !== salon.settings.block_henna;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!planityValid || name.trim().length < 2) return;
    setSaving(true);
    const err = await save({
      name: name.trim(),
      planity_url: planity.trim() || null,
      deposit,
      settings: { ...salon.settings, block_henna: blockHenna },
    });
    setSaving(false);
    setStatus(err ?? "Réglages enregistrés.");
  }

  return (
    <form onSubmit={onSave} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[44px] leading-none">Réglages</h1>
        <p className="max-w-2xl text-[15px] text-body">Ton salon, la réservation et l&apos;acompte.</p>
      </div>
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4 rounded-[22px] bg-white p-6">
          <span className="text-xs font-extrabold tracking-wide text-muted">SALON ET RÉSERVATION</span>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="s-name" className="text-[13px] font-bold">
              Nom du salon
            </label>
            <input id="s-name" required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl border-[1.5px] border-line bg-[#fbf6f2] px-3.5 text-[15px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="s-planity" className="text-[13px] font-bold">
              Ta page Planity
            </label>
            <input
              id="s-planity"
              type="url"
              placeholder="https://www.planity.com/…"
              value={planity}
              onChange={(e) => setPlanity(e.target.value)}
              aria-invalid={!planityValid}
              className="h-12 rounded-xl border-[1.5px] border-line bg-[#fbf6f2] px-3.5 text-[15px]"
            />
            {!planityValid && <span className="text-xs font-semibold text-[#8a2f22]">Le lien doit commencer par https://</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="s-deposit" className="text-[13px] font-bold">
              Acompte demandé (€)
            </label>
            <input id="s-deposit" type="number" min={0} step={5} value={deposit} onChange={(e) => setDeposit(Math.max(0, parseInt(e.target.value, 10) || 0))} className="h-12 w-40 rounded-xl border-[1.5px] border-line bg-[#fbf6f2] px-3.5 text-[15px] font-bold" />
          </div>
          <p className="text-[13px] leading-snug text-muted">
            Pour que la cliente puisse réserver directement, crée sur Planity une prestation réservable par lissage et
            par longueur (par exemple « Tanin · milieu du dos »), avec le prépaiement activé.
          </p>
        </div>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1 rounded-[22px] bg-white p-6">
          <span className="pb-1.5 text-xs font-extrabold tracking-wide text-muted">SÉCURITÉ</span>
          <div className="flex items-center justify-between gap-3 border-b border-hair py-2.5">
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-bold">Bloquer le prix si henné déclaré</span>
              <span className="text-[13px] text-muted">La cliente est invitée à un diagnostic en salon.</span>
            </span>
            <Switch checked={blockHenna} onChange={setBlockHenna} label="Bloquer le prix si henné déclaré" />
          </div>
          <span className="pb-1.5 pt-5 text-xs font-extrabold tracking-wide text-muted">BIENTÔT</span>
          <ul className="flex flex-col gap-2 text-sm text-body">
            <li>E-mail automatique à chaque nouvelle demande</li>
            <li>Rappel SMS à la cliente la veille du rendez-vous</li>
            <li>Envoi automatique du devis, sans validation</li>
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <PrimaryButton type="submit" disabled={!dirty || saving || !planityValid} className="w-auto px-8">
          {saving ? "Enregistrement…" : "Enregistrer"}
        </PrimaryButton>
        {status && (
          <span role="status" className="text-sm font-semibold text-body">
            {status}
          </span>
        )}
      </div>
    </form>
  );
}
