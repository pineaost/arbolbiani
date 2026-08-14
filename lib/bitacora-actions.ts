"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TipoEntradaBitacora } from "@/lib/supabase/types";

export interface EntradaBitacoraInput { tipo: TipoEntradaBitacora; contenido: string; persona_id: string | null; }
const tipos: TipoEntradaBitacora[] = ["nota", "hipotesis", "duda", "hallazgo", "tarea_pendiente", "documento_pendiente"];
function validar(input: EntradaBitacoraInput) { if (!tipos.includes(input.tipo)) return "El tipo de entrada no es válido."; if (!input.contenido.trim()) return "El contenido de la entrada es obligatorio."; return null; }
function revalidar() { revalidatePath("/bitacora"); revalidatePath("/archivo"); revalidatePath("/archivo/[id]", "page"); }

export async function crearEntradaBitacora(input: EntradaBitacoraInput) {
  const errorValidacion = validar(input); if (errorValidacion) return { error: errorValidacion };
  const { error } = await (await createClient()).from("bitacora").insert({ ...input, contenido: input.contenido.trim(), persona_id: input.persona_id || null });
  if (error) { console.error("Error al crear entrada:", error.message); return { error: "No se pudo guardar la entrada." }; }
  revalidar(); return { error: null };
}
export async function actualizarEntradaBitacora(id: string, input: EntradaBitacoraInput) {
  const errorValidacion = validar(input); if (errorValidacion) return { error: errorValidacion };
  const { error } = await (await createClient()).from("bitacora").update({ ...input, contenido: input.contenido.trim(), persona_id: input.persona_id || null }).eq("id", id);
  if (error) { console.error("Error al editar entrada:", error.message); return { error: "No se pudo actualizar la entrada." }; }
  revalidar(); return { error: null };
}
export async function eliminarEntradaBitacora(id: string) {
  const { error } = await (await createClient()).from("bitacora").delete().eq("id", id);
  if (error) { console.error("Error al eliminar entrada:", error.message); return { error: "No se pudo eliminar la entrada." }; }
  revalidar(); return { error: null };
}
