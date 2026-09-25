# Iteración: subgrupos y parejas puente

La compactación selecciona un tramo continuo de hermanos sin pareja ni descendencia. Conserva la mayoría en la fila principal y sólo pliega grupos desde ocho integrantes cuando ahorra al menos 20% del ancho. El subgrupo se sitúa en corredores contiguos, lejos del conector familiar. No hay selección por paridad de índice. La diferencia entre subniveles sigue siendo 124 px, menor que los 240 px mínimos entre generaciones.

Las parejas con ascendencia propia en dos familias principales pueden salir de la tanda del referente y ocupar una zona intermedia. Se conserva el bloque conyugal; sus dos ascendencias participan en el orden y la orientación. El centro de los hijos se atrae al centro de sus progenitores, con mayor peso para parejas puente y penalización cuadrática de desplazamientos excesivos. Se conservan seis alternativas de referencia y seis con anclaje familiar; todas se comparan después de compactar. Las familias pequeñas sin puentes sólo requieren las seis alternativas de referencia.

Los radios de los codos crecen hasta 26 px y los de las bifurcaciones hasta 24 px cuando hay espacio libre. Los grosores relativos son 1,25 para el tronco, 1,06 para la rama y 0,92 para la terminación. Se mantienen anclas, puertos y comprobaciones de obstáculos, sin adornos ni ruido.

## Muestra de 119 personas

| Medida | Antes | Después |
| --- | ---: | ---: |
| Ancho del árbol | 7080 px | 6711 px |
| Alto | 2652 px | 2652 px |
| Distancia horizontal media padre-hijo | 532 px | 408 px |
| Distancia horizontal máxima padre-hijo | 1842 px | 1472 px |
| Cruces geométricos | 1 | 3 |

Sin personas ausentes, solapamientos, filiaciones invertidas, tarjetas atravesadas, extremos libres ni puertos inválidos. Acevey conserva sus 14 hermanos en dos grupos de 8 y 6; su región mide 1884 px, un 38% menos que una fila de 14 tarjetas con separación habitual. Las imágenes `subgrupos-puentes.png` y `acevey-subgrupos.png` muestran el resultado completo y el detalle.

Validación final: 64/64 pruebas aprobadas (`npm test`), TypeScript sin errores (`npx tsc --noEmit`) y lint sin advertencias (`npm run lint`). Incluye muestras reales de 119 y 121 personas, grupos de 4/8/10/11 hermanos, pareja puente con hijos centrados, invariancia al permutar entradas y continuidad geométrica.

## Compromisos

- La mayor prioridad de padres-hijos admite algunos cruces y separaciones entre hermanos con ramas propias: Esther y Bruno quedan a unos 734 px. Las pruebas sustituyen los límites antiguos de 600 px y 1800 px por límites estructurales (cuatro pasos entre esos hermanos, ahorro mínimo de 35% para el grupo numeroso), y exigen una media menor a 450 px y máximo menor a 1600 px en esta muestra.
- Se conserva una heurística, no un óptimo global: el centro de todos los grupos no coincide exactamente con sus padres.
- El plegado sigue siendo conservador: grupos intercalados con personas ajenas o con varios conectores permanecen en una fila para no arrastrar otras ramas.
- La detección de puente requiere familias principales reconocidas y ascendencia registrada de ambos integrantes. Las uniones de generaciones distintas conservan el tratamiento previo.
- En árboles complejos se evalúan doce disposiciones en lugar de seis; el cálculo cuesta más, aunque no se agrega trabajo por cada movimiento de zoom.
- La revisión visual se hizo sobre el SVG generado con el motor real y rasterizado localmente, no sobre una sesión autenticada de la aplicación.
