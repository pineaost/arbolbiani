import type { Metadata } from "next";
import { Handlee } from "next/font/google";
import { AppShell } from "@/components/nav/app-shell";
import "./globals.css";
import "family-chart/styles/family-chart.css";

const handlee = Handlee({
  subsets: ["latin"],
  weight: "400",
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
      <body className={handlee.variable}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
