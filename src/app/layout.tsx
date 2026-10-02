import type { Metadata, Viewport } from "next";
import { THEME_SCRIPT } from "@/features/story/theme";
import "./globals.css";
export const metadata: Metadata = {
  title: "Emiliano Calado — Templo dos Três",
  description:
    "Uma experiência interativa sobre Emiliano Calado e o Templo dos Três.",
  robots: { index: false, follow: false }, // Pré-produção: habilitar SEO apenas na entrega final.
  // Opened from the home screen (app/manifest.ts), the page runs without
  // Safari's bars; the status bar lies over it, kept clear by safe-area insets.
  appleWebApp: { capable: true, title: "Templo dos Três", statusBarStyle: "black-translucent" },
};
// Draw under a phone's notch and rounded corners; the story and the game keep
// their text and controls inside env(safe-area-inset-*).
export const viewport: Viewport = { viewportFit: "cover" };
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
