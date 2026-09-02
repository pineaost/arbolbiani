import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { calculateTree } from "family-chart";
import ts from "typescript";

const require = createRequire(import.meta.url);
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function cargarTransformador() {
  const archivo = resolve(raiz, "lib/arbol-chart.ts");
  const salida = ts.transpileModule(readFileSync(archivo, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: archivo,
  }).outputText;
  const modulo = { exports: {} };
  new Function("exports", "require", "module", "__filename", "__dirname", salida)(modulo.exports, require, modulo, archivo, dirname(archivo));
  return modulo.exports;
}

function cargarModulo(archivoRelativo, dependencias = {}) {
  const archivo = resolve(raiz, archivoRelativo);
  const salida = ts.transpileModule(readFileSync(archivo, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: archivo,
  }).outputText;
  const modulo = { exports: {} };
  const requireConDependencias = (nombre) => dependencias[nombre] ?? require(nombre);
  new Function("exports", "require", "module", "__filename", "__dirname", salida)(modulo.exports, requireConDependencias, modulo, archivo, dirname(archivo));
  return modulo.exports;
}

const {
  compararHijosParaLayout,
  crearDatosFamilyChart,
  crearModeloArbol,
  crearVinculosVisualesArbol,
  diagnosticarDatosFamilyChart,
  diagnosticarModeloArbol,
  GEOMETRIA_ARBOL,
  ordenarConyugesParaLayout,
  RAIZ_MAPA_ID,
} = cargarTransformador();
const { normalizarPersonasArbol, obtenerTodasLasFilas } = cargarModulo("lib/relaciones.ts", {
  "@/lib/supabase/server": {},
  "@/lib/personas": {},
});

function persona(id, { padres = [], hijos = [], conyuges = [], nacimiento = "1950-01-01" } = {}) {
  return {
    id,
    nombre: id,
    apellido: "Prueba",
    genero: "masculino",
    fecha_nacimiento: nacimiento,
    lugar_nacimiento: null,
    fecha_fallecimiento: null,
    lugar_fallecimiento: null,
    notas: null,
    created_at: "",
    updated_at: "",
    padres_ids: padres,
    hijos_ids: hijos,
    conyuges_ids: conyuges,
    hermanos_ids: [],
  };
}

function calcularArbol(datos) {
  return calculateTree(structuredClone(datos), {
    main_id: RAIZ_MAPA_ID,
    single_parent_empty_card: false,
    ancestry_depth: 99,
    progeny_depth: 99,
    node_separation: GEOMETRIA_ARBOL.separacionHorizontal,
    level_separation: GEOMETRIA_ARBOL.separacionVertical,
    sortChildrenFunction: compararHijosParaLayout,
    sortSpousesFunction: ordenarConyugesParaLayout,
  });
}

function idsRenderizados(datos) {
  const arbol = calcularArbol(datos);
  return arbol.data.map((dato) => dato.data.id).filter((id) => id !== RAIZ_MAPA_ID);
}

function componente(modelo, id) {
  const encontrado = modelo.componentes.find((item) => item.ids.includes(id));
  assert.ok(encontrado, `No se encontró el componente de ${id}`);
  return encontrado;
}

function personaPersistida(id, nacimiento = "1950-01-01") {
  const { padres_ids, hijos_ids, conyuges_ids, hermanos_ids, ...persistida } = persona(id, { nacimiento });
  return persistida;
}

test("dos cónyuges con padres y abuelos propios conservan ambas ascendencias", () => {
  const personas = [
    persona("a-abuelo", { hijos: ["a-padre"], nacimiento: "1900-01-01" }),
    persona("a-padre", { padres: ["a-abuelo"], hijos: ["a"], nacimiento: "1925-01-01" }),
    persona("a", { padres: ["a-padre"], conyuges: ["b"], nacimiento: "1950-01-01" }),
    persona("b-abuelo", { hijos: ["b-padre"], nacimiento: "1901-01-01" }),
    persona("b-padre", { padres: ["b-abuelo"], hijos: ["b"], nacimiento: "1926-01-01" }),
    persona("b", { padres: ["b-padre"], conyuges: ["a"], nacimiento: "1951-01-01" }),
  ];
  const modelo = crearModeloArbol(personas);
  const datos = crearDatosFamilyChart(personas);
  const renderizados = idsRenderizados(datos);

  assert.equal(modelo.componentes.length, 1);
  assert.deepEqual(new Set(modelo.componentes[0].raicesAncestrales), new Set(["a-abuelo", "b-abuelo"]));
  assert.deepEqual(new Set(datos[0].rels.children), new Set(["a-abuelo", "b-abuelo"]));
  assert.equal(renderizados.length, personas.length);
  assert.deepEqual(new Set(renderizados), new Set(personas.map(({ id }) => id)));
  assert.deepEqual(
    new Set(crearVinculosVisualesArbol(modelo).map(({ id }) => id)),
    new Set([
      "filiacion:a-abuelo:a-padre",
      "filiacion:a-padre:a",
      "filiacion:b-abuelo:b-padre",
      "filiacion:b-padre:b",
      "conyugal:a:b",
    ]),
  );
});

test("tres ramas conectadas por matrimonios forman un componente sin perder raíces", () => {
  const personas = [
    persona("a-raiz", { hijos: ["a"], nacimiento: "1900-01-01" }),
    persona("a", { padres: ["a-raiz"], conyuges: ["b"], nacimiento: "1930-01-01" }),
    persona("b-raiz", { hijos: ["b"], nacimiento: "1901-01-01" }),
    persona("b", { padres: ["b-raiz"], conyuges: ["a", "c"], nacimiento: "1931-01-01" }),
    persona("c-raiz", { hijos: ["c"], nacimiento: "1902-01-01" }),
    persona("c", { padres: ["c-raiz"], conyuges: ["b"], nacimiento: "1932-01-01" }),
  ];
  const modelo = crearModeloArbol(personas);
  const datos = crearDatosFamilyChart(personas);
  const renderizados = idsRenderizados(datos);

  assert.equal(modelo.componentes.length, 1);
  assert.deepEqual(new Set(modelo.componentes[0].raicesAncestrales), new Set(["a-raiz", "b-raiz", "c-raiz"]));
  assert.equal(renderizados.length, personas.length);
  assert.equal(new Set(renderizados).size, personas.length);
  assert.deepEqual(new Set(renderizados), new Set(personas.map(({ id }) => id)));
  assert.equal(crearVinculosVisualesArbol(modelo).filter(({ tipo }) => tipo === "conyugal").length, 2);
});

test("raíces conectadas por matrimonio quedan adyacentes aunque una tercera raíz se ordene entre ambas", () => {
  const personas = [
    persona("raiz-a", { hijos: ["persona-a"], nacimiento: "1900-01-01" }),
    persona("persona-a", { padres: ["raiz-a"], hijos: ["descendiente-compartido"], conyuges: ["persona-b"], nacimiento: "1930-01-01" }),
    persona("raiz-c", { hijos: ["descendiente-compartido"], nacimiento: "1901-01-01" }),
    persona("descendiente-compartido", { padres: ["persona-a", "raiz-c"], nacimiento: "1960-01-01" }),
    persona("raiz-b", { hijos: ["persona-b"], nacimiento: "1902-01-01" }),
    persona("persona-b", { padres: ["raiz-b"], conyuges: ["persona-a"], nacimiento: "1932-01-01" }),
  ];
  const diagnosticoModelo = diagnosticarModeloArbol(personas);
  const datos = crearDatosFamilyChart(personas);
  const diagnosticoLayout = diagnosticarDatosFamilyChart(datos);

  assert.equal(diagnosticoModelo.cantidadComponentes, 1);
  assert.deepEqual(
    new Set(diagnosticoModelo.componentes[0].raicesAncestrales),
    new Set(["raiz-a", "raiz-b", "raiz-c"]),
  );
  assert.deepEqual(diagnosticoModelo.raicesLayout, ["raiz-a", "raiz-b", "raiz-c"]);
  assert.deepEqual(diagnosticoLayout.raicesLayout, ["raiz-a", "raiz-b", "raiz-c"]);

  const indiceA = diagnosticoLayout.raicesLayout.indexOf("raiz-a");
  const indiceB = diagnosticoLayout.raicesLayout.indexOf("raiz-b");
  assert.equal(Math.abs(indiceA - indiceB), 1, "la raíz C no debe separar las ramas A y B unidas por matrimonio");
});

test("hijos con matrimonios cruzados se orientan hacia el borde de la raíz conectada", () => {
  const personas = [
    persona("raiz-b", { hijos: ["persona-b"], nacimiento: "1899-01-01" }),
    persona("persona-b", { padres: ["raiz-b"], conyuges: ["hijo-izquierda"], nacimiento: "1931-01-01" }),
    persona("raiz-a", { hijos: ["hijo-izquierda", "hijo-neutro", "hijo-derecha"], nacimiento: "1900-01-01" }),
    persona("hijo-izquierda", { padres: ["raiz-a"], conyuges: ["persona-b"], nacimiento: "1930-01-01" }),
    persona("hijo-neutro", { padres: ["raiz-a"], nacimiento: "1932-01-01" }),
    persona("hijo-derecha", { padres: ["raiz-a"], conyuges: ["persona-c"], nacimiento: "1933-01-01" }),
    persona("raiz-c", { hijos: ["persona-c"], nacimiento: "1901-01-01" }),
    persona("persona-c", { padres: ["raiz-c"], conyuges: ["hijo-derecha"], nacimiento: "1934-01-01" }),
  ];
  const datos = crearDatosFamilyChart(personas);
  const raizA = datos.find(({ id }) => id === "raiz-a");

  assert.deepEqual(datos[0].rels.children, ["raiz-b", "raiz-a", "raiz-c"]);
  assert.deepEqual(raizA?.rels.children, ["hijo-izquierda", "hijo-neutro", "hijo-derecha"]);

  const hijosPosicionados = calcularArbol(datos).data
    .filter(({ data }) => raizA?.rels.children.includes(data.id))
    .sort((a, b) => a.x - b.x)
    .map(({ data }) => data.id);
  assert.deepEqual(hijosPosicionados, ["hijo-izquierda", "hijo-neutro", "hijo-derecha"]);
});

test("personas realmente no vinculadas siguen como componentes y tarjetas separadas", () => {
  const personas = [
    persona("familia-raiz", { hijos: ["familia-hija"], nacimiento: "1900-01-01" }),
    persona("familia-hija", { padres: ["familia-raiz"], nacimiento: "1930-01-01" }),
    persona("suelta-uno", { nacimiento: "1960-01-01" }),
    persona("suelta-dos", { nacimiento: "1961-01-01" }),
    persona("suelta-tres", { nacimiento: "1962-01-01" }),
  ];
  const modelo = crearModeloArbol(personas);
  const datos = crearDatosFamilyChart(personas);

  assert.equal(modelo.componentes.length, 4);
  assert.deepEqual(new Set(datos[0].rels.children), new Set(["familia-raiz", "suelta-uno", "suelta-dos", "suelta-tres"]));
  assert.deepEqual(new Set(idsRenderizados(datos)), new Set(personas.map(({ id }) => id)));
});

test("una fila canónica creada desde Padres o desde Hijos produce la misma reciprocidad funcional", () => {
  const personasBase = [personaPersistida("progenitor", "1920-01-01"), personaPersistida("hijo", "1950-01-01")];
  const filaCreadaDesdePadres = [{ id: "rel-1", padre_id: "progenitor", hijo_id: "hijo" }];
  const filaCreadaDesdeHijos = [{ id: "rel-2", padre_id: "progenitor", hijo_id: "hijo" }];
  const desdePadres = normalizarPersonasArbol(personasBase, filaCreadaDesdePadres, []);
  const desdeHijos = normalizarPersonasArbol(personasBase, filaCreadaDesdeHijos, []);

  assert.deepEqual(desdePadres, desdeHijos);
  assert.deepEqual(desdePadres.find(({ id }) => id === "progenitor")?.hijos_ids, ["hijo"]);
  assert.deepEqual(desdePadres.find(({ id }) => id === "hijo")?.padres_ids, ["progenitor"]);
  assert.deepEqual(crearDatosFamilyChart(desdePadres), crearDatosFamilyChart(desdeHijos));

  const ficha = readFileSync(resolve(raiz, "components/archivo/persona-ficha-client.tsx"), "utf8");
  assert.match(ficha, /agregarFiliacion\(\{\s*padre_id:\s*padreElegido,\s*hijo_id:\s*persona\.id\s*\}\)/);
  assert.match(ficha, /agregarFiliacion\(\{\s*padre_id:\s*persona\.id,\s*hijo_id:\s*hijoElegido\s*\}\)/);
});

test("la lectura paginada no descarta filas de relaciones", async () => {
  const filas = Array.from({ length: 1003 }, (_, indice) => ({ id: `fila-${indice}` }));
  const rangos = [];
  const resultado = await obtenerTodasLasFilas(async (desde, hasta) => {
    rangos.push([desde, hasta]);
    return { data: filas.slice(desde, hasta + 1), error: null };
  });

  assert.equal(resultado.error, null);
  assert.equal(resultado.data.length, filas.length);
  assert.deepEqual(rangos, [[0, 999], [1000, 1999]]);
});

test("los ciclos existentes se diagnostican y un alta que cerraría un ciclo se bloquea", async () => {
  const personasConCiclo = [
    persona("a", { padres: ["c"], hijos: ["b"] }),
    persona("b", { padres: ["a"], hijos: ["c"] }),
    persona("c", { padres: ["b"], hijos: ["a"] }),
  ];
  const diagnostico = diagnosticarModeloArbol(personasConCiclo);
  const datos = crearDatosFamilyChart(personasConCiclo);

  assert.equal(diagnostico.errores.filter(({ codigo }) => codigo === "ciclo-filiacion").length, 1);
  assert.equal(idsRenderizados(datos).length, personasConCiclo.length);
  assert.equal(new Set(idsRenderizados(datos)).size, personasConCiclo.length);

  let inserto = false;
  const padresPorHijo = new Map([["c", ["b"]], ["b", ["a"]]]);
  const { agregarFiliacion } = cargarModulo("lib/relaciones-actions.ts", {
    "next/cache": { revalidatePath: () => {} },
    "@/lib/supabase/server": {
      createClient: async () => ({
        from: () => ({
          select: (_columnas, opciones) => opciones?.head
            ? { eq: async () => ({ count: 0, error: null }) }
            : { in: async (_columna, ids) => ({ data: ids.flatMap((id) => (padresPorHijo.get(id) ?? []).map((padre_id) => ({ padre_id }))), error: null }) },
          insert: async () => { inserto = true; return { error: null }; },
        }),
      }),
    },
    "@/lib/relaciones": {},
  });
  const resultado = await agregarFiliacion({ padre_id: "c", hijo_id: "a" });
  assert.match(resultado.error, /ciclo/i);
  assert.equal(inserto, false);
});

test("el layout es determinista al recalcularse como en una recarga", () => {
  const personas = [
    persona("raiz-a", { hijos: ["a"] }),
    persona("a", { padres: ["raiz-a"], conyuges: ["b"] }),
    persona("raiz-b", { hijos: ["b"] }),
    persona("b", { padres: ["raiz-b"], conyuges: ["a"] }),
  ];
  const primera = crearDatosFamilyChart(structuredClone(personas));
  const segunda = crearDatosFamilyChart(structuredClone(personas));

  assert.deepEqual(primera, segunda);
  assert.deepEqual(idsRenderizados(primera), idsRenderizados(segunda));
});

test("al desvincular o borrar se recalculan las raíces sin perder el resto del componente", async () => {
  const conFiliacion = [
    persona("a", { hijos: ["b"], nacimiento: "1900-01-01" }),
    persona("b", { padres: ["a"], hijos: ["c"], nacimiento: "1930-01-01" }),
    persona("c", { padres: ["b"], hijos: ["d"], nacimiento: "1960-01-01" }),
    persona("d", { padres: ["c"], nacimiento: "1990-01-01" }),
  ];

  assert.deepEqual(componente(crearModeloArbol(conFiliacion), "a").raicesAncestrales, ["a"]);

  let seIntentoBorrarEnBase = false;
  const { eliminarPersona } = cargarModulo("lib/personas-actions.ts", {
    "next/cache": { revalidatePath: () => {} },
    "@/lib/supabase/server": { createClient: async () => ({ from: () => ({ delete: () => { seIntentoBorrarEnBase = true; } }) }) },
    "@/lib/integridad-referencial": {
      personaTieneVinculos: async () => ({ tieneVinculos: true, detalle: ["padres, hijos o cónyuges"] }),
    },
  });
  const bloqueo = await eliminarPersona("a");
  assert.match(bloqueo.error, /No se puede eliminar/);
  assert.equal(seIntentoBorrarEnBase, false, "no debe ejecutarse el delete mientras A conserva la filiación con B");

  // La ficha convierte el bloqueo en un aviso que permite confirmar el
  // segundo paso de eliminación forzada de manera explícita.
  const ficha = readFileSync(resolve(raiz, "components/archivo/persona-ficha-client.tsx"), "utf8");
  assert.match(ficha, /tarea:\s*\(\)\s*=>\s*eliminarPersona\(persona\.id\)/);
  assert.match(ficha, /permiteEliminacionForzada:\s*true/);
  assert.match(ficha, /eliminarPersonaForzada\(persona\.id\)/);
  assert.match(ficha, /onActualizarFicha\?\.\(\)/);

  const sinFiliacionAB = [
    persona("a", { nacimiento: "1900-01-01" }),
    persona("b", { hijos: ["c"], nacimiento: "1930-01-01" }),
    persona("c", { padres: ["b"], hijos: ["d"], nacimiento: "1960-01-01" }),
    persona("d", { padres: ["c"], nacimiento: "1990-01-01" }),
  ];
  const modeloSinFiliacionAB = crearModeloArbol(sinFiliacionAB);
  const componenteB = componente(modeloSinFiliacionAB, "b");
  assert.deepEqual(componenteB.raicesAncestrales, ["b"]);
  assert.deepEqual(new Set(componenteB.ids), new Set(["b", "c", "d"]));
  const renderizadosSinFiliacion = idsRenderizados(crearDatosFamilyChart(sinFiliacionAB));
  assert.equal(new Set(renderizadosSinFiliacion).size, sinFiliacionAB.length, "no debe haber tarjetas duplicadas");
  assert.deepEqual(new Set(renderizadosSinFiliacion), new Set(sinFiliacionAB.map(({ id }) => id)), "no debe perderse nadie al recalcular las anclas");

  const sinA = sinFiliacionAB.filter(({ id }) => id !== "a");
  const modeloSinA = crearModeloArbol(sinA);
  assert.equal(modeloSinA.componentes.length, 1);
  assert.deepEqual(modeloSinA.componentes[0].raicesAncestrales, ["b"]);
  const renderizadosSinA = idsRenderizados(crearDatosFamilyChart(sinA));
  assert.equal(new Set(renderizadosSinA).size, sinA.length, "no debe haber tarjetas duplicadas tras borrar A");
  assert.deepEqual(new Set(renderizadosSinA), new Set(sinA.map(({ id }) => id)), "el resto del componente debe seguir completo tras borrar A");
});

test("la eliminación forzada usa la operación transaccional y sólo limpia archivos de documentos huérfanos", async () => {
  let llamadaRpc = null;
  let rutasEliminadas = [];
  const { eliminarPersonaForzada } = cargarModulo("lib/personas-actions.ts", {
    "next/cache": { revalidatePath: () => {} },
    "@/lib/supabase/server": {
      createClient: async () => ({
        rpc: async (nombre, parametros) => {
          llamadaRpc = { nombre, parametros };
          return { data: [{ archivo_url: "solo-de-esta-persona.pdf" }, { archivo_url: null }], error: null };
        },
        storage: {
          from: (bucket) => ({
            remove: async (rutas) => {
              assert.equal(bucket, "documentos");
              rutasEliminadas = rutas;
              return { error: null };
            },
          }),
        },
      }),
    },
    "@/lib/integridad-referencial": { personaTieneVinculos: async () => ({ tieneVinculos: false, detalle: [], dependencias: {} }) },
  });

  assert.deepEqual(await eliminarPersonaForzada("persona-a"), { error: null });
  assert.deepEqual(llamadaRpc, { nombre: "eliminar_persona_forzada", parametros: { persona_uuid: "persona-a" } });
  assert.deepEqual(rutasEliminadas, ["solo-de-esta-persona.pdf"]);

  const migracion = readFileSync(resolve(raiz, "supabase/migrations/0004_eliminacion_forzada_persona.sql"), "utf8");
  assert.match(migracion, /delete from personas where id = persona_uuid/i);
  assert.match(migracion, /not exists\s*\(\s*select 1\s*from documento_persona/i);
  assert.match(migracion, /returning documento\.archivo_url/i);
});

test("la importación del Excel inserta sólo personas propuestas y no crea relaciones", async () => {
  const tablasConsultadas = [];
  let personasInsertadas = [];
  const revision = require(resolve(raiz, "Referencias/importacion-arbol-genealogico-revision.json"));
  const { importarPersonasDesdeExcel } = cargarModulo("lib/importacion-excel-actions.ts", {
    "next/cache": { revalidatePath: () => {} },
    "@/Referencias/importacion-arbol-genealogico-revision.json": { default: revision },
    "@/lib/supabase/server": {
      createClient: async () => ({
        from: (tabla) => {
          tablasConsultadas.push(tabla);
          assert.equal(tabla, "personas", "la importación no debe tocar tablas de vínculos, documentos ni Bitácora");
          return {
            select: () => ({ data: [], error: null }),
            insert: (filas) => {
              personasInsertadas = filas;
              return { select: () => ({ data: filas.map((_, indice) => ({ id: `nueva-${indice}` })), error: null }) };
            },
          };
        },
      }),
    },
  });

  const resultado = await importarPersonasDesdeExcel();
  assert.deepEqual(resultado, { error: null, importadas: 50, existentes: 2, conflictos: [] });
  assert.equal(personasInsertadas.length, 50);
  assert.deepEqual(new Set(tablasConsultadas), new Set(["personas"]));
  assert.equal(personasInsertadas.every((persona) => persona.genero === "no_definido"), true);
});

test("integración a escala: cuatro líneas de sangre conservan cobertura, raíces y tarjetas únicas", () => {
  const personas = [
    // Línea A: cuatro generaciones y tres personas presentes sólo por pareja.
    persona("a-raiz", { hijos: ["a-hija", "a-hijo"], nacimiento: "1900-01-01" }),
    persona("a-hija", { padres: ["a-raiz"], hijos: ["a-nieto"], nacimiento: "1925-01-01" }),
    persona("a-hijo", { padres: ["a-raiz"], conyuges: ["a-pareja-hijo"], nacimiento: "1928-01-01" }),
    persona("a-pareja-hijo", { conyuges: ["a-hijo"], nacimiento: "1930-01-01" }),
    persona("a-nieto", { padres: ["a-hija"], hijos: ["a-bisnieto", "a-bisnieta"], nacimiento: "1950-01-01" }),
    persona("a-bisnieto", { padres: ["a-nieto"], conyuges: ["a-pareja-bisnieto"], nacimiento: "1975-01-01" }),
    persona("a-bisnieta", { padres: ["a-nieto"], conyuges: ["a-pareja-bisnieta"], nacimiento: "1978-01-01" }),
    persona("a-pareja-bisnieto", { conyuges: ["a-bisnieto"], nacimiento: "1976-01-01" }),
    persona("a-pareja-bisnieta", { conyuges: ["a-bisnieta"], nacimiento: "1979-01-01" }),

    // Línea B: un integrante con dos matrimonios y una descendencia por unión.
    persona("b-raiz", { hijos: ["b-hijo"], conyuges: ["b-pareja"], nacimiento: "1902-01-01" }),
    persona("b-pareja", { hijos: ["b-hijo"], conyuges: ["b-raiz"], nacimiento: "1904-01-01" }),
    persona("b-hijo", { padres: ["b-raiz", "b-pareja"], hijos: ["b-nieto-uno", "b-nieto-dos"], conyuges: ["b-pareja-uno", "b-pareja-dos"], nacimiento: "1930-01-01" }),
    persona("b-pareja-uno", { hijos: ["b-nieto-uno"], conyuges: ["b-hijo"], nacimiento: "1932-01-01" }),
    persona("b-pareja-dos", { hijos: ["b-nieto-dos"], conyuges: ["b-hijo"], nacimiento: "1936-01-01" }),
    persona("b-nieto-uno", { padres: ["b-hijo", "b-pareja-uno"], hijos: ["b-bisnieto-uno"], nacimiento: "1955-01-01" }),
    persona("b-nieto-dos", { padres: ["b-hijo", "b-pareja-dos"], hijos: ["b-bisnieto-dos"], nacimiento: "1958-01-01" }),
    persona("b-bisnieto-uno", { padres: ["b-nieto-uno"], nacimiento: "1980-01-01" }),
    persona("b-bisnieto-dos", { padres: ["b-nieto-dos"], nacimiento: "1983-01-01" }),

    // Línea C: C-hijo-uno y C-hijo-dos son medios hermanos por C-raiz.
    persona("c-raiz", { hijos: ["c-hijo-uno", "c-hijo-dos"], conyuges: ["c-pareja-uno", "c-pareja-dos"], nacimiento: "1905-01-01" }),
    persona("c-pareja-uno", { hijos: ["c-hijo-uno"], conyuges: ["c-raiz"], nacimiento: "1908-01-01" }),
    persona("c-pareja-dos", { hijos: ["c-hijo-dos"], conyuges: ["c-raiz"], nacimiento: "1912-01-01" }),
    persona("c-hijo-uno", { padres: ["c-raiz", "c-pareja-uno"], hijos: ["c-nieto-uno"], nacimiento: "1932-01-01" }),
    persona("c-hijo-dos", { padres: ["c-raiz", "c-pareja-dos"], hijos: ["c-nieto-dos"], nacimiento: "1935-01-01" }),
    persona("c-nieto-uno", { padres: ["c-hijo-uno"], hijos: ["c-bisnieto-uno"], nacimiento: "1958-01-01" }),
    persona("c-nieto-dos", { padres: ["c-hijo-dos"], hijos: ["c-bisnieto-dos"], nacimiento: "1962-01-01" }),
    persona("c-bisnieto-uno", { padres: ["c-nieto-uno"], nacimiento: "1984-01-01" }),
    persona("c-bisnieto-dos", { padres: ["c-nieto-dos"], nacimiento: "1988-01-01" }),

    // Línea D: otra rama de cuatro generaciones con parejas sin filiación.
    persona("d-raiz", { hijos: ["d-hijo", "d-hija"], nacimiento: "1907-01-01" }),
    persona("d-hijo", { padres: ["d-raiz"], hijos: ["d-nieto"], nacimiento: "1933-01-01" }),
    persona("d-hija", { padres: ["d-raiz"], conyuges: ["d-pareja-hija"], nacimiento: "1936-01-01" }),
    persona("d-pareja-hija", { conyuges: ["d-hija"], nacimiento: "1935-01-01" }),
    persona("d-nieto", { padres: ["d-hijo"], hijos: ["d-bisnieto", "d-bisnieta"], nacimiento: "1960-01-01" }),
    persona("d-bisnieto", { padres: ["d-nieto"], conyuges: ["d-pareja-bisnieto"], nacimiento: "1985-01-01" }),
    persona("d-bisnieta", { padres: ["d-nieto"], conyuges: ["d-pareja-bisnieta"], nacimiento: "1987-01-01" }),
    persona("d-pareja-bisnieto", { conyuges: ["d-bisnieto"], nacimiento: "1986-01-01" }),
    persona("d-pareja-bisnieta", { conyuges: ["d-bisnieta"], nacimiento: "1989-01-01" }),
  ];
  const raicesLayoutEsperadas = new Set(["a-raiz", "b-raiz", "c-raiz", "d-raiz"]);
  const soloPorPareja = new Set(["a-pareja-hijo", "a-pareja-bisnieto", "a-pareja-bisnieta", "d-pareja-hija", "d-pareja-bisnieto", "d-pareja-bisnieta"]);

  assert.equal(personas.length, 36);
  const modelo = crearModeloArbol(personas);
  assert.equal(modelo.componentes.length, 4);
  assert.deepEqual(
    new Set(modelo.componentes.flatMap(({ raicesAncestrales }) => raicesAncestrales)),
    new Set(["a-raiz", "b-raiz", "b-pareja", "b-pareja-uno", "b-pareja-dos", "c-raiz", "c-pareja-uno", "c-pareja-dos", "d-raiz"]),
  );
  assert.equal(modelo.componentes.flatMap(({ raicesAncestrales }) => raicesAncestrales).some((id) => soloPorPareja.has(id)), false);

  const datos = crearDatosFamilyChart(personas);
  const auditoria = diagnosticarDatosFamilyChart(datos);
  const auditoriaModelo = diagnosticarModeloArbol(personas);
  assert.deepEqual(auditoria.errores, []);
  assert.deepEqual(auditoriaModelo.errores, []);
  assert.equal(auditoria.cantidadPersonas, 36);
  assert.equal(auditoria.cantidadAlcanzables, 36);
  assert.deepEqual(auditoria.faltantes, []);
  assert.deepEqual(new Set(auditoria.raicesLayout), raicesLayoutEsperadas);
  assert.deepEqual(
    new Set(datos.filter((dato) => dato.data.sinLineaSangre).map((dato) => dato.id)),
    soloPorPareja,
    "la marca visual debe derivarse sólo para parejas sin filiación propia",
  );
  const vinculos = crearVinculosVisualesArbol(modelo);
  assert.equal(new Set(vinculos.map(({ id }) => id)).size, vinculos.length, "cada línea real debe generarse una sola vez");

  const renderizados = idsRenderizados(datos);
  assert.equal(renderizados.length, personas.length, "family-chart debe crear exactamente una tarjeta por persona");
  assert.equal(new Set(renderizados).size, personas.length, "no debe haber tarjetas duplicadas");
  assert.deepEqual(new Set(renderizados), new Set(personas.map(({ id }) => id)), "las 36 personas deben ser alcanzables en el layout");
});

test("el orden horizontal conserva a cuatro hermanos consecutivos y deja la pareja junto al hermano correspondiente", () => {
  const personas = [
    persona("padre", { hijos: ["hermana-mayor", "hermano-con-pareja", "hermana-menor", "hermano-menor"], conyuges: ["madre"], nacimiento: "1945-01-01" }),
    persona("madre", { hijos: ["hermana-mayor", "hermano-con-pareja", "hermana-menor", "hermano-menor"], conyuges: ["padre"], nacimiento: "1948-01-01" }),
    persona("hermana-mayor", { padres: ["padre", "madre"], nacimiento: "1970-01-01" }),
    persona("hermano-con-pareja", { padres: ["padre", "madre"], conyuges: ["pareja-sin-filiacion"], nacimiento: "1973-01-01" }),
    persona("hermana-menor", { padres: ["padre", "madre"], nacimiento: "1976-01-01" }),
    persona("hermano-menor", { padres: ["padre", "madre"], nacimiento: "1979-01-01" }),
    persona("pareja-sin-filiacion", { conyuges: ["hermano-con-pareja"], nacimiento: "1974-01-01" }),
  ];
  const datos = crearDatosFamilyChart(personas);
  const idsEnLaFila = new Set(["hermana-mayor", "hermano-con-pareja", "hermana-menor", "hermano-menor", "pareja-sin-filiacion"]);
  const fila = calcularArbol(datos).data
    .filter((dato) => idsEnLaFila.has(dato.data.id))
    .sort((a, b) => a.x - b.x)
    .map((dato) => dato.data.id);

  assert.deepEqual(fila, ["hermana-mayor", "hermana-menor", "hermano-menor", "hermano-con-pareja", "pareja-sin-filiacion"]);
  assert.equal(datos.find((dato) => dato.id === "pareja-sin-filiacion")?.data.sinLineaSangre, true);
  assert.equal(datos.find((dato) => dato.id === "hermano-con-pareja")?.data.sinLineaSangre, false);
});

test("la geometría ampliada evita solapamientos entre padres, hijos, hermanos y parejas", () => {
  const personas = [
    persona("padre", { hijos: ["hija-uno", "hijo-dos", "hija-tres"], conyuges: ["madre"], nacimiento: "1945-01-01" }),
    persona("madre", { hijos: ["hija-uno", "hijo-dos", "hija-tres"], conyuges: ["padre"], nacimiento: "1948-01-01" }),
    persona("hija-uno", { padres: ["padre", "madre"], nacimiento: "1970-01-01" }),
    persona("hijo-dos", { padres: ["padre", "madre"], conyuges: ["pareja"], nacimiento: "1973-01-01" }),
    persona("pareja", { conyuges: ["hijo-dos"], nacimiento: "1974-01-01" }),
    persona("hija-tres", { padres: ["padre", "madre"], nacimiento: "1976-01-01" }),
  ];
  const nodos = calcularArbol(crearDatosFamilyChart(personas)).data
    .filter((dato) => dato.data.id !== RAIZ_MAPA_ID);

  for (let indice = 0; indice < nodos.length; indice += 1) {
    for (let otroIndice = indice + 1; otroIndice < nodos.length; otroIndice += 1) {
      const primero = nodos[indice];
      const segundo = nodos[otroIndice];
      const seSuperponenHorizontalmente = Math.abs(primero.x - segundo.x) < GEOMETRIA_ARBOL.anchoNodo;
      const seSuperponenVerticalmente = Math.abs(primero.y - segundo.y) < GEOMETRIA_ARBOL.altoNodo;

      assert.equal(
        seSuperponenHorizontalmente && seSuperponenVerticalmente,
        false,
        `${primero.data.id} y ${segundo.data.id} no deben superponerse`,
      );
    }
  }
});
