# Árbol Biani — Rediseño del layout genealógico

## 1. Diagnóstico del problema actual

Hoy el posicionamiento **no lo calcula esta aplicación**: lo calcula `family-chart` (`calculateTree`, vía `createChart` en `arbol-client.tsx`). El código propio (`arbol-chart.ts`) solo hace dos cosas:

1. **Reduce el grafo genealógico real a un árbol de un solo padre por hijo y un solo "propietario" por cónyuge** (`crearBosqueLayoutArbol`), porque `family-chart` —como casi cualquier motor de árbol jerárquico— necesita una jerarquía estricta, no un grafo con matrimonios que unen ramas ni hijos con dos padres.
2. **Dibuja por encima, como overlay SVG independiente**, todos los vínculos reales (`crearVinculosVisualesArbol` + `dibujarVinculosNormalizados`) — incluyendo el segundo padre, cónyuges no "propietarios", etc. — como curvas de Bézier libres entre las posiciones que `family-chart` ya decidió.

Esto ya explica los tres síntomas:

**(1) Líneas larguísimas o raras.** No son un bug del trazado de la curva: son la consecuencia directa de que la posición de los dos nodos que hay que unir fue decidida por una jerarquía que *no sabe que ese vínculo existe*. El vínculo "secundario" (segundo padre, cónyuge no adjunto) se dibuja donde caiga, sin que el algoritmo de posicionamiento haya intentado acercarlos.

**(2) Personas del lado equivocado de su rama.** La elección de "padre principal" (`padrePrincipalPorHijo`) se decide así, en `crearBosqueLayoutArbol`:
```
candidatos.sort((a,b) => profundidad(b) - profundidad(a) || claveOrden(a) vs claveOrden(b))
```
Es decir: se prioriza al progenitor con **mayor profundidad generacional** y, en empate, por **fecha de nacimiento/apellido/nombre alfabético**. No hay ningún criterio de "cuál de los dos progenitores conviene visualmente para minimizar distancia con el resto de la rama". Es una heurística para garantizar que el árbol resultante sea válido (sin ciclos), no para que quede prolijo. Lo mismo pasa con la elección de quién es "propietario" del cónyuge (`seleccionarConyugesAdjuntos`): prioriza filiación propia y cantidad de cónyuges, no cercanía visual.

**(3) Familias muy pegadas.** `GEOMETRIA_ARBOL` define separaciones **fijas y globales** (`separacionHorizontal: 216`, `separacionVertical: 148`) que `family-chart` aplica de manera uniforme entre nodos y niveles. No existe ningún concepto de "espacio extra entre subárboles que pertenecen a componentes/ramas distintas". Todo el árbol —una familia de 3 generaciones y otra de 4— se apila con el mismo gap parejo.

**Limitación estructural de fondo:** el sistema delega el cálculo geométrico a una librería genérica de árboles jerárquicos y solo puede influir en el resultado a través de dos hooks de *orden* (`setSortChildrenFunction`, `setSortSpousesFunction`). Orden no es lo mismo que geometría: podés reordenar quién va primero, pero no podés decirle "reservale este ancho a esta rama" ni "centrá a esta pareja respecto de su descendencia real (incluyendo la del otro cónyuge)". Family-chart no expone ancho de subárbol dinámico ni separación entre componentes. Por eso las mejoras posibles dentro del esquema actual son cosméticas; el problema es de arquitectura, no de parámetros.

## 2. Modelo conceptual recomendado

Cambiar la unidad de layout de **persona** a **unidad familiar** (pareja + hijos compartidos). Esto ya lo tienen implícitamente en el modelo de datos (`ModeloArbol.familias` en `arbol-chart.ts` ya calcula esto), pero no se usa para geometría, solo para agrupar en el objeto de diagnóstico.

Conceptos:

- **Nodo-persona**: una persona individual, con ancho fijo (`GEOMETRIA_ARBOL.anchoNodo`).
- **Nodo-pareja**: dos personas cónyuges dibujadas contiguas (o una persona sola si no tiene cónyuge en ese contexto).
- **Unidad familiar**: una pareja (o persona sola) + sus hijos comunes, tratada como subárbol con ancho propio = máx(ancho propio de la pareja, suma de anchos de subárboles de los hijos + separaciones).
- **Componente**: igual que hoy (`ModeloArbol.componentes`), un grupo conectado por filiación o matrimonio. Cada componente es una "familia" en el sentido del pedido del usuario y debe tener aire respecto a los demás.

La reducción a jerarquía sigue siendo inevitable (una persona no puede estar en dos coordenadas a la vez), pero el criterio de elección de "dónde vive" cada persona pasa a ser **geométrico** (qué colocación minimiza el ancho total y la distancia a sus vínculos reales), no alfabético/generacional.

## 3. Algoritmo de posicionamiento propuesto

Reemplaza el cálculo interno de `family-chart` por un **Reingold–Tilford / Walker's algorithm adaptado a unidades familiares**, corrido enteramente en nuestro código (family-chart deja de calcular posiciones; como mucho se lo puede seguir usando para el DOM/pan-zoom si conviene, pero lo más limpio es sacarlo del camino crítico y controlar el SVG directamente, ya que el overlay de vínculos ya lo hacemos manualmente).

Pasos:

1. **Construir el bosque de unidades familiares** (no de personas sueltas). Para cada componente, agrupar en familias (`pareja + hijos comunes`) reutilizando `ModeloArbol.familias`.
2. **Elegir la familia "primaria" de cada persona con hijos en más de una familia** (poligamia sucesiva, medios hermanos) usando un criterio geométrico: la familia con más descendientes propios primero; en empate, la más antigua (fecha de matrimonio/nacimiento del hijo mayor). Esto reemplaza el actual `padrePrincipalPorHijo`.
3. **Calcular recursivamente el ancho de cada subárbol** (post-orden, de hojas hacia raíz):
   - ancho(hoja) = anchoNodo (o anchoNodoPareja si tiene cónyuge sin descendencia adicional propia)
   - ancho(unidad familiar) = max(anchoParejaPropia, Σ ancho(hijo_i) + separación×(n−1))
4. **Posicionar de raíz hacia hojas (pre-orden)**: a cada unidad familiar se le asigna un rango horizontal `[x0, x0+ancho]`; dentro de ese rango, la pareja se centra respecto al centro de masa de sus hijos (no respecto al propio ancho), y cada hijo recibe un sub-rango proporcional a su propio ancho de subárbol, en el orden que definan `compararHijosParaLayout` (edad/orden, no alfabético puro salvo empate).
5. **Cónyuges adicionales sin descendencia común con la línea principal** (ver punto 5) se posicionan pegados al lado correspondiente de la persona, ampliando el ancho de esa unidad, no como nodos sueltos flotantes.
6. **Separación entre componentes**: después de calcular el ancho de cada componente, apilarlos horizontalmente con un margen explícito y mayor al espaciado intra-familiar (p. ej. 3× `separacionHorizontal`), en vez del espaciado uniforme actual.
7. **Nivel vertical (generación)**: en vez de fijar todos los componentes arrancando en la misma fila 0, dejar que cada componente empiece en la generación real de su raíz más antigua respecto a un eje temporal común (esto ya lo pide el usuario explícitamente: "una familia con pocas generaciones podría comenzar más abajo"). Esto requiere anclar la posición vertical no por "profundidad BFS desde la raíz del árbol" sino por **fecha de nacimiento estimada / generación absoluta**, para que dos ramas que se van a unir por matrimonio en el medio del árbol no arranquen ambas arriba del todo si una tiene menos generaciones que la otra.
8. **Pasada final de ajuste**: una vez estabilizadas las posiciones "puras" del árbol jerárquico, correr una pasada de reconciliación para los vínculos que cruzan unidades familiares (ver punto 4) — desplazamientos locales pequeños para acortar esas líneas específicas sin romper la jerarquía general, similar a lo que hace Walker's algorithm en su fase de "ajuste de contornos".

Este es exactamente el enfoque que vos propusiste en tu "posible enfoque a evaluar" — coincide punto por punto con Reingold–Tilford generalizado a unidades familiares. Lo confirmo como el camino correcto, no hace falta buscar algo más exótico.

## 4. Estrategia para dibujar las líneas

Mantener el patrón actual (vínculos como overlay SVG separado de los nodos, dibujados en `dibujarVinculosNormalizados` después de que las posiciones estén estables) — **eso está bien diseñado y no hay que tocarlo**. Lo que cambia es que, al posicionar por unidad familiar y centrar padres sobre hijos, la gran mayoría de vínculos de filiación van a quedar casi verticales y cortos por construcción, sin necesidad de lógica especial de trazado.

Para los vínculos "cruzados" que sí van a seguir existiendo (segundo matrimonio no-primario, medio hermano cuya familia primaria es la otra), conviene:
- Curvas con mayor curvatura controlada (no la Bézier simple actual) para que se note visualmente que es un vínculo "secundario" y no compita con las líneas principales.
- Opcional: un estilo de línea distinto (punteado o más fino) para vínculos no-primarios, ayuda a la lectura sin necesidad de que la geometría sea perfecta en el 100% de los casos (algo de longitud extra en vínculos secundarios es aceptable y esperable en cualquier árbol con matrimonios múltiples).

## 5. Múltiples cónyuges e hijos de distintas parejas

- Cada persona puede tener 0, 1 o N unidades familiares (una por cónyuge con el que tuvo hijos, más posibles cónyuges sin hijos).
- Se elige una **unidad familiar primaria** por persona (criterio del paso 2) para el posicionamiento jerárquico.
- Las unidades familiares no-primarias de esa misma persona se dibujan **adosadas al costado**, como haces hoy con "propietario/adjunto", pero ahora el ancho de esas unidades secundarias también se reserva explícitamente en el cálculo de ancho del padre (paso 3), en vez de ser invisibles para el algoritmo de ancho como pasa hoy.
- Los hijos de la unión no-primaria se posicionan como descendientes de esa unidad secundaria (con su propio subárbol), no se intenta forzarlos a colgar del mismo punto que los hijos de la unión primaria. Esto evita el amontonamiento de hermanos y medios hermanos en una sola fila indiferenciada.

## 6. Criterios de separación entre ramas

- **Separación intra-unidad familiar**: la actual (`separacionHorizontal`/`separacionVertical`), sin cambios.
- **Separación entre unidades familiares hermanas dentro del mismo componente**: un valor intermedio, configurable, mayor al intra-familiar (p. ej. 1.5×).
- **Separación entre componentes distintos** (familias sin ningún vínculo entre sí, o que solo se van a unir más abajo por un matrimonio): la mayor de todas, y además con un separador visual (línea guía tenue, o simplemente el margen es suficiente — evaluarlo con datos reales antes de sumar chrome visual).
- Cuando dos componentes se conectan por matrimonio en un punto intermedio del árbol (el caso de "tres ramas conectadas por matrimonios" que ya cubre el test), el margen entre sus raíces ancestrales respectivas debería seguir siendo generoso arriba, aunque el punto de unión las acerque más abajo — no colapsar todo el ancho solo porque en un nivel se tocan.

## 7. Casos borde a probar

Todos estos ya existen como fixtures conceptuales en `arbol-chart_test.mjs`, hay que extenderlos con aserciones de **posición**, no solo de cobertura/reciprocidad (que es lo único que se verifica hoy):

1. Pareja con hijos propios + un cónyuge previo del mismo progenitor con hijos propios (medios hermanos) — verificar que ambas ramas de hijos no se solapen y que la unión visual sea clara.
2. Cuatro líneas de sangre conectadas por matrimonios en distintos niveles (ya existe el test de integración a escala) — agregar aserción de que el ancho total no colapsa entre componentes.
3. Persona con 3+ matrimonios sucesivos.
4. Árbol muy asimétrico: una rama con 2 generaciones y otra con 6, que se unen por matrimonio en el medio (para validar el punto 7 del algoritmo — anclaje vertical por generación real, no por profundidad BFS).
5. Ciclo de filiación inválido (ya cubierto, debe seguir bloqueado en el modelo antes de llegar al layout).
6. Hijo con dos padres donde ambos tienen alta profundidad/muchos descendientes propios (empate en el criterio de familia primaria) — decidir un desempate determinista y testearlo explícitamente.
7. Persona sin ningún vínculo (nodo aislado) — no debe generar un componente con ancho cero raro ni quedar pegado al borde.

## 8. Archivos a modificar

- **`lib/arbol-chart.ts`**: acá vive hoy toda la lógica de modelo y bosque. Este archivo pasa a absorber también el cálculo de posiciones (nuevas funciones tipo `calcularAnchosSubarbol`, `posicionarArbol`), reemplazando la responsabilidad que hoy tiene `family-chart` internamente. `crearDatosFamilyChart` probablemente deja de ser necesaria tal cual, o se transforma en la función que arma la estructura de entrada al nuevo posicionador.
- **`components/arbol/arbol-client.tsx`**: hoy inicializa `family-chart` con `createChart(...)` y usa sus métodos de zoom/pan (`f3.handlers.treeFit`, `cardToMiddle`, `manualZoom`, `getCurrentZoom`). Si se saca a family-chart del cálculo de posiciones, hay que decidir si se sigue usando solo por su capa de pan/zoom (alimentándola con nuestras posiciones ya calculadas, si su API lo permite) o si se reemplaza también esa capa por una implementación propia con `d3-zoom` directamente (ya está en dependencias vía `family-chart`, se podría usar standalone). Recomiendo evaluarlo aparte: es una decisión de scope, no bloquea el rediseño del layout.
- **`tests/arbol-chart.test.mjs`** (o el archivo referenciado como `arbol-chart_test.mjs`): extender con los casos borde del punto 7, incluyendo aserciones de posición (`x`, `y`) y no solo de cobertura.
- **`GEOMETRIA_ARBOL`**: agregar las nuevas constantes de separación (entre unidades familiares hermanas, entre componentes).

No hace falta tocar `sakura-backdrop.tsx`, la capa visual de fichas (`globals.css`) ni nada de Archivo Familiar — el cambio es puramente de cálculo geométrico dentro del Árbol.

## 9. Instrucciones para Codex

1. No tocar el modelo de datos (`crearModeloArbol`, detección de ciclos, `familias`, `componentes`) — está bien y ya lo usa este plan tal cual.
2. Implementar el cálculo de ancho de subárbol en post-orden y el posicionamiento en pre-orden como funciones puras que reciban `ModeloArbol` y devuelvan un mapa `Map<personaId, {x, y}>` — testeable de forma aislada, sin DOM ni family-chart de por medio.
3. Mantener la separación de responsabilidades ya existente en el proyecto: cálculo de layout en `/lib`, DOM/render en `/components`. No mezclar cálculo geométrico dentro de `arbol-client.tsx`.
4. El overlay de vínculos (`crearVinculosVisualesArbol`, `dibujarVinculosNormalizados`) se mantiene conceptualmente igual, solo cambia el origen de las coordenadas de los nodos (ahora vienen de nuestro cálculo, no de `chart.store.getTree()`).
5. Hacerlo con un script idempotente y diagnóstico previo, como se viene trabajando en el proyecto: antes de tocar nada, correr el test suite actual y confirmar que sigue en verde con el modelo sin cambios; recién después introducir el nuevo posicionador detrás de una función claramente separada, corriendo ambos (viejo y nuevo) en paralelo sobre los mismos datos de prueba para comparar resultados antes de reemplazar definitivamente.
6. No optimizar prematuramente cruces de líneas a nivel grafo general (ver punto 10) — priorizar el criterio genealógico (padres centrados, parejas juntas, ramas separadas) por sobre la minimización abstracta de cruces.

## 10. ¿Conviene una librería externa?

**No para el cálculo posicional central.** Evaluación:

- **`d3-hierarchy` (d3.tree / d3.cluster)**: buena base matemática para Reingold-Tilford clásico, pero opera sobre árboles de un solo padre — no resuelve por sí solo el problema de unidades familiares (parejas, múltiples matrimonios). Se puede usar como *primitiva de bajo nivel* dentro de la implementación propia (para el cálculo de ancho/centrado de cada rama de hijos), pero la lógica de unidades familiares hay que escribirla igual.
- **`d3-flextree`**: extiende d3-hierarchy con tamaños de nodo variables — más cercano a lo que necesitamos si modelamos "unidad familiar" como un nodo de ancho variable. Es la opción externa más razonable si quieren apoyarse en algo en vez de escribir el post-orden/pre-orden a mano. Limitación: sigue pensando en árboles de un solo padre; las uniones no-primarias y el overlay de vínculos secundarios siguen siendo responsabilidad nuestra igual que hoy.
- **`dagre` / `elkjs`** (layout genérico de grafos dirigidos): **no lo recomiendo como motor principal**, y coincido con tu escepticismo. Minimizan cruces de aristas en un grafo genérico, pero no tienen ningún concepto de "pareja", "centrar padres sobre hijos" ni "generación". El resultado sería técnicamente sin cruces pero genealógicamente ilegible — exactamente el riesgo que señalás en el pedido. Podría eventualmente servir como *pasada de ajuste fino* opcional para el sub-problema de vínculos secundarios cruzados (punto 4), pero no como base.
- **Seguir con `family-chart`**: no, por lo explicado en el diagnóstico — no expone ancho de subárbol dinámico ni separación entre componentes, y su modelo de sort-only no alcanza para lo que se pide.

**Recomendación final**: implementación propia del algoritmo (Reingold-Tilford adaptado a unidades familiares), opcionalmente apoyada en `d3-flextree` para la mecánica de bajo nivel del ancho variable por nodo, manteniendo `family-chart` como mucho para utilidades de pan/zoom si conviene reusar esa capa, pero fuera del cálculo de posiciones.
