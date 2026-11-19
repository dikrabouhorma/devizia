import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ENDS, LENGTHS, REGROWTH, VOLUMES, type HairAnalysis } from "./domain";

export type PhotoInput = { kind: "back" | "profile" | "roots"; mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string };

const PHOTO_LABELS: Record<PhotoInput["kind"], string> = {
  back: "Photo 1 — de dos, cheveux détachés",
  profile: "Photo 2 — de profil",
  roots: "Photo 3 — gros plan des racines",
};

const SYSTEM_PROMPT = `Tu es l'outil de pré-diagnostic capillaire de DevizIA, utilisé par des lisseuses professionnelles pour établir un devis de lissage.
On te donne 3 photos d'une cliente, prises au téléphone, souvent par elle-même : de dos, de profil, et un gros plan des racines.
Utilise les trois photos ensemble : la photo de dos est la référence pour la longueur et le volume, le profil sert à confirmer la longueur et l'épaisseur de la masse, le gros plan sert aux repousses et à l'aspect de la fibre.

Tu évalues UNIQUEMENT ce qui est visible :
- length : où arrivent les pointes les plus longues, cheveux détachés, par rapport au corps. Repères :
  shoulders = pointes au niveau des épaules ou des clavicules ;
  shoulder_blades = pointes entre le haut et le bas des omoplates ;
  mid_back = pointes au milieu du dos, sous les omoplates, au-dessus de la taille ;
  waist = pointes au creux de la taille ;
  below_waist = pointes sous la taille.
  Si les pointes sont entre deux repères, choisis le plus proche et baisse un peu la confiance.
- volume : la masse visible de la chevelure, sur toute sa longueur (fine, medium, dense) ;
- regrowth : repousses visibles aux racines, de couleur ou de texture différente des longueurs (none, light, visible) ;
- ends : l'état visible des pointes, sur le dos et le gros plan (healthy, slightly_dry, damaged).

Confiance : pour chaque critère, un nombre entre 0 et 1 qui reflète ce que tu vois réellement, sans prudence excessive.
- 0,85 à 1 : le critère est clairement lisible (pour la longueur : on voit les pointes ET au moins un repère du corps) ;
- 0,7 à 0,85 : lisible, avec une petite hésitation (par exemple entre deux catégories voisines) ;
- 0,4 à 0,7 : partiellement visible (pointes en partie cachées, cheveux en partie devant, lumière faible) ;
- moins de 0,4 : pratiquement pas visible.
Un cadrage imparfait ne justifie pas une confiance basse si le critère reste lisible.

Mets usable à false seulement si les photos ne permettent pas du tout d'évaluer la longueur (pas de cheveux visibles, cheveux attachés, image qui n'est pas une vraie photo de cheveux) et explique le problème en une phrase courte, en français, adressée à la cliente avec « tu », dans issue. Sinon issue vaut null.
N'invente rien d'autre : pas de diagnostic médical, pas de commentaire sur la personne.`;

const enumOf = (list: readonly { key: string }[]) => list.map((x) => x.key);

const JSON_SCHEMA = {
  type: "object",
  properties: {
    usable: { type: "boolean" },
    issue: { type: ["string", "null"] },
    length: { type: "string", enum: enumOf(LENGTHS) },
    length_confidence: { type: "number" },
    volume: { type: "string", enum: enumOf(VOLUMES) },
    volume_confidence: { type: "number" },
    regrowth: { type: "string", enum: enumOf(REGROWTH) },
    regrowth_confidence: { type: "number" },
    ends: { type: "string", enum: enumOf(ENDS) },
    ends_confidence: { type: "number" },
  },
  required: [
    "usable",
    "issue",
    "length",
    "length_confidence",
    "volume",
    "volume_confidence",
    "regrowth",
    "regrowth_confidence",
    "ends",
    "ends_confidence",
  ],
  additionalProperties: false,
} as const;

const confidence = z.number().transform((n) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0)));

export const HairAnalysisSchema = z.object({
  usable: z.boolean(),
  issue: z.string().nullable(),
  length: z.enum(enumOf(LENGTHS) as [string, ...string[]]),
  length_confidence: confidence,
  volume: z.enum(enumOf(VOLUMES) as [string, ...string[]]),
  volume_confidence: confidence,
  regrowth: z.enum(enumOf(REGROWTH) as [string, ...string[]]),
  regrowth_confidence: confidence,
  ends: z.enum(enumOf(ENDS) as [string, ...string[]]),
  ends_confidence: confidence,
});

export class AnalysisError extends Error {}

export const isMockMode = () => process.env.AI_MOCK === "true" || !process.env.ANTHROPIC_API_KEY;

/** Analyse simulée, utilisée sans clé API (démo, développement). */
function mockAnalysis(): HairAnalysis {
  return {
    usable: true,
    issue: null,
    length: "mid_back",
    length_confidence: 0.96,
    volume: "medium",
    volume_confidence: 0.87,
    regrowth: "light",
    regrowth_confidence: 0.84,
    ends: "slightly_dry",
    ends_confidence: 0.8,
    mock: true,
  };
}

export async function analyzeHair(photos: PhotoInput[]): Promise<HairAnalysis> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 1200));
    return mockAnalysis();
  }

  const client = new Anthropic();
  const content: Anthropic.ContentBlockParam[] = [];
  for (const p of photos) {
    content.push({ type: "text", text: PHOTO_LABELS[p.kind] });
    content.push({ type: "image", source: { type: "base64", media_type: p.mediaType, data: p.base64 } });
  }
  content.push({ type: "text", text: "Analyse ces photos et réponds au format demandé." });

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: JSON_SCHEMA } },
  });

  if (response.stop_reason === "refusal") {
    throw new AnalysisError("L'analyse a été refusée pour ces photos.");
  }
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new AnalysisError("Réponse vide de l'IA.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(block.text);
  } catch {
    throw new AnalysisError("Réponse illisible de l'IA.");
  }
  const result = HairAnalysisSchema.safeParse(parsed);
  if (!result.success) throw new AnalysisError("Réponse inattendue de l'IA.");
  return result.data as HairAnalysis;
}
