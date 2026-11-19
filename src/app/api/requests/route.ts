import { NextResponse } from "next/server";
import { z } from "zod";
import { COLORINGS, ENDS, LENGTHS, PREVIOUS, REGROWTH, VOLUMES, type HairAnalysis } from "@/lib/domain";
import { HairAnalysisSchema } from "@/lib/analysis";
import { isDemoMode } from "@/lib/demo";
import { computeQuote } from "@/lib/pricing";
import { getAdminClient, getSalonBySlug } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const keys = (list: readonly { key: string }[]) => list.map((x) => x.key) as [string, ...string[]];

const Body = z.object({
  slug: z.string().min(1),
  draftId: z.uuid(),
  treatment: z.string().min(1),
  corrections: z
    .object({
      length: z.enum(keys(LENGTHS)).optional(),
      volume: z.enum(keys(VOLUMES)).optional(),
      regrowth: z.enum(keys(REGROWTH)).optional(),
      ends: z.enum(keys(ENDS)).optional(),
    })
    .default({}),
  answers: z.object({
    nature: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    nature_subtype: z.enum(["A", "B", "C"]).nullable(),
    coloring: z.enum(keys(COLORINGS)),
    previous_straightening: z.enum(keys(PREVIOUS)),
    henna: z.boolean(),
  }),
  contact: z.object({
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    phone: z
      .string()
      .trim()
      .max(30)
      .refine((v) => v.replace(/\D/g, "").length >= 10, "Numéro de téléphone incomplet."),
    email: z.email().max(120),
  }),
  consent: z.literal(true),
  // Utilisé uniquement en mode démo (sans base de données) ; ignoré sinon.
  analysis: z.unknown().optional(),
});

/**
 * Crée la demande de devis : le prix est recalculé ici, côté serveur,
 * à partir de la grille du salon et de l'analyse IA enregistrée dans le brouillon.
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Certaines informations sont manquantes ou invalides." }, { status: 400 });
  }
  const body = parsed.data;

  const salon = await getSalonBySlug(body.slug);
  if (!salon) return NextResponse.json({ error: "Salon introuvable." }, { status: 404 });

  if (isDemoMode()) {
    // Démo : on calcule le devis à partir de l'analyse renvoyée par le navigateur, sans rien enregistrer.
    const demoAnalysis = HairAnalysisSchema.safeParse(body.analysis);
    if (!demoAnalysis.success) {
      return NextResponse.json({ error: "Analyse manquante, recommence ton diagnostic." }, { status: 400 });
    }
    const a = demoAnalysis.data as HairAnalysis;
    const length = (body.corrections.length ?? a.length) as HairAnalysis["length"];
    const volume = (body.corrections.volume ?? a.volume) as HairAnalysis["volume"];
    try {
      const quote = computeQuote(salon, { treatment: body.treatment, length, volume, answers: body.answers as never });
      return NextResponse.json({
        requestId: null,
        quote,
        length,
        volume,
        deposit: salon.deposit,
        planityUrl: salon.planity_url,
        demo: true,
      });
    } catch {
      return NextResponse.json({ error: "Ce lissage n'est pas proposé par le salon." }, { status: 400 });
    }
  }

  const supabase = getAdminClient();
  const { data: draft, error: draftError } = await supabase
    .from("drafts")
    .select("id, salon_id, photo_paths, analysis")
    .eq("id", body.draftId)
    .maybeSingle();
  if (draftError) {
    console.error("draft", draftError);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
  if (!draft || draft.salon_id !== salon.id) {
    return NextResponse.json({ error: "Analyse introuvable, recommence ton diagnostic." }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("quote_requests")
    .select("id")
    .eq("draft_id", draft.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Cette demande a déjà été envoyée." }, { status: 409 });
  }

  const analysis = draft.analysis as HairAnalysis;
  const length = (body.corrections.length ?? analysis.length) as HairAnalysis["length"];
  const volume = (body.corrections.volume ?? analysis.volume) as HairAnalysis["volume"];

  let quote;
  try {
    quote = computeQuote(salon, {
      treatment: body.treatment,
      length,
      volume,
      answers: body.answers as never,
    });
  } catch {
    return NextResponse.json({ error: "Ce lissage n'est pas proposé par le salon." }, { status: 400 });
  }

  const { data: created, error } = await supabase
    .from("quote_requests")
    .insert({
      salon_id: salon.id,
      draft_id: draft.id,
      first_name: body.contact.firstName,
      last_name: body.contact.lastName,
      phone: body.contact.phone,
      email: body.contact.email,
      treatment: body.treatment,
      answers: body.answers,
      analysis,
      corrections: body.corrections,
      blocked: quote.blocked,
      price_low: quote.blocked ? null : quote.low,
      price_high: quote.blocked ? null : quote.high,
      breakdown: quote.lines,
      photo_paths: draft.photo_paths,
      consent_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.error("request", error);
    return NextResponse.json({ error: "Impossible d'envoyer ta demande." }, { status: 500 });
  }

  return NextResponse.json({
    requestId: created.id,
    quote,
    length,
    volume,
    deposit: salon.deposit,
    planityUrl: salon.planity_url,
  });
}
