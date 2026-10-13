"use client";

import { useEffect, useRef, useState } from "react";
import {
  COLORINGS,
  ENDS,
  LENGTHS,
  NATURES,
  PREVIOUS,
  REGROWTH,
  VOLUMES,
  labelOf,
  natureLabel,
  type ColoringKey,
  type Corrections,
  type HairAnalysis,
  type LengthKey,
  type NatureKey,
  type NatureSubtype,
  type PreviousKey,
  type PriceLine,
  type PublicSalon,
  type VolumeKey,
} from "@/lib/domain";
import { formatEuros } from "@/lib/pricing";
import { compressImage } from "@/lib/image";
import {
  CameraIcon,
  CheckIcon,
  Pills,
  PrimaryButton,
  SecondaryButton,
  Silhouette,
  SparkIcon,
  Wordmark,
} from "@/components/ui";

type Step = "home" | "treatment" | "photos" | "analyzing" | "result" | "precisions" | "contact" | "quote";
type PhotoKind = "back" | "profile" | "roots";
type Photo = { blob: Blob; url: string };

type QuoteResponse = {
  requestId: string;
  quote: { blocked: true; reason: "henna"; lines: PriceLine[] } | { blocked: false; low: number; high: number; lines: PriceLine[] };
  length: LengthKey;
  volume: VolumeKey;
  deposit: number;
  planityUrl: string | null;
  demo?: boolean;
};

const SHOTS: { kind: PhotoKind; label: string; title: string; hint: string }[] = [
  { kind: "back", label: "Dos", title: "Tourne-toi, cheveux détachés", hint: "De dos · cheveux secs et détachés" },
  { kind: "profile", label: "Profil", title: "Maintenant, de profil", hint: "De profil · bras le long du corps" },
  { kind: "roots", label: "Racines", title: "Un gros plan des racines", hint: "Gros plan · lumière du jour" },
];

const SCAN_STEPS = ["Repérage de la silhouette", "Mesure de la longueur", "Estimation du volume", "Repousses et pointes"];

const STEP_INFO: Partial<Record<Step, [number, string]>> = {
  treatment: [1, "Ton lissage"],
  photos: [2, "Photos"],
  analyzing: [2, "Analyse IA"],
  result: [2, "Analyse IA"],
  precisions: [3, "Précisions"],
  contact: [4, "Coordonnées"],
  quote: [5, "Ton devis"],
};

const BACK: Partial<Record<Step, Step>> = {
  treatment: "home",
  photos: "treatment",
  result: "photos",
  precisions: "result",
  contact: "precisions",
};

const NATURE_PATHS: Record<NatureKey, string> = {
  1: "M13 5V35M20 5V35M27 5V35",
  2: "M20 4C28 10 12 16 20 22C28 28 12 32 20 37",
  3: "M20 4c8 0 8 8 0 8c-8 0-8 8 0 8c8 0 8 8 0 8c-8 0-8 8 0 8",
  4: "M20 4l6 4l-12 4l12 4l-12 4l12 4l-12 4l6 4",
};

const pct = (n: number) => `Fiabilité ${Math.round(n * 100)} %`;

export function QuoteFlow({ salon }: { salon: PublicSalon }) {
  const [step, setStep] = useState<Step>("home");
  const [treatment, setTreatment] = useState<string | null>(null);

  const [photos, setPhotos] = useState<Partial<Record<PhotoKind, Photo>>>({});
  const [shotIndex, setShotIndex] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [scanStep, setScanStep] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<HairAnalysis | null>(null);
  const [corrections, setCorrections] = useState<Corrections>({});
  const [editing, setEditing] = useState<"length" | "volume" | null>(null);

  const [nature, setNature] = useState<NatureKey | null>(null);
  const [subtype, setSubtype] = useState<NatureSubtype | "?">(null);
  const [coloring, setColoring] = useState<ColoringKey | null>(null);
  const [previous, setPrevious] = useState<PreviousKey | null>(null);
  const [henna, setHenna] = useState<boolean | null>(null);

  const [contact, setContact] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<QuoteResponse | null>(null);

  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
  }, [step]);

  // Libère les aperçus des photos quand le composant disparaît.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => Object.values(photosRef.current).forEach((p) => p && URL.revokeObjectURL(p.url)), []);

  const treatmentObj = salon.treatments.find((t) => t.key === treatment) ?? null;
  const currentShot = SHOTS[shotIndex];
  const allShots = SHOTS.every((s) => photos[s.kind]);
  const length = corrections.length ?? analysis?.length ?? "mid_back";
  const volume = corrections.volume ?? analysis?.volume ?? "medium";
  const precise = nature !== null && coloring !== null && previous !== null && henna !== null;
  const contactOk =
    contact.firstName.trim() !== "" &&
    contact.lastName.trim() !== "" &&
    contact.phone.replace(/\D/g, "").length >= 10 &&
    /^\S+@\S+\.\S+$/.test(contact.email.trim()) &&
    consent;

  async function onPhotoSelected(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const blob = await compressImage(file).catch(() => file);
      const url = URL.createObjectURL(blob);
      setPhotos((prev) => {
        const old = prev[currentShot.kind];
        if (old) URL.revokeObjectURL(old.url);
        return { ...prev, [currentShot.kind]: { blob, url } };
      });
      const next = SHOTS.findIndex((s, i) => i !== shotIndex && !photos[s.kind]);
      if (next >= 0) setShotIndex(next);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function runAnalysis() {
    setStep("analyzing");
    setAnalysisError(null);
    setScanStep(0);
    setCorrections({});

    let tick = 0;
    const timer = setInterval(() => {
      tick = Math.min(tick + 1, SCAN_STEPS.length - 1);
      setScanStep(tick);
    }, 900);
    const minimumShow = new Promise((r) => setTimeout(r, 3600));

    try {
      const form = new FormData();
      form.set("slug", salon.slug);
      for (const s of SHOTS) form.set(s.kind, photos[s.kind]!.blob, `${s.kind}.jpg`);
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      await minimumShow;
      if (!res.ok) throw new Error(data.error ?? "L'analyse n'a pas pu aboutir.");
      setScanStep(SCAN_STEPS.length);
      setDraftId(data.draftId);
      setAnalysis(data.analysis);
      setTimeout(() => setStep("result"), 500);
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : "L'analyse n'a pas pu aboutir.");
    } finally {
      clearInterval(timer);
    }
  }

  async function submit() {
    if (!contactOk || !draftId || !treatment || !precise) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: salon.slug,
          draftId,
          treatment,
          corrections,
          answers: {
            nature,
            nature_subtype: subtype === "?" ? null : subtype,
            coloring,
            previous_straightening: previous,
            henna,
          },
          contact,
          consent: true,
          analysis,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Impossible d'envoyer ta demande.");
      setResult(data as QuoteResponse);
      setStep("quote");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Impossible d'envoyer ta demande.");
    } finally {
      setSubmitting(false);
    }
  }

  const info = STEP_INFO[step];

  return (
    <div ref={topRef} className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col bg-ground">
      {info && (
        <header className="flex flex-col gap-3 px-5 pb-2.5 pt-4">
          <div className="flex items-center gap-3">
            {BACK[step] ? (
              <button
                type="button"
                aria-label="Retour"
                onClick={() => setStep(BACK[step]!)}
                className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-line bg-white"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden>
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            ) : (
              <span className="h-11 w-11" aria-hidden />
            )}
            <div className="flex flex-1 flex-col gap-0.5">
              <Wordmark className="text-[22px]" />
              <span className="text-xs font-semibold text-muted">
                Étape {info[0]} sur 5 · {info[1]}
              </span>
            </div>
            <span className="text-xs font-bold text-muted">{salon.name}</span>
          </div>
          <div className="flex gap-1.5" aria-hidden>
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className={`h-1 flex-1 rounded-full ${n <= info[0] ? "bg-accent" : "bg-[#e2d2c5]"}`} />
            ))}
          </div>
        </header>
      )}

      <main className="flex flex-1 flex-col">
        {step === "home" && (
          <section className="flex flex-1 flex-col gap-5 px-6 pb-7 pt-5">
            <div className="flex items-center justify-between">
              <Wordmark className="text-[30px]" />
              <span className="rounded-2xl bg-white px-3 py-2 text-xs font-bold">pour {salon.name}</span>
            </div>
            <div className="relative flex h-[300px] items-end justify-center overflow-hidden rounded-[28px] bg-sand">
              <Silhouette className="h-[285px] w-[190px]" />
              <span className="absolute left-[18px] top-[26px] flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-bold">
                <span className="h-2 w-2 rounded-full bg-accent" />
                Longueur
              </span>
              <span className="absolute right-4 top-[118px] flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-bold">
                <span className="h-2 w-2 rounded-full bg-accent" />
                Volume
              </span>
              <span className="absolute bottom-[30px] left-[22px] flex items-center gap-2 rounded-2xl bg-ink px-3 py-2 text-xs font-bold text-cream">
                <SparkIcon className="h-3.5 w-3.5" />
                Analysé par IA
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              <h1 className="font-serif text-[42px] leading-[1.02] tracking-tight">
                Ton devis lissage en <em>2 minutes</em>, par l&apos;IA.
              </h1>
              <p className="text-[15px] leading-relaxed text-body">
                Choisis ton lissage, prends tes cheveux en photo : notre IA analyse ta chevelure et calcule ton
                prix avec les tarifs de {salon.name}.
              </p>
            </div>
            <div className="mt-auto flex flex-col items-center gap-3">
              <PrimaryButton onClick={() => setStep("treatment")} disabled={salon.treatments.length === 0}>
                <SparkIcon className="h-[18px] w-[18px]" />
                Commencer mon diagnostic IA
              </PrimaryButton>
              <span className="text-xs font-semibold text-muted">Gratuit · sans engagement · photos privées</span>
            </div>
          </section>
        )}

        {step === "treatment" && (
          <section className="flex flex-1 flex-col gap-4 px-6 pb-7 pt-2">
            <div className="flex flex-col gap-1">
              <h2 className="font-serif text-[32px] leading-tight">Quel lissage te fait envie ?</h2>
              <p className="text-sm text-body">Les soins proposés par {salon.name}.</p>
            </div>
            <div className="flex flex-col gap-2.5" role="group" aria-label="Lissage souhaité">
              {salon.treatments.map((t) => {
                const selected = t.key === treatment;
                return (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTreatment(t.key)}
                    className={`flex w-full items-center gap-3.5 rounded-[22px] border-2 p-[18px] text-left ${
                      selected ? "border-ink bg-ink text-cream" : "border-[#e2d2c5] bg-white text-ink"
                    }`}
                  >
                    <span className="flex flex-1 flex-col gap-1">
                      <span className="text-lg font-extrabold">{t.name}</span>
                      <span className={`text-[13px] ${selected ? "text-[#e2d2c5]" : "text-muted"}`}>{t.description}</span>
                    </span>
                    <span className="whitespace-nowrap text-[13px] font-bold">dès {formatEuros(t.fromPrice)}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-auto">
              <PrimaryButton
                disabled={!treatment}
                onClick={() => {
                  setShotIndex(SHOTS.findIndex((s) => !photos[s.kind]) >= 0 ? SHOTS.findIndex((s) => !photos[s.kind]) : 0);
                  setStep("photos");
                }}
              >
                <CameraIcon />
                Passer à l&apos;analyse photo
              </PrimaryButton>
            </div>
          </section>
        )}

        {step === "photos" && (
          <section className="flex flex-1 flex-col gap-4 px-6 pb-7 pt-2">
            <div className="flex flex-col gap-1">
              <h2 className="font-serif text-[30px] leading-tight">{currentShot.title}</h2>
              <p className="text-sm text-body">
                Photo {shotIndex + 1} sur 3 · suis le contour, l&apos;IA s&apos;occupe du reste.
              </p>
            </div>

            <div className="relative flex h-[380px] items-end justify-center overflow-hidden rounded-[26px] bg-ink">
              {photos[currentShot.kind] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photos[currentShot.kind]!.url} alt={`Photo ${currentShot.label.toLowerCase()}`} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <Silhouette variant="outline" className="h-[345px] w-[230px]" />
              )}
              {(["left-[18px] top-[18px] border-l-[3px] border-t-[3px] rounded-tl-md", "right-[18px] top-[18px] border-r-[3px] border-t-[3px] rounded-tr-md", "bottom-[18px] left-[18px] border-b-[3px] border-l-[3px] rounded-bl-md", "bottom-[18px] right-[18px] border-b-[3px] border-r-[3px] rounded-br-md"] as const).map((c) => (
                <span key={c} className={`absolute h-[26px] w-[26px] border-accent ${c}`} aria-hidden />
              ))}
              <span className="absolute left-1/2 top-[22px] -translate-x-1/2 whitespace-nowrap rounded-2xl bg-black/40 px-3.5 py-2 text-xs font-bold text-cream backdrop-blur">
                {currentShot.hint}
              </span>
            </div>

            <div className="flex gap-2.5">
              {SHOTS.map((s, i) => {
                const p = photos[s.kind];
                const active = i === shotIndex;
                return (
                  <button
                    key={s.kind}
                    type="button"
                    onClick={() => setShotIndex(i)}
                    aria-pressed={active}
                    aria-label={`Photo ${s.label}${p ? " (prise)" : ""}`}
                    className={`relative flex h-[58px] flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-[14px] text-xs font-bold ${
                      p ? "bg-[#3b2a22] text-cream" : "border-[1.5px] border-dashed border-[#bfa897] text-muted"
                    } ${active ? "ring-2 ring-accent ring-offset-2 ring-offset-ground" : ""}`}
                  >
                    {p && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
                    )}
                    <span className="relative flex items-center gap-1.5">
                      {p && <CheckIcon className="h-3.5 w-3.5" />}
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto flex flex-col gap-2.5">
              {allShots ? (
                <PrimaryButton onClick={runAnalysis}>
                  <SparkIcon className="h-[18px] w-[18px]" />
                  Lancer l&apos;analyse IA
                </PrimaryButton>
              ) : (
                <label className={`flex h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-ink text-base font-bold text-cream ${photoBusy ? "opacity-50" : ""}`}>
                  <CameraIcon />
                  {photoBusy ? "Préparation…" : photos[currentShot.kind] ? "Reprendre la photo" : "Prendre la photo"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    disabled={photoBusy}
                    onChange={(e) => {
                      onPhotoSelected(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              <label className="flex h-11 cursor-pointer items-center justify-center text-sm font-bold underline underline-offset-4">
                {allShots ? `Remplacer la photo « ${currentShot.label} »` : "Choisir dans ma galerie"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={photoBusy}
                  onChange={(e) => {
                    onPhotoSelected(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </section>
        )}

        {step === "analyzing" && (
          <section className="flex flex-1 flex-col gap-[18px] px-6 pb-7 pt-2" aria-live="polite">
            <div className="relative flex h-[360px] items-end justify-center overflow-hidden rounded-[26px] bg-night">
              {photos.back ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photos.back.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
              ) : (
                <Silhouette variant="dark" className="h-[345px] w-[230px]" />
              )}
              {!analysisError && <div className="scanline" />}
            </div>
            {analysisError ? (
              <div className="flex flex-1 flex-col gap-4">
                <h2 className="font-serif text-[30px] leading-tight">Oups, l&apos;analyse a échoué</h2>
                <p className="text-[15px] text-body">{analysisError}</p>
                <div className="mt-auto flex flex-col gap-2.5">
                  <PrimaryButton onClick={runAnalysis}>Réessayer</PrimaryButton>
                  <SecondaryButton onClick={() => setStep("photos")}>Revoir mes photos</SecondaryButton>
                </div>
              </div>
            ) : (
              <>
                <h2 className="font-serif text-[30px] leading-tight">L&apos;IA analyse ta chevelure…</h2>
                <ol className="flex flex-col gap-3">
                  {SCAN_STEPS.map((label, i) => (
                    <li key={label} className="flex items-center gap-3 text-[15px] font-semibold">
                      {scanStep > i ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-cream">
                          <CheckIcon className="h-3 w-3" />
                        </span>
                      ) : scanStep === i ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-accent">
                          <span className="pulse-dot h-2 w-2 rounded-full bg-accent" />
                        </span>
                      ) : (
                        <span className="h-6 w-6 rounded-full border-2 border-[#d3bfaf]" />
                      )}
                      {label}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>
        )}

        {step === "result" && analysis && (
          <section className="flex flex-1 flex-col gap-4 px-6 pb-7 pt-2">
            {!analysis.usable ? (
              <div className="flex flex-1 flex-col gap-4">
                <h2 className="font-serif text-[30px] leading-tight">Il faut reprendre une photo</h2>
                <p className="text-[15px] leading-relaxed text-body">
                  {analysis.issue ?? "L'IA n'a pas pu bien voir tes cheveux."} Cheveux secs et détachés, à la
                  lumière du jour, c&apos;est l&apos;idéal.
                </p>
                <div className="mt-auto">
                  <PrimaryButton onClick={() => setStep("photos")}>
                    <CameraIcon />
                    Reprendre mes photos
                  </PrimaryButton>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <h2 className="font-serif text-[30px] leading-tight">Ton analyse est prête</h2>
                  <p className="text-sm text-body">Si quelque chose ne colle pas, touche « Modifier ».</p>
                </div>
                <div className="flex flex-col rounded-[22px] bg-white px-[18px] py-1.5">
                  <ResultRow
                    label="Longueur"
                    value={labelOf(LENGTHS, length)}
                    confidence={corrections.length ? "Corrigé par toi" : pct(analysis.length_confidence)}
                    onEdit={() => setEditing(editing === "length" ? null : "length")}
                    editing={editing === "length"}
                  >
                    <Pills
                      label="Longueur de tes cheveux"
                      options={LENGTHS}
                      value={length}
                      onChange={(v) => {
                        setCorrections((c) => ({ ...c, length: v === analysis.length ? undefined : v }));
                        setEditing(null);
                      }}
                    />
                  </ResultRow>
                  <ResultRow
                    label="Volume"
                    value={labelOf(VOLUMES, volume)}
                    confidence={corrections.volume ? "Corrigé par toi" : pct(analysis.volume_confidence)}
                    onEdit={() => setEditing(editing === "volume" ? null : "volume")}
                    editing={editing === "volume"}
                  >
                    <Pills
                      label="Volume de tes cheveux"
                      options={VOLUMES}
                      value={volume}
                      onChange={(v) => {
                        setCorrections((c) => ({ ...c, volume: v === analysis.volume ? undefined : v }));
                        setEditing(null);
                      }}
                    />
                  </ResultRow>
                  <ResultRow label="Repousses" value={labelOf(REGROWTH, analysis.regrowth)} confidence={pct(analysis.regrowth_confidence)} />
                  <ResultRow label="Pointes" value={labelOf(ENDS, analysis.ends)} confidence={pct(analysis.ends_confidence)} last />
                </div>
                <div className="flex items-start gap-3 rounded-[22px] bg-sand px-[18px] py-4">
                  <SparkIcon className="mt-0.5 h-[22px] w-[22px] flex-none" />
                  <p className="text-sm leading-snug text-[#2e2420]">
                    Pour un diagnostic complet, l&apos;IA a besoin de <strong>4 précisions</strong> sur l&apos;histoire de
                    tes cheveux.
                  </p>
                </div>
                <div className="mt-auto">
                  <PrimaryButton onClick={() => setStep("precisions")}>Affiner mon diagnostic</PrimaryButton>
                </div>
              </>
            )}
          </section>
        )}

        {step === "precisions" && (
          <section className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col gap-[22px] px-6 pb-4 pt-2">
              <div className="flex flex-col gap-2">
                <h2 className="font-serif text-[30px] leading-tight">Affinons ton diagnostic</h2>
                <span className="flex items-center gap-1.5 self-start rounded-xl bg-white px-2.5 py-1.5 text-xs font-bold">
                  <SparkIcon className="h-3.5 w-3.5" />
                  L&apos;IA croise tes réponses avec tes photos
                </span>
              </div>

              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-2.5 flex flex-col gap-0.5">
                  <span className="text-base font-bold">La nature de tes cheveux au naturel</span>
                  <span className="text-[13px] text-muted">Sans brushing ni lisseur.</span>
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {NATURES.map((n) => {
                    const selected = nature === n.key;
                    return (
                      <button
                        key={n.key}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setNature(n.key);
                          setSubtype(null);
                        }}
                        className={`flex min-h-16 items-center gap-2.5 rounded-[18px] border-2 px-3 py-2.5 text-left ${
                          selected ? "border-ink bg-ink text-cream" : "border-[#e2d2c5] bg-white text-ink"
                        }`}
                      >
                        <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-[30px] w-[30px] flex-none" aria-hidden>
                          <path d={NATURE_PATHS[n.key]} />
                        </svg>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-sm font-extrabold">{n.label}</span>
                          <span className={`text-[11px] ${selected ? "text-[#e2d2c5]" : "text-muted"}`}>Type {n.key}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {nature !== null && (
                  <div className="flex flex-col gap-2 rounded-2xl bg-[#ede0d5] px-3.5 py-3">
                    <span className="text-[13px] font-bold">Tu connais ton type précis ?</span>
                    <Pills
                      label="Type précis"
                      options={[
                        { key: "A", label: `${nature}A` },
                        { key: "B", label: `${nature}B` },
                        { key: "C", label: `${nature}C` },
                        { key: "?", label: "Je ne sais pas" },
                      ]}
                      value={subtype}
                      onChange={(v) => setSubtype(v as NatureSubtype | "?")}
                    />
                  </div>
                )}
              </fieldset>

              <Question title="Une coloration déjà faite ?" sub="Même ancienne, elle change le soin à prévoir.">
                <Pills label="Coloration" options={COLORINGS} value={coloring} onChange={setColoring} />
              </Question>
              <Question title="Un ancien lissage ?" sub="Pour adapter le produit à tes longueurs.">
                <Pills label="Ancien lissage" options={PREVIOUS} value={previous} onChange={setPrevious} />
              </Question>
              <Question title="Du henné sur tes cheveux ?" sub="Invisible en photo, mais essentiel pour ta lisseuse.">
                <Pills
                  label="Henné"
                  options={[
                    { key: "no", label: "Jamais" },
                    { key: "yes", label: "Oui" },
                  ]}
                  value={henna === null ? null : henna ? "yes" : "no"}
                  onChange={(v) => setHenna(v === "yes")}
                />
              </Question>
            </div>
            <div className="sticky bottom-0 border-t border-[#e6d6c9] bg-ground px-6 pb-7 pt-3">
              <PrimaryButton disabled={!precise} onClick={() => setStep("contact")}>
                Calculer mon devis
              </PrimaryButton>
            </div>
          </section>
        )}

        {step === "contact" && (
          <section className="flex flex-1 flex-col">
            <form
              className="flex flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="flex flex-1 flex-col gap-4 px-6 pb-4 pt-2">
                <div className="flex flex-col gap-1">
                  <h2 className="font-serif text-[30px] leading-tight">Ton devis est prêt</h2>
                  <p className="text-sm text-body">Dis-nous où te l&apos;envoyer, et à qui {salon.name} répond.</p>
                </div>
                <Field id="firstName" label="Prénom" autoComplete="given-name" value={contact.firstName} onChange={(v) => setContact((c) => ({ ...c, firstName: v }))} />
                <Field id="lastName" label="Nom" autoComplete="family-name" value={contact.lastName} onChange={(v) => setContact((c) => ({ ...c, lastName: v }))} />
                <Field id="phone" label="Téléphone" type="tel" inputMode="tel" autoComplete="tel" placeholder="06 00 00 00 00" value={contact.phone} onChange={(v) => setContact((c) => ({ ...c, phone: v }))} />
                <Field id="email" label="E-mail" type="email" inputMode="email" autoComplete="email" placeholder="prenom@exemple.fr" value={contact.email} onChange={(v) => setContact((c) => ({ ...c, email: v }))} />
                <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-snug text-body">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-[22px] w-[22px] flex-none accent-ink" />
                  <span>
                    J&apos;accepte que mes photos et mes réponses soient transmises à {salon.name} pour établir mon
                    devis. Les photos sont supprimées automatiquement au bout de 90 jours.
                  </span>
                </label>
                {submitError && (
                  <p role="alert" className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#8a2f22]">
                    {submitError}
                  </p>
                )}
              </div>
              <div className="sticky bottom-0 border-t border-[#e6d6c9] bg-ground px-6 pb-7 pt-3">
                <PrimaryButton type="submit" disabled={!contactOk || submitting}>
                  {submitting ? "Calcul en cours…" : "Voir mon devis"}
                </PrimaryButton>
              </div>
            </form>
          </section>
        )}

        {step === "quote" && result && (
          <section className="flex flex-1 flex-col">
            {result.quote.blocked ? (
              <div className="flex flex-1 flex-col gap-4 px-6 pb-7 pt-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sand">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[26px] w-[26px]" aria-hidden>
                    <path d="M12 9v4M12 16.5v.01" />
                    <path d="M10.3 3.9L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                  </svg>
                </div>
                <h2 className="font-serif text-[32px] leading-tight">
                  {contact.firstName.trim()}, ton lissage doit être vu en salon
                </h2>
                <p className="text-[15px] leading-relaxed text-body">
                  Le henné peut réagir avec certains produits lissants. Pour ta sécurité, {salon.name} préfère voir
                  tes cheveux avant de te donner un prix.{" "}
                  {result.demo
                    ? "(Mode démo : aucune demande n'est envoyée.)"
                    : `Tes photos lui ont été envoyées : elle te recontacte au ${contact.phone}.`}
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-1 flex-col gap-4 px-6 pb-4 pt-2">
                  {result.demo ? (
                    <div className="self-start rounded-xl bg-gold-soft px-3 py-2 text-xs font-bold text-gold-ink">
                      Mode démo : aucune demande n&apos;est envoyée
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 self-start rounded-xl bg-white px-3 py-2 text-xs font-bold">
                      <CheckIcon className="h-3.5 w-3.5" />
                      Demande envoyée à {salon.name}
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-bold text-muted">
                      {contact.firstName.trim()}, ton estimation chez {salon.name}
                    </span>
                    <span className="font-serif text-[56px] leading-none tracking-tight">
                      {result.quote.low} – {formatEuros(result.quote.high)}
                    </span>
                    <span className="self-start rounded-xl bg-white px-3 py-1.5 text-[13px] font-bold">
                      {treatmentObj?.name} · {labelOf(LENGTHS, result.length).toLowerCase()}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 rounded-[22px] bg-white px-[18px] py-3.5">
                    <span className="text-xs font-extrabold tracking-wide text-muted">TON DIAGNOSTIC</span>
                    <DiagRow k="Lissage choisi" v={treatmentObj?.name ?? ""} />
                    <DiagRow k="Longueur" v={labelOf(LENGTHS, result.length)} ai={!corrections.length} />
                    <DiagRow k="Volume" v={labelOf(VOLUMES, result.volume)} ai={!corrections.volume} />
                    <DiagRow k="Nature" v={nature ? natureLabel(nature, subtype === "?" ? null : subtype) : ""} />
                    <DiagRow k="Coloration" v={labelOf(COLORINGS, coloring)} />
                    <DiagRow k="Ancien lissage" v={labelOf(PREVIOUS, previous)} last />
                  </div>

                  <div className="flex flex-col rounded-[22px] bg-white px-[18px] py-2">
                    {result.quote.lines.map((l) => (
                      <div key={l.label} className="flex justify-between gap-3 border-b border-hair py-2.5 text-sm">
                        <span className="text-body">{l.label}</span>
                        <span className="font-bold">
                          {l === result.quote.lines[0] ? "" : "+ "}
                          {formatEuros(l.amount)}
                        </span>
                      </div>
                    ))}
                    <p className="pb-2 pt-3 text-xs leading-snug text-muted">
                      Calculé avec la grille tarifaire de {salon.name}. Prix confirmé par ta lisseuse après réception
                      de tes photos.
                    </p>
                  </div>
                </div>
                <div className="sticky bottom-0 flex flex-col gap-2 border-t border-[#e6d6c9] bg-ground px-6 pb-7 pt-3">
                  {result.planityUrl ? (
                    <>
                      <a
                        href={result.planityUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-14 items-center justify-center gap-2 rounded-full bg-ink text-base font-bold text-cream"
                      >
                        Réserver · acompte {formatEuros(result.deposit)}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden>
                          <path d="M7 17L17 7M9 7h8v8" />
                        </svg>
                      </a>
                      <span className="text-center text-xs font-semibold text-muted">
                        Sur Planity, choisis « {treatmentObj?.name} · {labelOf(LENGTHS, result.length).toLowerCase()} »
                      </span>
                    </>
                  ) : (
                    <p className="text-center text-sm font-semibold text-body">
                      {salon.name} te recontacte très vite pour fixer ton rendez-vous.
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function ResultRow({
  label,
  value,
  confidence,
  onEdit,
  editing,
  children,
  last,
}: {
  label: string;
  value: string;
  confidence: string;
  onEdit?: () => void;
  editing?: boolean;
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-3 py-3 ${last ? "" : "border-b border-hair"}`}>
      <div className="flex items-center gap-3">
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-xs font-semibold text-muted">{label}</span>
          <span className="text-[17px] font-bold">{value}</span>
        </div>
        <span className="rounded-[10px] bg-gold-soft px-2 py-1 text-xs font-bold text-gold-ink">{confidence}</span>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-expanded={editing}
            className="h-11 rounded-full border-[1.5px] border-line bg-white px-3 text-[13px] font-bold"
          >
            {editing ? "Fermer" : "Modifier"}
          </button>
        )}
      </div>
      {editing && children}
    </div>
  );
}

function Question({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-bold">{title}</span>
        <span className="text-[13px] text-muted">{sub}</span>
      </div>
      {children}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  ...rest
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email";
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-bold">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[52px] w-full rounded-[14px] border-[1.5px] border-line bg-white px-4 text-base text-ink"
        {...rest}
      />
    </div>
  );
}

function DiagRow({ k, v, ai, last }: { k: string; v: string; ai?: boolean; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2 text-sm ${last ? "" : "border-b border-hair"}`}>
      <span className="flex items-center gap-1.5 text-body">
        {ai && <SparkIcon className="h-3.5 w-3.5 text-gold-ink" label="Analysé par IA" />}
        {k}
      </span>
      <span className="text-right font-bold">{v}</span>
    </div>
  );
}
