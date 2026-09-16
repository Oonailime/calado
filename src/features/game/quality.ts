import type { Quality } from "./state/store";

export const QUALITY_PROFILES: Record<
  Quality,
  {
    dpr: number | [number, number];
    shadow: false | "percentage" | "soft";
    shadowMapSize: 512 | 2048 | 4096;
    antialias: boolean;
    denseVegetation: boolean;
  }
> = {
  low: {
    dpr: 0.75,
    shadow: false,
    shadowMapSize: 512,
    antialias: false,
    denseVegetation: false,
  },
  medium: {
    dpr: 1,
    shadow: "percentage",
    shadowMapSize: 512,
    antialias: false,
    denseVegetation: false,
  },
  high: {
    dpr: [1, 1.5],
    shadow: "soft",
    shadowMapSize: 4096,
    antialias: true,
    denseVegetation: false,
  },
  ultra: {
    // Ultra spends its budget on the extra forest layer. Keeping the same
    // pixel ratio as High prevents vegetation and resolution from multiplying
    // each other's GPU cost on high-DPI screens.
    dpr: [1, 1.5],
    shadow: "soft",
    shadowMapSize: 4096,
    antialias: true,
    denseVegetation: true,
  },
};
