import type { ModeloArbol } from "./arbol-tipos";
import { crearModeloArbol } from "./arbol-modelo";
import { FAMILIAS_PRINCIPALES, getFamiliaPrincipal, type FamiliaPrincipalId } from "./familias";

export interface FamiliaFiltroArbol {
  id: FamiliaPrincipalId;
  nombre: string;
  personasIds: Set<string>;
}

/** La pertenencia se calcula sobre el modelo completo, nunca sobre el filtrado.
 * Descendientes compartidos pueden pertenecer a varias ramas. Las personas de
 * contexto no se usan como semillas: una pareja no arrastra su otra familia.
 */
export function obtenerFamiliasArbol(modelo: ModeloArbol): FamiliaFiltroArbol[] {
  return FAMILIAS_PRINCIPALES.map(({ id, nombre }) => {
    const descendientes = new Set<string>();
    const cola = [...modelo.personas.values()].filter(p => getFamiliaPrincipal(p) === id).map(p => p.id);
    for (let i = 0; i < cola.length; i += 1) {
      const personaId = cola[i];
      if (descendientes.has(personaId)) continue;
      descendientes.add(personaId);
      cola.push(...modelo.hijosPorPadre.get(personaId) ?? []);
    }
    const personasIds = new Set(descendientes);
    for (const personaId of descendientes) {
      // También preserva coprogenitores aunque no exista matrimonio registrado.
      for (const padre of modelo.padresPorHijo.get(personaId) ?? []) personasIds.add(padre);
      for (const pareja of modelo.conyugesPorPersona.get(personaId) ?? []) personasIds.add(pareja);
    }
    return { id, nombre, personasIds };
  });
}

export function filtrarModeloArbol(modelo: ModeloArbol, familias: FamiliaFiltroArbol[], activas: ReadonlySet<string>): ModeloArbol {
  // Con todas activas, se conserva exactamente el modelo y layout originales.
  if (familias.every(familia => activas.has(familia.id))) return modelo;
  const visibles = new Set<string>();
  for (const familia of familias) {
    if (activas.has(familia.id)) familia.personasIds.forEach(id => visibles.add(id));
  }
  const conservar = (ids: Iterable<string>) => [...ids].filter(id => visibles.has(id));
  return crearModeloArbol([...modelo.personas.values()].filter(p => visibles.has(p.id)).map(p => ({
    ...p,
    padres_ids: conservar(modelo.padresPorHijo.get(p.id) ?? []),
    hijos_ids: conservar(modelo.hijosPorPadre.get(p.id) ?? []),
    conyuges_ids: conservar(modelo.conyugesPorPersona.get(p.id) ?? []),
    hermanos_ids: conservar(p.hermanos_ids),
  })));
}
