import { notFound } from "next/navigation";
import { PersonaFichaClient } from "@/components/archivo/persona-ficha-client";
import { getPersonas } from "@/lib/personas";
import { getPersonaFicha } from "@/lib/relaciones";

export default async function PersonaPage({ params }: { params: { id: string } }) {
  const [persona, personas] = await Promise.all([
    getPersonaFicha(params.id),
    getPersonas(),
  ]);

  if (!persona) notFound();

  return <PersonaFichaClient persona={persona} personas={personas} />;
}
