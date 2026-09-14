import type { PersonaArbol } from "./supabase/types";
export const GEOMETRIA_ARBOL = {
  anchoNodo: 176, altoNodo: 92, separacionVertical: 172,
  separacionPareja: 20, separacionEntreHermanos: 40,
  separacionUnidadesFamiliares: 80, separacionComponentes: 240,
  margenMapa: 72, separacionCarriles: 12,
} as const;
export interface FamiliaArbol {
  id: string;
  progenitores: string[];
  hijos: string[];
}

export interface ComponenteArbol {
  ids: string[];
  raicesAncestrales: string[];
}

export type CodigoProblemaArbol =
  | "persona-duplicada"
  | "referencia-ausente"
  | "auto-referencia-filiacion"
  | "auto-referencia-conyugal"
  | "mas-de-dos-progenitores"
  | "ciclo-filiacion";

export interface ProblemaArbol {
  codigo: CodigoProblemaArbol;
  ids: string[];
  detalle: string;
}

export interface ModeloArbol {
  personas: Map<string, PersonaArbol>;
  padresPorHijo: Map<string, Set<string>>;
  hijosPorPadre: Map<string, Set<string>>;
  conyugesPorPersona: Map<string, Set<string>>;
  familias: FamiliaArbol[];
  componentes: ComponenteArbol[];
  problemas: ProblemaArbol[];
}


export interface VinculoVisualConyugalArbol {
  id: string;
  tipo: "conyugal";
  origenId: string;
  destinoId: string;
}

export interface VinculoVisualUnionFamiliarArbol {
  id: string;
  tipo: "union-familiar";
  familiaId: string;
  progenitoresIds: string[];
  hijosIds: string[];
}

export type VinculoVisualArbol = VinculoVisualConyugalArbol | VinculoVisualUnionFamiliarArbol;

export interface NodoPosicionadoArbol {
  data: { id: string; data?: { virtual?: boolean } };
  x: number;
  y: number;
}

export interface PosicionPersonaArbol {
  id: string;
  x: number;
  y: number;
  generacion: number;
  grupoFamiliarId: string;
  componenteIndice: number;
}

export interface LimitesLayoutArbol {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface LayoutArbol {
  posiciones: Map<string, PosicionPersonaArbol>;
  nodos: PosicionPersonaArbol[];
  ancho: number;
  alto: number;
  limites: LimitesLayoutArbol;
  advertencias: string[];
  trazos: TrazoCalculadoArbol[];
}

export interface TrazoVinculoArbol {
  d: string;
  modo: "curva" | "bus";
  degradado: boolean;
  segmentos: SegmentoArbol[];
  puertos: PuertoArbol[];
  ancla: PuntoArbol;
  partes: Array<{ papel: PapelSegmentoArbol; d: string }>;
}

export interface DiagnosticoVinculosVisualesArbol {
  filiacionesEsperadas: number;
  filiacionesRepresentadas: number;
  filiacionesFaltantes: string[];
  filiacionesDuplicadas: string[];
  vinculosConyugalesEsperados: number;
  vinculosConyugalesRepresentados: number;
  vinculosConyugalesFaltantes: string[];
  vinculosConyugalesDuplicados: string[];
  personasVinculadasSinRepresentacion: string[];
  idsVisualesDuplicados: string[];
  vinculosSinTrazo: string[];
}


export interface PuntoArbol { x: number; y: number; }
export type PapelSegmentoArbol = "union" | "descendencia" | "hermanos";
export interface SegmentoArbol { inicio: PuntoArbol; fin: PuntoArbol; papel?: PapelSegmentoArbol; }
export interface PuertoArbol extends PuntoArbol { personaId: string; }
export interface TrazoCalculadoArbol { vinculo: VinculoVisualArbol; trazo: TrazoVinculoArbol | null; }
