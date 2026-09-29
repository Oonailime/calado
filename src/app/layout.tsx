import type { Metadata } from "next";
import { THEME_SCRIPT } from "@/features/story/theme";
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
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
