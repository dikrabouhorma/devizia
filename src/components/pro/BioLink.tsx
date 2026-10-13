"use client";

import { useState, useSyncExternalStore } from "react";
import type { Salon } from "@/lib/domain";

const noopSubscribe = () => () => {};

export function BioLink({ salon }: { salon: Salon }) {
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
  const [copied, setCopied] = useState<"link" | "bio" | null>(null);

  const link = `${origin}/${salon.slug}`;
  const names = salon.treatments.filter((t) => t.enabled).map((t) => t.name.toLowerCase());
  const bio = `Lissage ${names.join(" · ")}\nTon devis en 2 min avec notre diagnostic IA\nPhotos + prix + réservation ↓`;

  async function copy(text: string, what: "link" | "bio") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[44px] leading-none">Lien en bio</h1>
        <p className="max-w-2xl text-[15px] text-body">
          Colle ce lien dans ta bio Instagram, ta story à la une ou ta réponse automatique Snapchat.
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
          <div className="flex flex-col gap-3.5 rounded-[22px] bg-white p-6">
            <span className="text-xs font-extrabold tracking-wide text-muted">TON LIEN</span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-[1_1_200px] break-all text-xl font-extrabold">{link}</span>
              <button type="button" onClick={() => copy(link, "link")} className="h-12 rounded-full bg-ink px-5 text-[15px] font-bold text-cream">
                {copied === "link" ? "Copié" : "Copier le lien"}
              </button>
            </div>
            <a href={`/${salon.slug}`} target="_blank" rel="noopener noreferrer" className="self-start text-sm font-bold underline underline-offset-4">
              Ouvrir ma page comme une cliente
            </a>
          </div>
          <div className="flex flex-col gap-2.5 rounded-[22px] bg-white p-6">
            <span className="text-xs font-extrabold tracking-wide text-muted">BIO SUGGÉRÉE</span>
            <p className="whitespace-pre-line text-base leading-relaxed">{bio}</p>
            <button type="button" onClick={() => copy(bio, "bio")} className="h-11 self-start rounded-full border-[1.5px] border-line px-4 text-sm font-bold">
              {copied === "bio" ? "Copié" : "Copier la bio"}
            </button>
          </div>
        </div>
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-3.5 rounded-[22px] bg-ink p-6 text-ground">
          <span className="text-xs font-extrabold tracking-wide text-[#b7a597]">CE QUE VOIT TA CLIENTE</span>
          <span className="font-serif text-[34px] leading-tight">
            Ton devis lissage en <em>2 minutes</em>, par l&apos;IA.
          </span>
          <span className="text-sm leading-relaxed text-[#d9c9bc]">
            Elle choisit son lissage, prend 3 photos guidées, répond à 4 précisions et reçoit son prix calculé avec ta
            grille.
          </span>
        </div>
      </div>
    </div>
  );
}
