/** Clasificación de consulta: nunca reemplaza el apellido histórico guardado. */
export const FAMILIAS_PRINCIPALES = [
  { id: "biani", nombre: "Biani", apellidos: ["Biani"] },
  { id: "della-paolera", nombre: "Della Paolera", apellidos: ["Della Paolera", "Della Paoelra"] },
  { id: "acevey", nombre: "Acevey", apellidos: ["Acevey", "Acebey", "Asebey"] },
  { id: "podrecca", nombre: "Podrecca", apellidos: ["Podrecca"] },
] as const;

export type FamiliaPrincipalId = typeof FAMILIAS_PRINCIPALES[number]["id"];

function normalizarApellido(apellido: string) {
  return apellido.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es").replace(/[\s.'’\-]+/g, "");
}

const familiaPorApellido = new Map<string, FamiliaPrincipalId>(
  FAMILIAS_PRINCIPALES.flatMap(f => f.apellidos.map(apellido => [normalizarApellido(apellido), f.id] as const)),
);

export function getFamiliaPrincipal(persona: { apellido: string }): FamiliaPrincipalId | null {
  return familiaPorApellido.get(normalizarApellido(persona.apellido)) ?? null;
}

export function obtenerFamiliasDePersonas(personas: Iterable<{ apellido: string }>): Set<FamiliaPrincipalId> {
  const familias = new Set<FamiliaPrincipalId>();
  for (const persona of personas) {
    const familia = getFamiliaPrincipal(persona);
    if (familia) familias.add(familia);
  }
  return familias;
}
