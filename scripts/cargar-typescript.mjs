import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
export function cargarTypescript(archivo, dependencias = {}, cache = new Map()) {
  archivo = resolve(archivo);
  if (cache.has(archivo)) return cache.get(archivo).exports;
  const modulo = { exports: {} };
  cache.set(archivo, modulo);
  const salida = ts.transpileModule(readFileSync(archivo, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: archivo,
  }).outputText;
  const importar = (nombre) => {
    if (nombre in dependencias) return dependencias[nombre];
    if (nombre.startsWith(".")) return cargarTypescript(resolve(dirname(archivo), `${nombre}.ts`), dependencias, cache);
    return require(nombre);
  };
  new Function("exports", "require", "module", salida)(modulo.exports, importar, modulo);
  return modulo.exports;
}
