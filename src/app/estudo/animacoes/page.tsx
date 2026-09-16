import { notFound } from "next/navigation";
import AnimationPreview from "@/features/studio/AnimationPreview";
import {
  isMonkeyMotion,
  type MonkeyMotion,
} from "@/features/game/characters/monkeyMotion";

export const dynamic = "force-dynamic";

export default async function AnimationPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ motion?: string }>;
}) {
  const { motion = "biped-walk" } = await searchParams;
  if (!isMonkeyMotion(motion)) notFound();
  return <AnimationPreview motion={motion as MonkeyMotion} />;
}
