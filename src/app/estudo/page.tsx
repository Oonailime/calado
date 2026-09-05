import { notFound } from "next/navigation";
import Studio from "@/features/studio/Studio";
export const dynamic = "force-dynamic";
export default function StudioPage() {
  // Ferramenta interna de pré-produção. Não constitui um menu público do portfólio.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_STUDIO !== "1"
  )
    notFound();
  return <Studio />;
}
