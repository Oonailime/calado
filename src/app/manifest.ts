import type { MetadataRoute } from "next";

// Lets a phone add the experience to its home screen and open it without the
// browser's bars: the only way to fill an iPhone's screen, as its Safari has
// no fullscreen API for pages (see features/story/fullscreen.tsx).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Emiliano Calado — Templo dos Três",
    short_name: "Templo dos Três",
    description: "Uma experiência interativa sobre Emiliano Calado e o Templo dos Três.",
    start_url: "/",
    // Android opens a home-screen app in real fullscreen; iOS takes standalone.
    display: "standalone",
    display_override: ["fullscreen", "standalone"],
    background_color: "#101b1a",
    theme_color: "#101b1a",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
