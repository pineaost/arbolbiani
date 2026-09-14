import { readFileSync } from "node:fs";

// Foto real guardada en el proyecto. Las relaciones se reconstruyen de ambos
// sentidos y de las familias auditadas; no se infieren del Excel ni de apellidos.
export function datosReales() {
  const foto = JSON.parse(readFileSync(new URL("../Referencias/diagnostico-family-chart-datos-reales.json", import.meta.url), "utf8"));
  return foto.datosFamilyChart.filter(p => !p.data.virtual).map(p => ({
    id: p.id, nombre: p.data.nombre, apellido: p.data.apellido,
    genero: p.data.gender === "M" ? "masculino" : "femenino",
    fecha_nacimiento: p.data.orden.slice(0, 10).startsWith("9999") ? null : p.data.orden.slice(0, 10),
    fecha_fallecimiento: null, lugar_nacimiento: null, lugar_fallecimiento: null,
    notas: null, created_at: "", updated_at: "",
    padres_ids: [...p.rels.parents], hijos_ids: [...p.rels.children], conyuges_ids: [...p.rels.spouses], hermanos_ids: [],
  }));
}
