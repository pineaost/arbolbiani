// Regla de negocio para "nivel_informacion" (Etapa 3, revisada).
//
// IMPORTANTE — cambio de concepto respecto a la versión anterior:
// Este valor NO es un estado de validación ni una traba. Nunca bloquea
// ni condiciona la creación de personas, la creación de relaciones
// familiares, ni la incorporación de una persona al árbol. Es
// puramente un indicador visual/complementario del nivel de
// información disponible sobre una persona, pensado para mostrarse
// como un círculo, barra o gráfico de progreso en la ficha.
//
// Niveles:
// - "bajo": prácticamente solo hay nombre y apellido.
// - "medio": hay algún dato biográfico cargado (fechas, lugares,
//   notas) o algún documento asociado, pero no las dos cosas a la vez
//   de forma completa.
// - "alto": los datos biográficos están completos (nacimiento con
//   fecha y lugar; si figura como fallecida, también fecha y lugar de
//   fallecimiento) Y además hay al menos un documento asociado
//   (acta, PDF, etc.)
//
// Como el nivel "alto" depende de si hay documentos asociados —dato
// que vive en otra tabla (documento_persona)— esta función se mantiene
// pura (sin Supabase, sin efectos secundarios) y recibe ese dato como
// parámetro en vez de consultarlo ella misma. Quien la llama
// (typicamente /lib/personas.ts) es responsable de juntar los datos de
// la persona con el conteo de documentos antes de invocarla.

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

  if (datosBiograficosCompletos(datos) && tieneDocumentos) {
    return "alto";
  }

  if (tieneAlgunDatoBiografico(datos) || tieneDocumentos) {
    return "medio";
  }

  return "bajo";
}
