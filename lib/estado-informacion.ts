// Clasificación interna del nivel de información disponible (Etapa 3).
//
// No es una validación ni una traba: nunca condiciona la creación de personas,
// relaciones familiares o su incorporación al árbol. Tampoco se muestra en
// Archivo Familiar como progreso o completitud; se conserva como dato derivado
// para una futura función de investigación que le dé un significado específico.

import type { NivelInformacion } from "@/lib/supabase/types";

export interface DatosNivelInformacion {
  fecha_nacimiento: string | null;
  lugar_nacimiento: string | null;
  fecha_fallecimiento: string | null;
  lugar_fallecimiento: string | null;
  notas: string | null;
  cantidad_documentos: number;
}

function datosBiograficosCompletos(datos: DatosNivelInformacion): boolean {
  const nacimientoCompleto =
    !!datos.fecha_nacimiento && !!datos.lugar_nacimiento;
  const sinIndicioDeFallecimiento =
    !datos.fecha_fallecimiento && !datos.lugar_fallecimiento;
  const fallecimientoCompleto =
    sinIndicioDeFallecimiento ||
    (!!datos.fecha_fallecimiento && !!datos.lugar_fallecimiento);

  return nacimientoCompleto && fallecimientoCompleto;
}

function tieneAlgunDatoBiografico(datos: DatosNivelInformacion): boolean {
  return (
    !!datos.fecha_nacimiento ||
    !!datos.lugar_nacimiento ||
    !!datos.fecha_fallecimiento ||
    !!datos.lugar_fallecimiento ||
    !!datos.notas?.trim()
  );
}

export function calcularNivelInformacion(
  datos: DatosNivelInformacion
): NivelInformacion {
  const tieneDocumentos = datos.cantidad_documentos > 0;

  if (datosBiograficosCompletos(datos) && tieneDocumentos) return "alto";
  if (tieneAlgunDatoBiografico(datos) || tieneDocumentos) return "medio";
  return "bajo";
}
