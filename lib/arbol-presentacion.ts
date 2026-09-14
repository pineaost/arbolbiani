import { GEOMETRIA_ARBOL } from "./arbol-tipos";
import type { LayoutArbol, ModeloArbol } from "./arbol-tipos";

/** Envolturas visuales de parejas adyacentes. No alteran el layout ni crean
 * relaciones: agrupan dos fichas que ya pertenecen a la misma unión real.
 * Se excluyen uniones superpuestas de múltiples cónyuges para no sugerir
 * visualmente una pareja exclusiva que los datos no afirman.
 */
export function crearMarcosParejaArbol(modelo: ModeloArbol, layout: LayoutArbol) {
  const candidatos = layout.trazos.flatMap(({ vinculo }) => {
    const ids = vinculo.tipo === "conyugal" ? [vinculo.origenId, vinculo.destinoId] : vinculo.progenitoresIds;
    if (ids.length !== 2) return [];
    const [a, b] = ids.map(id => layout.posiciones.get(id));
    if (!a || !b || a.y !== b.y || Math.abs(a.x - b.x) > GEOMETRIA_ARBOL.anchoNodo + GEOMETRIA_ARBOL.separacionPareja + 0.001) return [];
    return [{ id: vinculo.id, ids, a, b }];
  });
  const participaciones = new Map<string, number>();
  layout.trazos.forEach(({ vinculo }) => {
    const ids = vinculo.tipo === "conyugal" ? [vinculo.origenId, vinculo.destinoId] : vinculo.progenitoresIds;
    if (ids.length === 2) ids.forEach(id => participaciones.set(id, (participaciones.get(id) ?? 0) + 1));
  });
  const cantidadHermanos = (id: string) => new Set([...modelo.padresPorHijo.get(id) ?? []].flatMap(p => [...modelo.hijosPorPadre.get(p) ?? []])).size - 1;
  return candidatos.filter(c => c.ids.every(id => participaciones.get(id) === 1)).map(({ id, ids, a, b }) => ({
    id, personasIds: ids,
    x: Math.min(a.x, b.x) - GEOMETRIA_ARBOL.anchoNodo / 2 - 9,
    y: a.y - GEOMETRIA_ARBOL.altoNodo / 2 - 9,
    ancho: Math.abs(a.x - b.x) + GEOMETRIA_ARBOL.anchoNodo + 18,
    alto: GEOMETRIA_ARBOL.altoNodo + 18,
    ramaNumerosa: ids.some(id => cantidadHermanos(id) >= 3),
  }));
}
