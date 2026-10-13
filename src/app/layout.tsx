import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Polices auto-hébergées (licence SIL OFL) : aucun appel à Google Fonts depuis le navigateur des clientes.
const manrope = localFont({
  variable: "--font-manrope",
  src: "./fonts/manrope-latin-variable.woff2",
  weight: "200 800",
  display: "swap",
});

const instrument = localFont({
  variable: "--font-instrument",
  src: [
    { path: "./fonts/instrument-serif-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-latin-italic.woff2", weight: "400", style: "italic" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DevizIA · Ton devis lissage en 2 minutes",
  description:
    "Diagnostic capillaire par IA et devis lissage calculé avec les tarifs de ta lisseuse.",
};

export const viewport: Viewport = {
  themeColor: "#f4ebe3",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${manrope.variable} ${instrument.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
