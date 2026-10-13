import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuoteFlow } from "@/components/quote/QuoteFlow";
import { toPublicSalon } from "@/lib/domain";
import { getSalonBySlug } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const salon = await getSalonBySlug(slug);
  return {
    title: salon ? `Devis lissage · ${salon.name}` : "DevizIA",
    description: "Ton devis lissage en 2 minutes, par l'IA.",
  };
}

export default async function SalonPage(props: PageProps<"/[slug]">) {
  const { slug } = await props.params;
  const salon = await getSalonBySlug(slug);
  if (!salon) notFound();

  const publicSalon = toPublicSalon(salon);
  return <QuoteFlow salon={publicSalon} />;
}
