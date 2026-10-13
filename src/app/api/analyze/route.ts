import { NextResponse } from "next/server";
import { analyzeHair, AnalysisError, type PhotoInput } from "@/lib/analysis";
import { isDemoMode } from "@/lib/demo";
import { getAdminClient, getSalonBySlug } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KINDS = ["back", "profile", "roots"] as const;
const MAX_BYTES = 5 * 1024 * 1024;
const MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Reçoit les 3 photos de la cliente, les range dans le stockage privé du salon,
 * les fait analyser par l'IA et enregistre un brouillon côté serveur.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const slug = String(form.get("slug") ?? "");
  const salon = await getSalonBySlug(slug);
  if (!salon) return NextResponse.json({ error: "Salon introuvable." }, { status: 404 });

  const photos: (PhotoInput & { bytes: Buffer })[] = [];
  for (const kind of KINDS) {
    const file = form.get(kind);
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Il manque une photo." }, { status: 400 });
    }
    if (!MIME.has(file.type) || file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Format ou taille de photo non pris en charge." }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    photos.push({
      kind,
      mediaType: file.type as PhotoInput["mediaType"],
      base64: bytes.toString("base64"),
      bytes,
    });
  }

  const draftId = crypto.randomUUID();

  if (isDemoMode()) {
    // Démo : analyse réelle (ou simulée sans clé IA), mais aucune photo n'est conservée.
    try {
      const analysis = await analyzeHair(photos);
      return NextResponse.json({ draftId, analysis, demo: true });
    } catch (e) {
      console.error("analysis", e);
      const message = e instanceof AnalysisError ? e.message : "L'analyse n'a pas pu aboutir.";
      return NextResponse.json({ error: `${message} Réessaie dans un instant.` }, { status: 502 });
    }
  }

  const supabase = getAdminClient();
  const paths: string[] = [];
  for (const p of photos) {
    const ext = p.mediaType === "image/png" ? "png" : p.mediaType === "image/webp" ? "webp" : "jpg";
    const path = `${salon.id}/${draftId}/${p.kind}.${ext}`;
    const { error } = await supabase.storage.from("photos").upload(path, p.bytes, {
      contentType: p.mediaType,
      upsert: false,
    });
    if (error) {
      console.error("upload", error);
      return NextResponse.json({ error: "Impossible d'enregistrer les photos." }, { status: 500 });
    }
    paths.push(path);
  }

  let analysis;
  try {
    analysis = await analyzeHair(photos);
  } catch (e) {
    console.error("analysis", e);
    const message = e instanceof AnalysisError ? e.message : "L'analyse n'a pas pu aboutir.";
    return NextResponse.json({ error: `${message} Réessaie dans un instant.` }, { status: 502 });
  }

  const { error } = await supabase
    .from("drafts")
    .insert({ id: draftId, salon_id: salon.id, photo_paths: paths, analysis });
  if (error) {
    console.error("draft", error);
    return NextResponse.json({ error: "Impossible d'enregistrer l'analyse." }, { status: 500 });
  }

  return NextResponse.json({ draftId, analysis });
}
