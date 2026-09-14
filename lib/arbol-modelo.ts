import type { PersonaArbol } from "./supabase/types";
import type { ModeloArbol, ProblemaArbol, CodigoProblemaArbol, FamiliaArbol, ComponenteArbol, VinculoVisualArbol, DiagnosticoVinculosVisualesArbol, NodoPosicionadoArbol } from "./arbol-tipos";
import { crearTrazosVinculosArbol } from "./arbol-vinculos";
export function claveOrden(persona: PersonaArbol) {
  return `${persona.fecha_nacimiento ?? "9999-99-99"}|${persona.apellido}|${persona.nombre}|${persona.id}`.toLocaleLowerCase("es");
}


function asegurar(mapa: Map<string, Set<string>>, id: string) {
  if (!mapa.has(id)) mapa.set(id, new Set());
  return mapa.get(id)!;
}

function ordenarIds(ids: Iterable<string>, personas: Map<string, PersonaArbol>) {
  return [...new Set(ids)]
    .filter((id) => personas.has(id))
    .sort((a, b) => claveOrden(personas.get(a)!).localeCompare(claveOrden(personas.get(b)!), "es"));
}

function claveProblema(codigo: CodigoProblemaArbol, ids: string[]) {
  return `${codigo}:${ids.join(":")}`;
}

function detectarCiclosFiliacion(
  personas: Map<string, PersonaArbol>,
  hijosPorPadre: Map<string, Set<string>>,
): ProblemaArbol[] {
  const estado = new Map<string, "visitando" | "visitado">();
  const camino: string[] = [];
  const ciclos = new Map<string, ProblemaArbol>();

  const visitar = (id: string) => {
    estado.set(id, "visitando");
    camino.push(id);
    for (const hijo of ordenarIds(hijosPorPadre.get(id) ?? [], personas)) {
      if (estado.get(hijo) === "visitando") {
        const inicio = camino.indexOf(hijo);
        const ciclo = [...camino.slice(inicio), hijo];
        const miembros = [...new Set(ciclo.slice(0, -1))].sort();
        ciclos.set(claveProblema("ciclo-filiacion", miembros), {
          codigo: "ciclo-filiacion",
          ids: ciclo,
          detalle: `Ciclo de filiacion detectado: ${ciclo.join(" -> ")}.`,
        });
      } else if (!estado.has(hijo)) {
        visitar(hijo);
      }
    }
    camino.pop();
    estado.set(id, "visitado");
  };

  ordenarIds(personas.keys(), personas).forEach((id) => {
    if (!estado.has(id)) visitar(id);
  });
  return [...ciclos.values()];
}


export function crearModeloArbol(entrada: PersonaArbol[]): ModeloArbol {
  const personas = new Map<string, PersonaArbol>();
  const problemasPorClave = new Map<string, ProblemaArbol>();
  [...entrada].sort((a, b) => claveOrden(a).localeCompare(claveOrden(b), "es")).forEach((persona) => {
    if (!personas.has(persona.id)) personas.set(persona.id, persona);
    else problemasPorClave.set(`persona-duplicada:${persona.id}`, { codigo: "persona-duplicada", ids: [persona.id], detalle: `La persona ${persona.id} aparece más de una vez.` });
  });
  const padresPorHijo = new Map<string, Set<string>>();
  const hijosPorPadre = new Map<string, Set<string>>();
  const conyugesPorPersona = new Map<string, Set<string>>();

  const registrarProblema = (problema: ProblemaArbol) => {
    const idsClave = problema.codigo.includes("conyugal") ? [...problema.ids].sort() : problema.ids;
    problemasPorClave.set(claveProblema(problema.codigo, idsClave), problema);
  };
  const filiacion = (padre: string, hijo: string) => {
    if (padre === hijo) {
      registrarProblema({ codigo: "auto-referencia-filiacion", ids: [padre], detalle: `${padre} figura como su propio progenitor.` });
      return;
    }
    if (!personas.has(padre) || !personas.has(hijo)) {
      registrarProblema({ codigo: "referencia-ausente", ids: [padre, hijo], detalle: `La filiacion ${padre} -> ${hijo} referencia una persona ausente.` });
      return;
    }
    asegurar(padresPorHijo, hijo).add(padre);
    asegurar(hijosPorPadre, padre).add(hijo);
  };
  const conyuge = (a: string, b: string) => {
    if (a === b) {
      registrarProblema({ codigo: "auto-referencia-conyugal", ids: [a], detalle: `${a} figura como su propio conyuge.` });
      return;
    }
    if (!personas.has(a) || !personas.has(b)) {
      registrarProblema({ codigo: "referencia-ausente", ids: [a, b], detalle: `El vinculo conyugal ${a} <-> ${b} referencia una persona ausente.` });
      return;
    }
    asegurar(conyugesPorPersona, a).add(b);
    asegurar(conyugesPorPersona, b).add(a);
  };

  for (const persona of personas.values()) {
    persona.padres_ids.forEach((padre) => filiacion(padre, persona.id));
    persona.hijos_ids.forEach((hijo) => filiacion(persona.id, hijo));
    persona.conyuges_ids.forEach((pareja) => conyuge(persona.id, pareja));
  }

  for (const [hijo, padres] of padresPorHijo) {
    if (padres.size > 2) {
      registrarProblema({
        codigo: "mas-de-dos-progenitores",
        ids: [hijo, ...ordenarIds(padres, personas)],
        detalle: `${hijo} tiene ${padres.size} progenitores registrados.`,
      });
    }
  }
  detectarCiclosFiliacion(personas, hijosPorPadre).forEach(registrarProblema);

  const familiasPorId = new Map<string, FamiliaArbol>();
  for (const persona of personas.values()) {
    const progenitores = ordenarIds(padresPorHijo.get(persona.id) ?? [], personas);
    if (progenitores.length === 0) continue;
    const id = [...progenitores].sort().join(":");
    const familia = familiasPorId.get(id) ?? { id, progenitores, hijos: [] };
    familia.hijos.push(persona.id);
    familiasPorId.set(id, familia);
  }
  const familias = [...familiasPorId.values()].map((familia) => ({
    ...familia,
    hijos: ordenarIds(familia.hijos, personas),
  }));

  const visitados = new Set<string>();
  const componentes: ComponenteArbol[] = [];
  for (const persona of [...personas.values()].sort((a, b) => claveOrden(a).localeCompare(claveOrden(b), "es"))) {
    if (visitados.has(persona.id)) continue;
    const ids: string[] = [];
    const cola = [persona.id];
    visitados.add(persona.id);
    for (let indice = 0; indice < cola.length; indice += 1) {
      const id = cola[indice];
      ids.push(id);
      const vecinos = [
        ...(padresPorHijo.get(id) ?? []),
        ...(hijosPorPadre.get(id) ?? []),
        ...(conyugesPorPersona.get(id) ?? []),
      ];
      vecinos.forEach((vecino) => {
        if (!visitados.has(vecino)) {
          visitados.add(vecino);
          cola.push(vecino);
        }
      });
    }
    const idsOrdenados = ordenarIds(ids, personas);
    const sinProgenitores = idsOrdenados.filter((id) => (padresPorHijo.get(id)?.size ?? 0) === 0);
    const conDescendencia = sinProgenitores.filter((id) => (hijosPorPadre.get(id)?.size ?? 0) > 0);
    const raicesAncestrales = conDescendencia.length > 0 ? conDescendencia : sinProgenitores;
    componentes.push({ ids: idsOrdenados, raicesAncestrales });
  }

  return {
    personas,
    padresPorHijo,
    hijosPorPadre,
    conyugesPorPersona,
    familias,
    componentes,
    problemas: [...problemasPorClave.values()],
  };
}


export function crearVinculosVisualesArbol(modelo: ModeloArbol): VinculoVisualArbol[] {
  const vinculos: VinculoVisualArbol[] = [];
  const parejasIntegradas = new Set<string>();
  for (const familia of modelo.familias) {
    vinculos.push({
      id: `union-familiar:${familia.id}`,
      tipo: "union-familiar",
      familiaId: familia.id,
      progenitoresIds: [...familia.progenitores],
      hijosIds: [...familia.hijos],
    });
    if (familia.progenitores.length === 2) {
      const [a, b] = [...familia.progenitores].sort();
      if (modelo.conyugesPorPersona.get(a)?.has(b)) parejasIntegradas.add(`${a}:${b}`);
    }
  }
  const parejasAgregadas = new Set<string>();
  for (const persona of ordenarIds(modelo.personas.keys(), modelo.personas)) {
    for (const pareja of ordenarIds(modelo.conyugesPorPersona.get(persona) ?? [], modelo.personas)) {
      const [a, b] = [persona, pareja].sort();
      const clave = `${a}:${b}`;
      if (parejasAgregadas.has(clave) || parejasIntegradas.has(clave)) continue;
      parejasAgregadas.add(clave);
      vinculos.push({ id: `conyugal:${clave}`, tipo: "conyugal", origenId: a, destinoId: b });
    }
  }
  return vinculos;
}

/**
 * Contrasta el modelo canonico con las relaciones visuales finales. Una pareja
 * con hijos se representa en la barra parental de su unidad familiar; una
 * pareja sin hijos conserva un vinculo conyugal independiente.
 */
export function diagnosticarVinculosVisualesArbol(
  modelo: ModeloArbol,
  vinculos: VinculoVisualArbol[],
  nodos: NodoPosicionadoArbol[],
): DiagnosticoVinculosVisualesArbol {
  const contar = (mapa: Map<string, number>, clave: string) => mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
  const claveFiliacion = (padre: string, hijo: string) => `${padre}->${hijo}`;
  const clavePareja = (a: string, b: string) => [a, b].sort().join(":");
  const filiacionesEsperadas = new Set<string>();
  const parejasEsperadas = new Set<string>();
  const personasVinculadas = new Set<string>();
  const personasRepresentadas = new Set<string>();
  const representacionesFiliacion = new Map<string, number>();
  const representacionesPareja = new Map<string, number>();

  modelo.hijosPorPadre.forEach((hijos, padre) => hijos.forEach((hijo) => {
    filiacionesEsperadas.add(claveFiliacion(padre, hijo));
    personasVinculadas.add(padre);
    personasVinculadas.add(hijo);
  }));
  modelo.conyugesPorPersona.forEach((parejas, persona) => parejas.forEach((pareja) => {
    parejasEsperadas.add(clavePareja(persona, pareja));
    personasVinculadas.add(persona);
    personasVinculadas.add(pareja);
  }));

  for (const vinculo of vinculos) {
    if (vinculo.tipo === "conyugal") {
      contar(representacionesPareja, clavePareja(vinculo.origenId, vinculo.destinoId));
      personasRepresentadas.add(vinculo.origenId);
      personasRepresentadas.add(vinculo.destinoId);
      continue;
    }
    vinculo.progenitoresIds.forEach((padre) => {
      personasRepresentadas.add(padre);
      vinculo.hijosIds.forEach((hijo) => contar(representacionesFiliacion, claveFiliacion(padre, hijo)));
    });
    vinculo.hijosIds.forEach((hijo) => personasRepresentadas.add(hijo));
    if (vinculo.progenitoresIds.length === 2) {
      const [a, b] = vinculo.progenitoresIds;
      if (modelo.conyugesPorPersona.get(a)?.has(b)) contar(representacionesPareja, clavePareja(a, b));
    }
  }

  const faltantes = (esperadas: Set<string>, representadas: Map<string, number>) =>
    [...esperadas].filter((clave) => (representadas.get(clave) ?? 0) === 0).sort();
  const duplicadas = (esperadas: Set<string>, representadas: Map<string, number>) =>
    [...esperadas].filter((clave) => (representadas.get(clave) ?? 0) > 1).sort();
  const conteoIds = new Map<string, number>();
  vinculos.forEach(({ id }) => contar(conteoIds, id));

  return {
    filiacionesEsperadas: filiacionesEsperadas.size,
    filiacionesRepresentadas: [...filiacionesEsperadas].filter((clave) => (representacionesFiliacion.get(clave) ?? 0) === 1).length,
    filiacionesFaltantes: faltantes(filiacionesEsperadas, representacionesFiliacion),
    filiacionesDuplicadas: duplicadas(filiacionesEsperadas, representacionesFiliacion),
    vinculosConyugalesEsperados: parejasEsperadas.size,
    vinculosConyugalesRepresentados: [...parejasEsperadas].filter((clave) => (representacionesPareja.get(clave) ?? 0) === 1).length,
    vinculosConyugalesFaltantes: faltantes(parejasEsperadas, representacionesPareja),
    vinculosConyugalesDuplicados: duplicadas(parejasEsperadas, representacionesPareja),
    personasVinculadasSinRepresentacion: [...personasVinculadas].filter((id) => !personasRepresentadas.has(id)).sort(),
    idsVisualesDuplicados: [...conteoIds].filter(([, cantidad]) => cantidad > 1).map(([id]) => id).sort(),
    vinculosSinTrazo: crearTrazosVinculosArbol(vinculos, nodos).filter(({ trazo }) => trazo === null).map(({ vinculo }) => vinculo.id).sort(),
  };
}


export function diagnosticarModeloArbol(entrada: PersonaArbol[]) {
  const modelo = crearModeloArbol(entrada);
  return {
    errores: modelo.problemas, cantidadPersonas: modelo.personas.size,
    cantidadComponentes: modelo.componentes.length,
    cantidadFiliaciones: [...modelo.hijosPorPadre.values()].reduce((total, hijos) => total + hijos.size, 0),
    cantidadUnionesFamiliares: modelo.familias.length,
    componentes: modelo.componentes, familias: modelo.familias,
  };
}
