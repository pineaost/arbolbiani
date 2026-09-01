import type { Metadata } from "next";
import { Libre_Bodoni } from "next/font/google";
import "./globals.css";
import "family-chart/styles/family-chart.css";

const libreBodoni = Libre_Bodoni({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Árbol Biani",
  description: "Árbol genealógico interactivo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={libreBodoni.variable}>{children}</body>
    </html>
  );
}
