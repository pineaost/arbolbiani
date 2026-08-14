// Política de integridad referencial.
//
// Bloquea borrar una persona cuando conserva vínculos familiares o documentos,
// para evitar que una eliminación accidental deje registros o archivos huérfanos.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface VerificacionVinculo {
  etiqueta: string;
  contar: (supabase: SupabaseClient, personaId: string) => Promise<number>;
}

export interface DependenciasPersona {
  vinculosFamiliares: number;
  documentos: number;
  entradasBitacora: number;
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

async function contarDocumentos(
  supabase: SupabaseClient,
  personaId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("documento_persona")
    .select("documento_id", { count: "exact", head: true })
    .eq("persona_id", personaId);
  if (error) throw error;
  return count ?? 0;
}

async function contarEntradasBitacora(
  supabase: SupabaseClient,
  personaId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("bitacora")
    .select("id", { count: "exact", head: true })
    .eq("persona_id", personaId);
  if (error) throw error;
  return count ?? 0;
}

export const verificacionesVinculoPersona: VerificacionVinculo[] = [
  {
    etiqueta: "padres, hijos o cónyuges",
    contar: contarVinculosFamiliares,
  },
  {
    etiqueta: "documentos asociados",
    contar: contarDocumentos,
  },
];

export async function personaTieneVinculos(
  supabase: SupabaseClient,
  personaId: string
): Promise<{
  tieneVinculos: boolean;
  detalle: string[];
  dependencias: DependenciasPersona;
}> {
  const [vinculosFamiliares, documentos, entradasBitacora] = await Promise.all([
    contarVinculosFamiliares(supabase, personaId),
    contarDocumentos(supabase, personaId),
    contarEntradasBitacora(supabase, personaId),
  ]);
  const detalle: string[] = [];

  if (vinculosFamiliares > 0) detalle.push("padres, hijos o cónyuges");
  if (documentos > 0) detalle.push("documentos asociados");

  return {
    tieneVinculos: detalle.length > 0,
    detalle,
    dependencias: { vinculosFamiliares, documentos, entradasBitacora },
  };
}
