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

const { compararHijosParaLayout, crearDatosFamilyChart, crearModeloArbol, diagnosticarDatosFamilyChart, ordenarConyugesParaLayout, RAIZ_MAPA_ID } = cargarTransformador();

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

function personasDesdeDatos(datos) {
  return datos
    .filter((dato) => dato.id !== RAIZ_MAPA_ID)
    .map((dato) => persona(dato.id, {
      padres: dato.rels.parents,
      hijos: dato.rels.children,
      conyuges: dato.rels.spouses,
      nacimiento: dato.data.orden?.slice(0, 10) === "9999-99-99" ? "9999-01-01" : dato.data.orden?.slice(0, 10),
    }));
}

function calcularArbol(datos) {
  return calculateTree(structuredClone(datos), {
    main_id: RAIZ_MAPA_ID,
    single_parent_empty_card: false,
    ancestry_depth: 99,
    progeny_depth: 99,
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

test("regresión: un cónyuge sin sangre no puede ganar el ancla del árbol real", () => {
  const diagnostico = JSON.parse(readFileSync(resolve(raiz, "Referencias/diagnostico-family-chart-datos-reales.json"), "utf8"));
  const personas = personasDesdeDatos(diagnostico.datosFamilyChart);
  const modelo = crearModeloArbol(personas);
  const yamil = "eb13f625-d872-4ddd-a536-4ed230a22e68";
  const giusseppe = "4d73b14d-5b01-409d-9c4f-e531531dab17";

  assert.equal(diagnostico.datosFamilyChart[0].rels.children[0], yamil, "el archivo de diagnóstico conserva la ancla defectuosa original");
  assert.equal(modelo.componentes.length, 1);
  assert.equal(modelo.componentes[0].ancla, giusseppe);
  assert.equal(modelo.componentes[0].criterioAncla, "raiz-con-descendencia");
  assert.notEqual(modelo.componentes[0].ancla, yamil);

  const datos = crearDatosFamilyChart(personas);
  assert.equal(datos[0].rels.children[0], giusseppe);
  const renderizados = idsRenderizados(datos);
  assert.equal(new Set(renderizados).size, 11);
  assert.deepEqual(new Set(renderizados), new Set(personas.map(({ id }) => id)));
});

test("cuatro componentes conservan una sola ancla por componente y todos se renderizan", () => {
  const personas = [
    persona("a-raiz", { hijos: ["a-hija"], nacimiento: "1900-01-01" }),
    persona("a-hija", { padres: ["a-raiz"], conyuges: ["a-pareja"], nacimiento: "1930-01-01" }),
    persona("a-pareja", { conyuges: ["a-hija"], nacimiento: "1931-01-01" }),
    persona("b-raiz", { hijos: ["b-hijo"], nacimiento: "1910-01-01" }),
    persona("b-hijo", { padres: ["b-raiz"], nacimiento: "1940-01-01" }),
    persona("c-raiz", { hijos: ["c-hija"], nacimiento: "1920-01-01" }),
    persona("c-hija", { padres: ["c-raiz"], nacimiento: "1950-01-01" }),
    persona("d-uno", { conyuges: ["d-dos"], nacimiento: "1960-01-01" }),
    persona("d-dos", { conyuges: ["d-uno"], nacimiento: "1961-01-01" }),
  ];
  const modelo = crearModeloArbol(personas);

  assert.equal(modelo.componentes.length, 4);
  assert.deepEqual(
    modelo.componentes.map(({ ancla, criterioAncla }) => ({ ancla, criterioAncla })).sort((a, b) => a.ancla.localeCompare(b.ancla)),
    [
      { ancla: "a-raiz", criterioAncla: "raiz-con-descendencia" },
      { ancla: "b-raiz", criterioAncla: "raiz-con-descendencia" },
      { ancla: "c-raiz", criterioAncla: "raiz-con-descendencia" },
      { ancla: "d-uno", criterioAncla: "solo-conyugal" },
    ],
  );
  const renderizados = idsRenderizados(crearDatosFamilyChart(personas));
  assert.equal(new Set(renderizados).size, personas.length);
  assert.deepEqual(new Set(renderizados), new Set(personas.map(({ id }) => id)));
});

test("al fusionar por matrimonio, dos componentes se vuelven uno sin anclas residuales ni personas perdidas", () => {
  const separadas = [
    persona("alfa-raiz", { hijos: ["alfa-hija"], nacimiento: "1900-01-01" }),
    persona("alfa-hija", { padres: ["alfa-raiz"], nacimiento: "1930-01-01" }),
    persona("beta", { nacimiento: "1932-01-01" }),
  ];
  const modeloSeparado = crearModeloArbol(separadas);
  assert.equal(modeloSeparado.componentes.length, 2);
  assert.equal(componente(modeloSeparado, "alfa-raiz").ancla, "alfa-raiz");
  assert.equal(componente(modeloSeparado, "beta").ancla, "beta");

  const fusionadas = [
    persona("alfa-raiz", { hijos: ["alfa-hija"], nacimiento: "1900-01-01" }),
    persona("alfa-hija", { padres: ["alfa-raiz"], conyuges: ["beta"], nacimiento: "1930-01-01" }),
    persona("beta", { conyuges: ["alfa-hija"], nacimiento: "1932-01-01" }),
  ];
  const modeloFusionado = crearModeloArbol(fusionadas);
  assert.equal(modeloFusionado.componentes.length, 1);
  assert.equal(modeloFusionado.componentes[0].ancla, "alfa-raiz");
  assert.deepEqual(crearDatosFamilyChart(fusionadas)[0].rels.children, ["alfa-raiz"]);
  const renderizados = idsRenderizados(crearDatosFamilyChart(fusionadas));
  assert.equal(new Set(renderizados).size, fusionadas.length);
  assert.deepEqual(new Set(renderizados), new Set(fusionadas.map(({ id }) => id)));
});

test("si el ancla deja de ser válida, se recalcula tras desvincular y se bloquea su borrado mientras conserva la filiación", async () => {
  const conFiliacion = [
    persona("a", { hijos: ["b"], nacimiento: "1900-01-01" }),
    persona("b", { padres: ["a"], hijos: ["c"], nacimiento: "1930-01-01" }),
    persona("c", { padres: ["b"], hijos: ["d"], nacimiento: "1960-01-01" }),
    persona("d", { padres: ["c"], nacimiento: "1990-01-01" }),
  ];

  assert.equal(componente(crearModeloArbol(conFiliacion), "a").ancla, "a");

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
  assert.equal(componenteB.ancla, "b");
  assert.equal(componenteB.criterioAncla, "raiz-con-descendencia");
  assert.deepEqual(new Set(componenteB.ids), new Set(["b", "c", "d"]));
  const renderizadosSinFiliacion = idsRenderizados(crearDatosFamilyChart(sinFiliacionAB));
  assert.equal(new Set(renderizadosSinFiliacion).size, sinFiliacionAB.length, "no debe haber tarjetas duplicadas");
  assert.deepEqual(new Set(renderizadosSinFiliacion), new Set(sinFiliacionAB.map(({ id }) => id)), "no debe perderse nadie al recalcular las anclas");

  const sinA = sinFiliacionAB.filter(({ id }) => id !== "a");
  const modeloSinA = crearModeloArbol(sinA);
  assert.equal(modeloSinA.componentes.length, 1);
  assert.equal(modeloSinA.componentes[0].ancla, "b");
  assert.equal(modeloSinA.componentes[0].criterioAncla, "raiz-con-descendencia");
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

test("integración a escala: cuatro líneas de sangre conservan cobertura, anclas y tarjetas únicas", () => {
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
  const anclasEsperadas = new Set(["a-raiz", "b-raiz", "c-raiz", "d-raiz"]);
  const soloPorPareja = new Set(["a-pareja-hijo", "a-pareja-bisnieto", "a-pareja-bisnieta", "d-pareja-hija", "d-pareja-bisnieto", "d-pareja-bisnieta"]);

  assert.equal(personas.length, 36);
  const modelo = crearModeloArbol(personas);
  assert.equal(modelo.componentes.length, 4);
  assert.deepEqual(new Set(modelo.componentes.map(({ ancla }) => ancla)), anclasEsperadas);
  modelo.componentes.forEach(({ ancla, criterioAncla }) => {
    assert.equal(criterioAncla, "raiz-con-descendencia");
    assert.equal(soloPorPareja.has(ancla), false, "una persona sólo conyugal no puede reemplazar a una raíz de sangre");
  });

  const datos = crearDatosFamilyChart(personas);
  const auditoria = diagnosticarDatosFamilyChart(datos);
  assert.deepEqual(auditoria.errores, []);
  assert.equal(auditoria.cantidadPersonas, 36);
  assert.equal(auditoria.cantidadAlcanzables, 36);
  assert.deepEqual(auditoria.faltantes, []);
  assert.deepEqual(
    new Set(datos.filter((dato) => dato.data.sinLineaSangre).map((dato) => dato.id)),
    soloPorPareja,
    "la marca visual debe derivarse sólo para parejas sin filiación propia",
  );

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
