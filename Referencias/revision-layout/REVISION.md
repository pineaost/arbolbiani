# Revisión del árbol — 14 de septiembre de 2026

## Resultado y datos comprobados

Se verificaron la muestra histórica de 11 personas, la copia inicial de 121 personas y una segunda lectura autenticada de 119 personas durante la revisión final. Las copias contienen los campos necesarios para reproducir el layout; no contienen sesiones, credenciales, documentos, notas ni lugares.

La segunda lectura refleja cambios de datos realizados durante la revisión. Para comparar algoritmos se utiliza siempre la misma copia inicial de 121 personas:

| Medida | Implementación anterior | Implementación nueva |
| --- | ---: | ---: |
| Ancho del mapa | 21.944 px | 11.660 px |
| Distancia horizontal media entre unión parental e hijos | 1.414 px | 472 px |
| Distancia horizontal máxima entre unión parental e hijo | 14.510 px | 1.728 px |

La alineación final incluye a hermanos con un progenitor aún no registrado, aunque sus familias canónicas sean distintas. Esto preserva la estructura generacional, además de reducir las distancias.

En la copia final de 119 personas se comprueban todas las tarjetas y relaciones, sin solapamientos, filiaciones ascendentes, puertos inválidos, segmentos huérfanos, trazos desconectados ni líneas que atraviesen fichas. El mapa mide aproximadamente 7.313 × 1.628 px. Hay 8 contactos/intersecciones geométricas entre trazos diferentes; este contador incluye contactos, no solamente cruces propios. No se afirma planaridad absoluta.

## Causas encontradas

- El posicionador elegía una sola ascendencia para cada grupo conyugal. Las otras ramas participaban de los vínculos dibujados, pero no de la ubicación de la familia.
- Los coprogenitores sin matrimonio registrado no se trataban como unidad geométrica.
- Las contracciones de parejas y hermanos podían introducir ciclos en el grafo de generaciones; el fallback estimaba niveles sin garantizar todas las filiaciones.
- El bus horizontal de hijos omitía el ancla parental cuando ésta quedaba fuera del intervalo de hijos. Incluso una pareja con un solo hijo podía producir dos trazos desconectados.
- Cada vínculo decidía su recorrido por separado, sin reservar carriles para las otras familias.
- Permanecían un bosque técnico, funciones de `family-chart`, pruebas del motor retirado y estilos antiguos. Además, el hover desplazaba físicamente la ficha sin desplazar su conexión.

## Arquitectura vigente

- `lib/arbol-modelo.ts`: modelo canónico; filiación dirigida, cónyuges recíprocos, familias por conjunto exacto de progenitores, componentes conectados y detección de datos inválidos. Los hijos se ordenan por nacimiento, apellido, nombre e id. No se infiere el matrimonio a partir de la filiación.
- `lib/arbol-layout.ts`: generaciones mediante contracciones que conservan el grafo acíclico; bloques de parejas y coprogenitores compatibles; orden por grupos familiares; alineación horizontal con todas las ascendencias; separación mínima mediante proyección de filas; evaluación de cuatro órdenes iniciales deterministas. Una tanda de hermanos puede invertir su sentido cronológico para acercarse a otra rama. Las fechas sólo ayudan a situar componentes independientes, no separan hermanos ni contradicen filiaciones.
- `lib/arbol-vinculos.ts`: reserva conjunta de carriles, puertos en bordes de fichas, barras parentales y buses de hijos que siempre incluyen el ancla. Un buscador de corredores ortogonales evita tarjetas cuando una relación debe saltar niveles. La auditoría contrasta la continuidad de segmentos y sus contactos con tarjetas, no sólo los ids declarados.
- `lib/arbol-tipos.ts`: dimensiones, tipos y contrato del resultado.
- `lib/arbol-presentacion.ts`: marcos visuales para parejas adyacentes. No calcula ni modifica posiciones.
- `lib/arbol-chart.ts`: punto de entrada de estas responsabilidades.
- `components/arbol/arbol-client.tsx`: consume posiciones y trazos del mismo resultado. El desplazamiento y zoom transforman toda la escena conjuntamente. Los datos inválidos se presentan con un aviso para revisar Archivo Familiar.

`getPersonasArbol` mantiene la lectura paginada de personas, filiaciones y matrimonios, el orden estable de las consultas y las validaciones previas. Se revisaron también las altas, bajas, revalidaciones de páginas y la importación: no se modificó la base ni se infirieron relaciones de nombres, apellidos o notas.

## Remigio Lorenzo Biani y Esther Iris Podrecca

La última revisión conservó el posicionamiento aceptado y ajustó la presentación:

- Marco común alrededor de las dos fichas, con mayor presencia dentro de ramas numerosas. El marco no incluye a sus hermanos.
- Unión de pareja y punto de nacimiento de la descendencia más visibles.
- Barras de hermanos más suaves, conservando todos los segmentos sólidos y sus conexiones.
- Al seleccionar una persona se destacan los vínculos de la pareja y sus ascendencias; el resto queda en segundo plano hasta cerrar la selección.
- La regla se aplica a otras parejas comparables. Se omiten marcos superpuestos cuando hay múltiples cónyuges, para no sugerir exclusividad.

La [captura de la interfaz](pareja-remigio-esther.png) muestra este caso. La [vista SVG final](actual.svg) permite recorrer el conjunto con los mismos datos de prueba.

## Verificación y reproducción

- 46 pruebas: datos reales, determinismo con entradas invertidas, cobertura, continuidad, puertos, ausencia de colisiones, filiaciones de un progenitor, coparentalidad sin matrimonio, parejas entre ramas, hermanos completos y medios hermanos, ciclos, cinco y diez cónyuges, crecimiento reproducible, actualización de coordenadas y la presentación de Remigio/Esther.
- Comprobación de TypeScript y lint sin errores.
- Compilación de producción completada en una copia temporal aislada, conservando el servidor de desarrollo abierto.
- Revisión en la aplicación autenticada: fichas, navegación entre familiares, pareja dentro de hermanos numerosos y zoom.
- Comprobación del DOM: 119 fichas, 23 unidades de vínculo y 18 marcos de pareja. El zoom conserva los mismos puntos y trazos. Al seleccionar Remigio/Esther se destacan sus 3 conexiones familiares y las otras 20 quedan en segundo plano.

Ejecutar `npm test` y `npm run audit:arbol`. Este último regenera `actual.json` y `actual.svg` desde `personas-revision-final.json`. Para otra copia local, indicar la variable `ARBOL_DATOS`; la copia debe contener un array de `PersonaArbol`.

`base-anterior.*` y `base-actual.*` son la comparación sobre las mismas 121 personas. `anterior.*` conserva la referencia histórica de 11 personas. Los resultados son fotos reproducibles, no una consulta permanente de la base.

## Casos que todavía requieren atención

- En la copia inicial, Antonia Biani figuraba como hija de Giovanni Biani y María Biasotti, mientras María estaba vinculada a Giuseppe, descendiente de Giovanni. El algoritmo conservó esas filiaciones y conectó los niveles sin forzar una igualdad incompatible. La segunda lectura de la base ya no presenta advertencias generacionales. La copia inicial se mantiene como regresión de este caso.
- En grafos densos con muchos matrimonios no siempre es posible tener una sola ficha por persona, todos los hermanos contiguos, parejas próximas y cero cruces simultáneamente. Se priorizan filiación, continuidad, ausencia de colisiones y proximidad; los cruces restantes se diagnostican.
- Las relaciones históricas del mismo par se representan como un solo vínculo entre personas; el árbol no distingue episodios de un mismo matrimonio. Las fechas de esos episodios siguen disponibles en Archivo Familiar.
- El algoritmo es determinista, pero una nueva relación puede reorganizar otras ramas para mantener coherencia. No se guardan coordenadas manuales ni excepciones por id.
