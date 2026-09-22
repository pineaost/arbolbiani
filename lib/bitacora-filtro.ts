import type { EntradaBitacoraConPersona } from "./bitacora";
import type { TipoEntradaBitacora } from "./supabase/types";
import { obtenerFamiliasDePersonas, type FamiliaPrincipalId } from "./familias";

export function filtrarEntradasBitacora(entradas: EntradaBitacoraConPersona[], filtros: {
  tipo: "todas" | TipoEntradaBitacora;
  personaId: string;
  familias: ReadonlySet<FamiliaPrincipalId>;
}): EntradaBitacoraConPersona[] {
  return entradas.filter(entrada => {
    if (filtros.tipo !== "todas" && entrada.tipo !== filtros.tipo) return false;
    if (filtros.personaId && entrada.persona_id !== filtros.personaId) return false;
    // Ninguna selección específica incluye también notas generales/sin familia.
    if (filtros.familias.size === 0) return true;
    // Hoy la FK admite una persona por entrada; nunca inferir del texto libre.
    const familias = obtenerFamiliasDePersonas(entrada.persona ? [entrada.persona] : []);
    return [...familias].some(familia => filtros.familias.has(familia));
  });
}
