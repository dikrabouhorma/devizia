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
On te donne 3 photos d'une cliente : de dos, de profil, et un gros plan des racines.
Tu évalues UNIQUEMENT ce qui est visible :
- length : où arrivent les pointes les plus longues quand les cheveux sont détachés, par rapport au corps (shoulders = épaules, shoulder_blades = omoplates, mid_back = milieu du dos, waist = taille, below_waist = au-delà de la taille) ;
- volume : la masse visible de la chevelure (fine, medium, dense) ;
- regrowth : repousses visibles aux racines, de couleur ou de texture différente des longueurs (none, light, visible) ;
- ends : l'état visible des pointes (healthy, slightly_dry, damaged).
Pour chaque critère, donne une confiance entre 0 et 1, honnête : baisse-la si la photo est floue, sombre, si les cheveux sont attachés, mouillés, coiffés au lisseur, ou partiellement cachés.
Mets usable à false si les photos ne permettent pas d'évaluer la longueur (pas de cheveux visibles, cheveux attachés, photo inexploitable) et explique le problème en une phrase courte, en français, adressée à la cliente avec « tu » dans issue. Sinon issue vaut null.
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
