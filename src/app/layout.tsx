import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Emiliano Calado — Templo dos Três",
  description:
    "Uma experiência interativa sobre Emiliano Calado e o Templo dos Três.",
  robots: { index: false, follow: false }, // Pré-produção: habilitar SEO apenas na entrega final.
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
