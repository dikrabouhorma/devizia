import Link from "next/link";
import { Wordmark } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-5 px-6">
      <Wordmark className="text-3xl" />
      <h1 className="font-serif text-4xl leading-tight">Ce salon est introuvable</h1>
      <p className="text-body">Vérifie le lien envoyé par ta lisseuse, ou demande-lui de te le renvoyer.</p>
      <Link href="/" className="font-bold underline underline-offset-4">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
