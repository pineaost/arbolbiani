import { GEOMETRIA_ARBOL as G } from "./arbol-tipos";
import type { LayoutArbol, ModeloArbol, PosicionPersonaArbol } from "./arbol-tipos";
import { crearVinculosVisualesArbol } from "./arbol-modelo";
import { crearTrazosVinculosArbol, diagnosticarGeometriaArbol } from "./arbol-vinculos";

/** Compactación conservadora posterior al ordenado: sólo hermanos contiguos,
 * con hojas suficientes. Parejas y personas que continúan una rama permanecen
 * en la primera subfila. No se mezclan familias para aprovechar huecos. */
export function compactarBandasNumerosas(modelo: ModeloArbol, original: LayoutArbol): LayoutArbol {
  const nodos = original.nodos.map(n => ({ ...n }));
  const porId = new Map(nodos.map(n => [n.id, n]));
  const bloques = new Map<string, PosicionPersonaArbol[]>();
  for (const n of nodos) bloques.set(n.grupoFamiliarId, [...bloques.get(n.grupoFamiliarId) ?? [], n]);
  const grupos = [...new Map([...modelo.hijosPorPadre.values()].filter(hs => hs.size >= G.umbralNumeroso)
    .map(hs => { const ids = [...hs].sort(); return [ids.join(":"), ids] as const; })).values()]
    .sort((a, b) => b.length - a.length || a.join(":").localeCompare(b.join(":")));
  const ocupados = new Set<string>(), bandas = new Set<number>(), inferiores = new Set<string>();
  for (const ids of grupos) {
    const hs = ids.map(id => porId.get(id)!);
    const generacion = hs[0].generacion;
    if (hs.some(n => n.generacion !== generacion || ocupados.has(n.grupoFamiliarId))) continue;
    const bs = [...new Set(hs.map(n => n.grupoFamiliarId))].map(id => bloques.get(id)!)
      .sort((a, b) => a[0].x - b[0].x);
    const propios = new Set(bs.flatMap(ns => ns.map(n => n.id)));
    const izquierda = Math.min(...bs.flatMap(ns => ns.map(n => n.x))) - G.anchoNodo / 2;
    const derecha = Math.max(...bs.flatMap(ns => ns.map(n => n.x))) + G.anchoNodo / 2;
    if (nodos.some(n => n.generacion === generacion && !propios.has(n.id) && n.x > izquierda && n.x < derecha)) continue;
    const hojas = bs.filter(ns => ns.length === 1 && !(modelo.hijosPorPadre.get(ns[0].id)?.size));
    const conectores = bs.filter(ns => !hojas.includes(ns));
    // Dos conectores en lados distintos fijan dos fronteras: plegar esa tanda
    // arrastraría otra ascendencia. En ese caso se conserva el layout anterior.
    if (conectores.length > 1) continue;
    const cantidadAbajo = Math.min(Math.floor(bs.length / 2), hojas.length);
    if (cantidadAbajo < 3) continue;
    // Alternancia estable, conservando en los bordes los bloques conectores.
    const abajo = hojas.filter((_, i) => i % 2 === 1).slice(0, cantidadAbajo);
    for (const hoja of hojas) if (abajo.length < cantidadAbajo && !abajo.includes(hoja)) abajo.push(hoja);
    const arriba = bs.filter(ns => !abajo.includes(ns));
    const centros = new Map<string, number>();
    let cursor = 0;
    for (const ns of arriba) {
      const ancho = Math.max(...ns.map(n => n.x)) - Math.min(...ns.map(n => n.x)) + G.anchoNodo;
      centros.set(ns[0].grupoFamiliarId, cursor + ancho / 2);
      cursor += ancho + G.separacionEntreHermanos;
    }
    const ancho = cursor - G.separacionEntreHermanos;
    // Bajadas en los huecos de la primera subfila, nunca por sus tarjetas.
    const corredores = arriba.slice(1).map((ns, i) => {
      const a = arriba[i], anchoA = Math.max(...a.map(n => n.x)) - Math.min(...a.map(n => n.x)) + G.anchoNodo;
      return centros.get(a[0].grupoFamiliarId)! + anchoA / 2 + G.separacionEntreHermanos / 2;
    });
    // Para un número par hay una hoja más que corredores interiores.
    if (corredores.length < abajo.length) {
      if (conectores[0] && arriba.indexOf(conectores[0]) >= arriba.length / 2) corredores.unshift(-G.separacionEntreHermanos - G.anchoNodo / 2);
      else corredores.push(ancho + G.separacionEntreHermanos + G.anchoNodo / 2);
    }
    const inicioLocal = Math.min(0, ...corredores.slice(0, abajo.length).map(x => x - G.anchoNodo / 2));
    const anchoFinal = Math.max(ancho, ...corredores.slice(0, abajo.length).map(x => x + G.anchoNodo / 2)) - inicioLocal;
    centros.forEach((x, id) => centros.set(id, x - inicioLocal));
    corredores.forEach((x, i) => { corredores[i] = x - inicioLocal; });
    if (anchoFinal > (derecha - izquierda) * 0.8) continue;
    const conector = conectores[0];
    const deseado = conector
      ? (Math.min(...conector.map(n => n.x)) + Math.max(...conector.map(n => n.x))) / 2 - centros.get(conector[0].grupoFamiliarId)!
      : izquierda + ((derecha - izquierda) - anchoFinal) / 2;
    const offset = Math.max(izquierda, Math.min(derecha - anchoFinal, deseado));
    if (conector && Math.abs(offset - deseado) > 0.001) continue;
    for (const ns of arriba) {
      const centroAnterior = (Math.min(...ns.map(n => n.x)) + Math.max(...ns.map(n => n.x))) / 2;
      const delta = offset + centros.get(ns[0].grupoFamiliarId)! - centroAnterior;
      ns.forEach(n => { n.x += delta; });
    }
    abajo.sort((a, b) => a[0].x - b[0].x).forEach((ns, i) => { ns[0].x = offset + corredores[i]; inferiores.add(ns[0].id); });
    bs.forEach(ns => ocupados.add(ns[0].grupoFamiliarId)); bandas.add(generacion);
  }
  if (!bandas.size) return original;
  for (const n of nodos) n.y += ([...bandas].filter(g => g < n.generacion).length + Number(inferiores.has(n.id))) * G.subnivelNumeroso;
  const trazables = nodos.map(n => ({ data: { id: n.id }, x: n.x, y: n.y }));
  const trazos = crearTrazosVinculosArbol(crearVinculosVisualesArbol(modelo), trazables);
  const diagnostico = diagnosticarGeometriaArbol(trazos, trazables);
  if (diagnostico.tarjetasAtravesadas.length || diagnostico.desconectados.length || diagnostico.extremosLibres.length
    || diagnostico.puertosInvalidos.length || diagnostico.sinTrazo.length || diagnostico.noFinitos.length) return original;
  const puntos = trazos.flatMap(t => t.trazo?.segmentos.flatMap(s => [s.inicio, s.fin]) ?? []);
  const minX = Math.min(0, ...puntos.map(p => p.x - G.margenMapa));
  if (minX < 0) return original;
  const ancho = Math.max(...nodos.map(n => n.x + G.anchoNodo / 2), ...puntos.map(p => p.x)) + G.margenMapa;
  const alto = Math.max(...nodos.map(n => n.y + G.altoNodo / 2), ...puntos.map(p => p.y)) + G.margenMapa;
  return { ...original, nodos, posiciones: new Map(nodos.map(n => [n.id, n])), trazos, ancho, alto,
    limites: { minX: 0, minY: 0, maxX: ancho, maxY: alto } };
}
