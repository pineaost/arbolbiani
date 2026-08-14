import { createClient } from "@/lib/supabase/server";
import type { EntradaBitacora, Persona } from "@/lib/supabase/types";

export interface EntradaBitacoraConPersona extends EntradaBitacora { persona: Pick<Persona, "id" | "nombre" | "apellido"> | null; }

export async function getEntradasBitacora(personaId?: string): Promise<EntradaBitacoraConPersona[]> {
  const supabase = await createClient();
  let consulta = supabase.from("bitacora").select("*, persona:persona_id(id, nombre, apellido)").order("updated_at", { ascending: false });
  if (personaId) consulta = consulta.eq("persona_id", personaId);
  const { data, error } = await consulta;
  if (error) { console.error("Error al obtener Bitácora:", error.message); throw new Error("No se pudo cargar la Bitácora."); }
  return (data ?? []) as unknown as EntradaBitacoraConPersona[];
}
