import Link from "next/link";
import { CameraIcon, Silhouette, SparkIcon, Wordmark } from "@/components/ui";

const STEPS = [
  {
    icon: <CameraIcon className="h-7 w-7" />,
    title: "Elle prend ses cheveux en photo",
    text: "3 photos guidées, depuis le lien dans ta bio Instagram.",
  },
  {
    icon: <SparkIcon className="h-7 w-7" />,
    title: "L'IA analyse, elle complète",
    text: "Longueur, volume, repousses, pointes, puis 4 précisions sur ce que la photo ne voit pas.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M4 10h16M9 3v4M15 3v4" />
      </svg>
    ),
    title: "Ton prix, son acompte",
    text: "Calculé avec ta grille, puis réservation avec acompte sur ton Planity. Fini les lapins.",
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-ink text-ground">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Wordmark className="text-4xl" />
        <Link href="/pro" className="rounded-full border-2 border-accent px-5 py-2.5 text-sm font-bold">
          Espace lisseuse
        </Link>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-5 pb-16 pt-6 sm:px-8 lg:pt-12">
        <section className="flex flex-wrap items-center gap-12">
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-7">
            <div className="flex flex-col gap-2 self-start">
              <p className="rounded-[28px] rounded-bl-md bg-[#3a302b] px-6 py-4 text-xl font-semibold text-[#d9c9bc] line-through decoration-accent decoration-[3px]">
                Coucou, c&apos;est combien un lissage ?
              </p>
              <span className="pl-2 text-sm font-semibold text-[#b7a597]">Le DM que tu reçois chaque jour.</span>
            </div>
            <h1 className="font-serif text-5xl leading-[0.98] tracking-tight sm:text-7xl">
              Et si ta cliente avait son prix <em className="text-[#e6c9a3]">avant</em> de t&apos;écrire ?
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-[#d9c9bc]">
              DevizIA analyse les cheveux de tes clientes en photo et calcule leur devis lissage avec tes tarifs.
              Tu reçois une demande complète, elle réserve avec acompte.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/pro" className="flex h-14 items-center rounded-full bg-ground px-7 text-base font-bold text-ink">
                Créer mon espace
              </Link>
              <Link href="/atelier-soie" className="flex h-14 items-center rounded-full border-2 border-[#3f3530] px-7 text-base font-bold">
                Voir la démo cliente
              </Link>
            </div>
          </div>

          <div className="mx-auto flex w-[300px] flex-none flex-col gap-4 rounded-[40px] bg-ground p-6 text-ink">
            <div className="relative flex h-[260px] items-end justify-center overflow-hidden rounded-3xl bg-sand">
              <Silhouette className="h-[250px] w-[170px]" />
              <span className="absolute left-3 top-4 rounded-xl bg-white px-3 py-1.5 text-xs font-bold">Milieu du dos</span>
              <span className="absolute right-3 top-28 rounded-xl bg-white px-3 py-1.5 text-xs font-bold">Volume moyen</span>
            </div>
            <span className="text-sm font-bold text-muted">Ton estimation</span>
            <span className="font-serif text-5xl leading-none">195 – 215 €</span>
            <span className="flex h-12 items-center justify-center rounded-full bg-ink text-sm font-bold text-cream">
              Réserver · acompte
            </span>
          </div>
        </section>

        <section aria-labelledby="how" className="flex flex-col gap-6">
          <h2 id="how" className="font-serif text-4xl">
            Comment ça marche
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.title} className="flex flex-col gap-4 rounded-[30px] bg-[#2c2420] p-7">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-ink">{s.icon}</span>
                <h3 className="text-2xl font-extrabold leading-tight">{s.title}</h3>
                <p className="leading-relaxed text-[#cbb9ab]">{s.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-[#3f3530] px-5 py-8 text-sm text-[#b7a597] sm:px-8">
        <span>DevizIA · lisseuses d&apos;Île-de-France · accès anticipé</span>
        <span>Les photos des clientes sont privées et supprimées après 90 jours.</span>
      </footer>
    </div>
  );
}
