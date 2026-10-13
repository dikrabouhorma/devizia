import type { Metadata } from "next";
import { ProApp } from "@/components/pro/ProApp";

export const metadata: Metadata = {
  title: "Espace lisseuse · DevizIA",
  robots: { index: false },
};

export default function ProPage() {
  return <ProApp />;
}
