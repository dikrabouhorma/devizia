import type { Salon } from "./domain";

/**
 * Mode démo : actif tant que Supabase n'est pas configuré.
 * Le parcours cliente fonctionne en entier sur /atelier-soie (avec la vraie IA si une clé
 * Anthropic est présente), mais rien n'est enregistré ni envoyé à une lisseuse.
 */
export const isDemoMode = () => !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL;

export const DEMO_SALON: Salon = {
  id: "00000000-0000-4000-8000-000000000000",
  owner_id: null,
  slug: "atelier-soie",
  name: "Atelier Soie",
  planity_url: "https://www.planity.com",
  deposit: 30,
  range_width: 20,
  treatments: [
    { key: "tanin", name: "Tanin", description: "Lisse naturel et brillant", enabled: true },
    { key: "keratine", name: "Kératine", description: "Discipline et anti-frisottis", enabled: true },
    { key: "botox", name: "Botox capillaire", description: "Soin profond, effet lissé", enabled: true },
  ],
  grid: {
    tanin: [120, 140, 160, 190, 220],
    keratine: [130, 150, 170, 200, 230],
    botox: [90, 110, 130, 160, 190],
  },
  supplements: { volume_medium: 15, volume_dense: 30, curly: 15, coily: 30, bleach: 20 },
  settings: { notify_email: true, reminder: true, block_henna: true, auto_send: false },
  created_at: "2026-10-13T00:00:00.000Z",
};
