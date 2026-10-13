"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase/browser";
import type { Salon } from "@/lib/domain";
import { PrimaryButton, Wordmark } from "@/components/ui";
import { Requests } from "./Requests";
import { PricingEditor } from "./PricingEditor";
import { Questionnaire } from "./Questionnaire";
import { BioLink } from "./BioLink";
import { SettingsPanel } from "./SettingsPanel";

type Tab = "requests" | "pricing" | "questionnaire" | "link" | "settings";
const TABS: { key: Tab; label: string }[] = [
  { key: "requests", label: "Demandes" },
  { key: "pricing", label: "Grille tarifaire" },
  { key: "questionnaire", label: "Questionnaire" },
  { key: "link", label: "Lien en bio" },
  { key: "settings", label: "Réglages" },
];

export type SaveSalon = (patch: Partial<Salon>) => Promise<string | null>;

const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function ProApp() {
  if (!configured) {
    return (
      <Splash message="Mode démo : l'espace lisseuse sera disponible une fois la base de données Supabase configurée (voir le README). Le parcours cliente fonctionne déjà sur /atelier-soie." />
    );
  }
  return <ProDashboard />;
}

function ProDashboard() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // Le salon est rattaché à l'utilisatrice qui l'a chargé, pour ne jamais afficher celui d'une session précédente.
  const [loaded, setLoaded] = useState<{ userId: string; salon: Salon | null; error: string | null } | null>(null);
  const [tab, setTab] = useState<Tab>("requests");
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getBrowserClient()
      .from("salons")
      .select("*")
      .eq("owner_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoaded({
          userId,
          salon: (data as Salon | null) ?? null,
          error: error ? "Impossible de charger ton salon." : null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const salon = loaded && loaded.userId === userId ? loaded.salon : undefined;

  const save: SaveSalon = useCallback(
    async (patch) => {
      if (!salon || !userId) return "Salon introuvable.";
      const { data, error } = await getBrowserClient().from("salons").update(patch).eq("id", salon.id).select("*").single();
      if (error) return "L'enregistrement a échoué. Réessaie.";
      setLoaded({ userId, salon: data as Salon, error: null });
      return null;
    },
    [salon, userId],
  );

  if (session === undefined) return <Splash />;
  if (session === null) return <Login />;
  if (loaded && loaded.userId === userId && loaded.error) return <Splash message={loaded.error} />;
  if (salon === undefined) return <Splash />;
  if (salon === null) {
    return <Onboarding userId={session.user.id} onCreated={(s) => setLoaded({ userId: session.user.id, salon: s, error: null })} />;
  }

  return (
    <div className="flex min-h-dvh flex-wrap bg-ground">
      <nav aria-label="Menu principal" className="flex max-w-full flex-[1_1_220px] flex-col gap-7 bg-ink px-[18px] py-7 text-ground">
        <div className="flex flex-col gap-1.5 px-1.5">
          <Wordmark className="text-[32px]" />
          <span className="text-[13px] font-semibold text-[#b7a597]">Espace pro · {salon.name}</span>
        </div>
        <div className="flex flex-col gap-1">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setTab(t.key)}
                className={`flex min-h-[46px] items-center justify-between gap-2 rounded-xl px-3.5 text-left text-[15px] ${
                  active ? "bg-[#3a302b] font-bold text-cream" : "font-semibold text-[#d9c9bc]"
                }`}
              >
                {t.label}
                {t.key === "requests" && newCount > 0 && (
                  <span className="rounded-[10px] bg-accent px-2 py-0.5 text-xs text-ink">{newCount}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-auto flex flex-col gap-3">
          <div className="flex flex-col gap-1.5 rounded-2xl bg-[#2c2420] p-4">
            <span className="text-xs font-extrabold tracking-wide text-[#b7a597]">TON LIEN EN BIO</span>
            <span className="break-all text-sm font-bold">/{salon.slug}</span>
          </div>
          <button
            type="button"
            onClick={() => getBrowserClient().auth.signOut()}
            className="min-h-11 rounded-xl px-3.5 text-left text-sm font-semibold text-[#b7a597] underline underline-offset-4"
          >
            Se déconnecter
          </button>
        </div>
      </nav>

      <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-6 px-5 py-8 sm:px-9">
        {tab === "requests" && <Requests salon={salon} onNewCount={setNewCount} />}
        {tab === "pricing" && <PricingEditor salon={salon} save={save} />}
        {tab === "questionnaire" && <Questionnaire salon={salon} save={save} />}
        {tab === "link" && <BioLink salon={salon} />}
        {tab === "settings" && <SettingsPanel salon={salon} save={save} />}
      </main>
    </div>
  );
}

function Splash({ message }: { message?: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Wordmark className="text-4xl" />
      <p className="text-body">{message ?? "Chargement…"}</p>
    </main>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await getBrowserClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/pro` },
    });
    setState(error ? "error" : "sent");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6">
      <Wordmark className="text-4xl" />
      <h1 className="font-serif text-4xl leading-tight">Ton espace lisseuse</h1>
      {state === "sent" ? (
        <p className="rounded-2xl bg-white p-5 leading-relaxed">
          C&apos;est envoyé ! Ouvre l&apos;e-mail reçu sur <strong>{email}</strong> et clique sur le lien pour te
          connecter. Pense à vérifier tes spams.
        </p>
      ) : (
        <form onSubmit={send} className="flex flex-col gap-4">
          <p className="text-body">Pas de mot de passe : on t&apos;envoie un lien de connexion par e-mail.</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[13px] font-bold">
              Ton e-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-[52px] rounded-[14px] border-[1.5px] border-line bg-white px-4 text-base"
            />
          </div>
          {state === "error" && (
            <p role="alert" className="text-sm font-semibold text-[#8a2f22]">
              L&apos;envoi a échoué. Vérifie ton adresse et réessaie.
            </p>
          )}
          <PrimaryButton type="submit" disabled={state === "sending"}>
            {state === "sending" ? "Envoi…" : "Recevoir mon lien de connexion"}
          </PrimaryButton>
        </form>
      )}
    </main>
  );
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

function Onboarding({ userId, onCreated }: { userId: string; onCreated: (s: Salon) => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [planity, setPlanity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const finalSlug = slugTouched ? slugify(slug) : slugify(name);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await getBrowserClient()
      .from("salons")
      .insert({ owner_id: userId, name: name.trim(), slug: finalSlug, planity_url: planity.trim() || null })
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      setError(error.code === "23505" ? "Ce lien est déjà pris, choisis-en un autre." : "La création a échoué. Réessaie.");
      return;
    }
    onCreated(data as Salon);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 py-10">
      <Wordmark className="text-4xl" />
      <h1 className="font-serif text-4xl leading-tight">Créons ton espace</h1>
      <form onSubmit={create} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="salon-name" className="text-[13px] font-bold">
            Nom de ton salon
          </label>
          <input id="salon-name" required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className="h-[52px] rounded-[14px] border-[1.5px] border-line bg-white px-4 text-base" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="salon-slug" className="text-[13px] font-bold">
            Ton lien
          </label>
          <div className="flex items-center gap-1 rounded-[14px] border-[1.5px] border-line bg-white pl-4">
            <span className="text-sm text-muted">devizia/</span>
            <input
              id="salon-slug"
              required
              value={slugTouched ? slug : finalSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              className="h-[49px] min-w-0 flex-1 rounded-r-[14px] px-1 text-base"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="salon-planity" className="text-[13px] font-bold">
            Ta page Planity (facultatif)
          </label>
          <input id="salon-planity" type="url" placeholder="https://www.planity.com/…" value={planity} onChange={(e) => setPlanity(e.target.value)} className="h-[52px] rounded-[14px] border-[1.5px] border-line bg-white px-4 text-base" />
        </div>
        <p className="text-sm text-muted">Une grille tarifaire d&apos;exemple est préremplie : tu pourras l&apos;adapter juste après.</p>
        {error && (
          <p role="alert" className="text-sm font-semibold text-[#8a2f22]">
            {error}
          </p>
        )}
        <PrimaryButton type="submit" disabled={busy || finalSlug.length < 2}>
          {busy ? "Création…" : "Créer mon espace"}
        </PrimaryButton>
      </form>
    </main>
  );
}
