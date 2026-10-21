import type { Metadata } from "next";
import { Hanken_Grotesk, Libre_Caslon_Text } from "next/font/google";
import { LibraryProvider } from "@/lib/store/LibraryProvider";
import "./globals.css";

/* ---------------------------------------------------------------
   Las dos familias de la identidad visual: Libre Caslon Text para
   titulos y Hanken Grotesk para texto, labels y botones.
   --------------------------------------------------------------- */

const caslon = Libre_Caslon_Text({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--fuente-caslon",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fuente-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: "UADEnet · Biblioteca Universitaria",
  description:
    "Portal de la Biblioteca Universitaria de UADE: catálogo, préstamos, devoluciones y sanciones.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${caslon.variable} ${hanken.variable}`}>
      <body>
        <LibraryProvider>{children}</LibraryProvider>
      </body>
    </html>
  );
}
