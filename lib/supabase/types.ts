// Tipos que reflejan el modelo de datos de la Especificación Funcional v1.0.
// La interfaz consume estos tipos pero nunca contiene lógica de negocio:
// esa lógica vive en /lib.

export type Genero = "masculino" | "femenino" | "no_definido";

// Nivel de información disponible sobre una persona (Etapa 3, revisado).
// Es puramente informativo — pensado para mostrarse como un círculo,
// barra o gráfico de progreso en la ficha — y NUNCA bloquea la creación
// de personas, relaciones ni su incorporación al árbol.
// Ver /lib/estado-informacion.ts para la regla de cálculo.
export type NivelInformacion = "bajo" | "medio" | "alto";

export interface Persona {
  id: string;
  nombre: string;
  apellido: string;
  genero: Genero;
  fecha_nacimiento: string | null;
  lugar_nacimiento: string | null;
  fecha_fallecimiento: string | null;
  lugar_fallecimiento: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

// Persona con su nivel de información ya calculado. No es una columna en
// la base: se arma en la capa de aplicación porque depende también de si
// hay documentos asociados. Ver adjuntarNivelInformacion en /lib/personas.ts.
export interface PersonaConNivel extends Persona {
  nivel_informacion: NivelInformacion;
}

export interface RelacionFiliacion {
  id: string;
  padre_id: string;
  hijo_id: string;
  created_at: string;
}

export interface RelacionConyuge {
  id: string;
  persona1_id: string;
  persona2_id: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  notas: string | null;
  created_at: string;
}

export interface FiliacionInput {
  padre_id: string;
  hijo_id: string;
}

export interface ConyugeInput {
  persona1_id: string;
  persona2_id: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  notas: string | null;
}

export type TipoDocumento = "nacimiento" | "matrimonio" | "defuncion" | "otro";

export interface Documento {
  id: string;
  tipo: TipoDocumento;
  titulo: string;
  descripcion: string | null;
  archivo_url: string | null;
  fecha_documento: string | null;
  created_at: string;
  updated_at: string;
}

export type TipoEntradaBitacora =
  | "nota"
  | "hipotesis"
  | "duda"
  | "hallazgo"
  | "tarea_pendiente"
  | "documento_pendiente";

export type EstadoBitacora = "abierta" | "resuelta";

export interface EntradaBitacora {
  id: string;
  tipo: TipoEntradaBitacora;
  contenido: string;
  persona_id: string | null;
  estado: EstadoBitacora;
  created_at: string;
  updated_at: string;
}

// Vista compuesta que usa el Árbol: una persona con sus vínculos ya
// resueltos y su nivel de información.
export interface PersonaConVinculos extends PersonaConNivel {
  padres: Persona[];
  hijos: Persona[];
  conyuges: Persona[];
}

// Datos de presentación para la ficha individual. Conservan el id del
// vínculo para que se pueda administrar una relación concreta sin que la UI
// tenga que inferirla a partir de dos personas.
export interface VinculoFiliacionFicha extends RelacionFiliacion {
  persona: Persona;
}

export interface VinculoConyugeFicha extends RelacionConyuge {
  conyuge: Persona;
}

export interface PersonaFicha extends PersonaConNivel {
  padres: VinculoFiliacionFicha[];
  hijos: VinculoFiliacionFicha[];
  conyuges: VinculoConyugeFicha[];
  documentos: Documento[];
  entradas_bitacora: EntradaBitacora[];
}

// Forma de lectura para el mapa del Árbol. Los hermanos se derivan de la
// filiación compartida; no existe una tabla ni una relación propia para ellos.
export interface PersonaArbol extends Persona {
  padres_ids: string[];
  hijos_ids: string[];
  conyuges_ids: string[];
  hermanos_ids: string[];
}
