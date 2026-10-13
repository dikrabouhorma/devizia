"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import {
  COLORINGS,
  ENDS,
  LENGTHS,
  PREVIOUS,
  REGROWTH,
  VOLUMES,
  labelOf,
  natureLabel,
  type QuoteRequest,
  type Salon,
} from "@/lib/domain";
import { formatEuros } from "@/lib/pricing";
import { CheckIcon, SparkIcon } from "@/components/ui";

const PHOTO_LABELS: Record<string, string> = { back: "De dos", profile: "De profil", roots: "Racines" };

function since(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "hier" : `${days} j`;
}

export function Requests({ salon, onNewCount }: { salon: Salon; onNewCount: (n: number) => void }) {
  const [items, setItems] = useState<QuoteRequest[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [refresh, setRefresh] = useState(0);

  // Recharge la liste à l'ouverture, toutes les 30 s, et après une erreur de mise à jour.
  useEffect(() => {
    let cancelled = false;
    getBrowserClient()
      .from("quote_requests")
      .select("*")
      .eq("salon_id", salon.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError("Impossible de charger les demandes.");
          return;
        }
        const list = data as QuoteRequest[];
        setItems(list);
        setSelectedId((cur) => (cur && list.some((r) => r.id === cur) ? cur : (list[0]?.id ?? null)));
      });
    return () => {
      cancelled = true;
    };
  }, [salon.id, refresh]);

  useEffect(() => {
    const id = setInterval(() => setRefresh((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    onNewCount(items?.filter((r) => r.status === "new").length ?? 0);
  }, [items, onNewCount]);

  const update = useCallback(async (id: string, patch: Partial<Pick<QuoteRequest, "status" | "adjustment">>) => {
    setItems((list) => list?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? null);
    const { error } = await getBrowserClient().from("quote_requests").update(patch).eq("id", id);
    if (error) {
      setError("La mise à jour a échoué.");
      setRefresh((n) => n + 1);
    }
  }, []);

  const selected = items?.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-muted">Bonjour {salon.name}</span>
        <h1 className="font-serif text-[44px] leading-none">Demandes de devis</h1>
      </div>
      {error && (
        <p role="alert" className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#8a2f22]">
          {error}
        </p>
      )}

      {items === null ? (
        <p className="text-body">Chargement…</p>
      ) : items.length === 0 ? (
        <div className="flex max-w-xl flex-col gap-2 rounded-3xl bg-white p-7">
          <h2 className="text-xl font-extrabold">Aucune demande pour l&apos;instant</h2>
          <p className="leading-relaxed text-body">
            Mets ton lien dans ta bio Instagram (onglet « Lien en bio ») : chaque cliente qui fait son diagnostic
            apparaîtra ici, avec ses photos et son devis.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-5">
          <ul className="flex min-w-0 flex-[1_1_260px] flex-col gap-2.5">
            {items.map((r) => {
              const active = r.id === selectedId;
              const price = r.blocked ? "Sur rendez-vous" : `${(r.price_low ?? 0) + r.adjustment} – ${formatEuros((r.price_high ?? 0) + r.adjustment)}`;
              const tag = r.status === "sent" ? "Envoyé" : r.blocked ? "À vérifier" : "Nouveau";
              const treatment = salon.treatments.find((t) => t.key === r.treatment)?.name ?? r.treatment;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    aria-current={active ? "true" : undefined}
                    className={`flex w-full flex-col gap-2 rounded-[18px] p-4 text-left ${
                      active ? "border-2 border-ink bg-white" : "border-[1.5px] border-[#e2d2c5] bg-[#fbf6f2]"
                    }`}
                  >
                    <span className="flex w-full justify-between gap-2">
                      <span className="text-base font-extrabold">
                        {r.first_name} {r.last_name.charAt(0)}.
                      </span>
                      <span className="text-xs font-semibold text-muted">{since(r.created_at)}</span>
                    </span>
                    <span className="text-[13px] text-body">
                      {r.blocked ? "Henné déclaré · à voir en salon" : `${treatment} · ${labelOf(LENGTHS, r.corrections?.length ?? r.analysis.length).toLowerCase()}`}
                    </span>
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="text-lg font-extrabold">{price}</span>
                      <span className={`rounded-[10px] px-2 py-1 text-xs font-bold ${r.status === "new" ? "bg-gold-soft text-gold-ink" : "bg-hair text-body"}`}>{tag}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {selected && <RequestDetail key={selected.id} salon={salon} request={selected} onUpdate={update} />}
        </div>
      )}
    </div>
  );
}

function RequestDetail({
  salon,
  request: r,
  onUpdate,
}: {
  salon: Salon;
  request: QuoteRequest;
  onUpdate: (id: string, patch: Partial<Pick<QuoteRequest, "status" | "adjustment">>) => void;
}) {
  const [photos, setPhotos] = useState<{ path: string; url: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (r.photo_paths.length === 0) return;
    getBrowserClient()
      .storage.from("photos")
      .createSignedUrls(r.photo_paths, 3600)
      .then(({ data }) => {
        if (!cancelled && data) {
          setPhotos(
            data.flatMap((d) => (d.signedUrl ? [{ path: d.path ?? "", url: d.signedUrl }] : [])),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [r.photo_paths]);

  const treatment = salon.treatments.find((t) => t.key === r.treatment)?.name ?? r.treatment;
  const length = r.corrections?.length ?? r.analysis.length;
  const volume = r.corrections?.volume ?? r.analysis.volume;
  const low = (r.price_low ?? 0) + r.adjustment;
  const high = (r.price_high ?? 0) + r.adjustment;

  const message = useMemo(() => {
    const hello = `Bonjour ${r.first_name},\n\n`;
    const sign = `\n\nÀ très vite,\n${salon.name}`;
    if (r.blocked) {
      return `${hello}Merci pour ta demande de ${treatment.toLowerCase()} ! Comme tu as indiqué avoir déjà utilisé du henné, je préfère voir tes cheveux avant de te donner un prix. Je te propose un petit diagnostic au salon : dis-moi quand tu es disponible.${sign}`;
    }
    const booking = salon.planity_url
      ? `\n\nPour réserver, choisis la prestation « ${treatment} · ${labelOf(LENGTHS, length).toLowerCase()} » sur ma page Planity (acompte de ${salon.deposit} €) : ${salon.planity_url}`
      : "";
    return `${hello}Merci pour ta demande ! Après avoir regardé tes photos, je te confirme ton devis pour un lissage ${treatment.toLowerCase()} : entre ${low} et ${high} €.${booking}${sign}`;
  }, [r, salon, treatment, length, low, high]);

  const subject = r.blocked ? `Ton diagnostic lissage chez ${salon.name}` : `Ton devis lissage chez ${salon.name}`;
  const mailto = `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  const smsTo = `sms:${r.phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(message)}`;

  return (
    <section aria-label="Détail de la demande" className="flex min-w-0 flex-[2_1_520px] flex-col gap-5 rounded-3xl bg-white p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <h2 className="font-serif text-[34px] leading-none">
          {r.first_name} {r.last_name}
        </h2>
        <span className="text-[13px] font-semibold text-muted">
          {treatment} · reçue le {new Date(r.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {r.photo_paths.map((p, i) => {
          const signed = photos.find((x) => x.path === p) ?? photos[i];
          const kind = p.split("/").pop()?.split(".")[0] ?? "";
          return (
            <figure key={p} className="flex flex-col gap-1.5">
              <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-night">
                {signed && (
                  <a href={signed.url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={signed.url} alt={`Photo ${PHOTO_LABELS[kind] ?? ""} de ${r.first_name}`} className="h-full w-full object-cover" />
                  </a>
                )}
              </div>
              <figcaption className="text-xs font-bold text-muted">{PHOTO_LABELS[kind] ?? kind}</figcaption>
            </figure>
          );
        })}
        {r.photo_paths.length === 0 && <p className="col-span-3 text-sm text-muted">Photos supprimées (plus de 90 jours).</p>}
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
          <span className="flex items-center gap-2 text-[13px] font-extrabold tracking-wide">
            <SparkIcon />
            ANALYSE IA DES PHOTOS
          </span>
          <Row k="Longueur" v={labelOf(LENGTHS, length)} note={r.corrections?.length ? `corrigée (IA : ${labelOf(LENGTHS, r.analysis.length).toLowerCase()})` : `${Math.round(r.analysis.length_confidence * 100)} %`} />
          <Row k="Volume" v={labelOf(VOLUMES, volume)} note={r.corrections?.volume ? `corrigé (IA : ${labelOf(VOLUMES, r.analysis.volume).toLowerCase()})` : `${Math.round(r.analysis.volume_confidence * 100)} %`} />
          <Row k="Repousses" v={labelOf(REGROWTH, r.analysis.regrowth)} note={`${Math.round(r.analysis.regrowth_confidence * 100)} %`} />
          <Row k="Pointes" v={labelOf(ENDS, r.analysis.ends)} note={`${Math.round(r.analysis.ends_confidence * 100)} %`} />
          {r.analysis.mock && <p className="pt-2 text-xs text-muted">Analyse simulée (mode démo, pas de clé IA).</p>}
        </div>
        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
          <span className="text-[13px] font-extrabold tracking-wide">RÉPONSES DE LA CLIENTE</span>
          <Row k="Nature" v={natureLabel(r.answers.nature, r.answers.nature_subtype)} />
          <Row k="Coloration" v={labelOf(COLORINGS, r.answers.coloring)} />
          <Row k="Ancien lissage" v={labelOf(PREVIOUS, r.answers.previous_straightening)} />
          <Row k="Henné" v={r.answers.henna ? "Oui" : "Jamais"} />
          <Row k="Téléphone" v={<a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a>} />
          <Row k="E-mail" v={<a href={`mailto:${r.email}`} className="break-all">{r.email}</a>} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-5 rounded-[20px] bg-ground px-5 py-5">
        {r.blocked ? (
          <div className="flex max-w-md flex-col gap-1">
            <span className="text-[13px] font-bold text-muted">Devis automatique suspendu</span>
            <span className="text-xl font-extrabold">Henné déclaré : diagnostic en salon conseillé</span>
            <span className="text-[13px] text-body">La cliente a été prévenue que tu la recontactes.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-bold text-muted">Prix calculé avec ta grille</span>
            <span className="font-serif text-5xl leading-none">
              {low} – {formatEuros(high)}
            </span>
            <span className="text-[13px] text-body">
              {r.breakdown.map((l, i) => `${i ? "+ " : ""}${l.label} ${formatEuros(l.amount)}`).join(" · ")}
              {r.adjustment ? ` · ajustement ${r.adjustment > 0 ? "+" : "−"} ${formatEuros(Math.abs(r.adjustment))}` : ""}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          {!r.blocked && r.status === "new" && (
            <div className="flex items-center gap-1.5 rounded-full bg-white p-1">
              <button type="button" aria-label="Baisser le prix de 10 €" onClick={() => onUpdate(r.id, { adjustment: r.adjustment - 10 })} className="h-11 w-11 rounded-full bg-ground text-xl font-bold">
                −
              </button>
              <span className="min-w-16 px-1.5 text-center text-[13px] font-bold">Ajuster</span>
              <button type="button" aria-label="Augmenter le prix de 10 €" onClick={() => onUpdate(r.id, { adjustment: r.adjustment + 10 })} className="h-11 w-11 rounded-full bg-ground text-xl font-bold">
                +
              </button>
            </div>
          )}
          {r.status === "new" ? (
            <>
              <a
                href={mailto}
                onClick={() => onUpdate(r.id, { status: "sent" })}
                className="flex h-[52px] items-center rounded-full bg-ink px-5 text-[15px] font-bold text-cream"
              >
                {r.blocked ? "Proposer un diagnostic" : "Valider et envoyer par e-mail"}
              </a>
              <a href={smsTo} onClick={() => onUpdate(r.id, { status: "sent" })} className="flex h-[52px] items-center rounded-full border-[1.5px] border-ink bg-white px-5 text-[15px] font-bold">
                Par SMS
              </a>
            </>
          ) : (
            <>
              <span className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold">
                <CheckIcon />
                Envoyé à {r.first_name}
              </span>
              <button type="button" onClick={() => onUpdate(r.id, { status: "archived" })} className="h-11 px-3 text-sm font-bold underline underline-offset-4">
                Archiver
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Row({ k, v, note }: { k: string; v: React.ReactNode; note?: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-hair py-2 text-sm">
      <span className="text-body">{k}</span>
      <span className="text-right font-bold">
        {v}
        {note && <span className="font-semibold text-gold-ink"> · {note}</span>}
      </span>
    </div>
  );
}
