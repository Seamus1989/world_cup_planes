import type { Metadata } from "next";
import { Archivo, Doto } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--ff-archivo",
  display: "swap",
});

const doto = Doto({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--ff-doto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gate to Glory",
  description: "A Planes World Cup 2026 sweepstake. 48 teams. One gate to glory.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${doto.variable}`}>
      <body>{children}</body>
    </html>
  );
}
