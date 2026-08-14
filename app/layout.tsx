import type { Metadata } from "next";
import { AppShell } from "@/components/nav/app-shell";
import "./globals.css";
import "family-chart/styles/family-chart.css";

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
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
