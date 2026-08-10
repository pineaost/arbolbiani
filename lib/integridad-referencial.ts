// Política de integridad referencial (Etapa 2).
//
// Decisión de diseño: BLOQUEAR el borrado de una persona si tiene vínculos
// registrados, en vez de borrar en cascada. Es la opción más segura para
// un archivo genealógico: nunca se pierde información de vínculos por
// accidente al borrar una persona.
//
// Este archivo NO es "use server" porque no expone server actions (recibe
// el cliente de Supabase como parámetro); lo importan los archivos que sí
// lo son, como personas-actions.ts.
//
// Arquitectura preparada para Documentos y Bitácora: cuando esas tablas
// existan y tengan persona_id, alcanza con agregar una entrada al arreglo
// `verificacionesVinculoPersona` de abajo. No hace falta tocar
// personas-actions.ts ni la lógica de eliminarPersona.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface VerificacionVinculo {
  etiqueta: string;
  contar: (supabase: SupabaseClient, personaId: string) => Promise<number>;
}

async function contarVinculosFamiliares(
  supabase: SupabaseClient,
  personaId: string
): Promise<number> {
  const { count: countFiliacion, error: errorFiliacion } = await supabase
    .from("relaciones_filiacion")
    .select("id", { count: "exact", head: true })
    .or(`padre_id.eq.${personaId},hijo_id.eq.${personaId}`);

  if (errorFiliacion) throw errorFiliacion;

  const { count: countConyuge, error: errorConyuge } = await supabase
    .from("relaciones_conyuge")
    .select("id", { count: "exact", head: true })
    .or(`persona1_id.eq.${personaId},persona2_id.eq.${personaId}`);

  if (errorConyuge) throw errorConyuge;

  return (countFiliacion ?? 0) + (countConyuge ?? 0);
}

export const verificacionesVinculoPersona: VerificacionVinculo[] = [
  {
    etiqueta: "padres, hijos o cónyuges",
    contar: contarVinculosFamiliares,
  },
  // Próximamente, cuando existan las tablas correspondientes:
  // { etiqueta: "documentos asociados", contar: contarDocumentos },
  // { etiqueta: "entradas de bitácora", contar: contarEntradasBitacora },
];

export async function personaTieneVinculos(
  supabase: SupabaseClient,
  personaId: string
): Promise<{ tieneVinculos: boolean; detalle: string[] }> {
  const detalle: string[] = [];

  for (const verificacion of verificacionesVinculoPersona) {
    const cantidad = await verificacion.contar(supabase, personaId);
    if (cantidad > 0) detalle.push(verificacion.etiqueta);
  }

  return { tieneVinculos: detalle.length > 0, detalle };
}
