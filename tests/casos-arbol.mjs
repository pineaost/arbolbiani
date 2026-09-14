export function persona(id, { padres = [], hijos = [], conyuges = [], nacimiento = "1950-01-01" } = {}) {
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


export function cuatroRamas() {
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

return personas;
}
