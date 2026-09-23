# Refinamiento visual y proximidad entre hermanos

Comparación sobre `personas-revision-final.json` (119 personas). No se modificaron personas, parentescos ni filtros.

| Medida | Antes | Después |
| --- | ---: | ---: |
| Distancia Esther Iris / Bruno entre centros | 2632 px | 256 px |
| Ancho total | 6978 px | 6959 px |
| Alto total | 1628 px | 1836 px |
| Contactos entre vínculos detectados | 2 | 1 |
| Longitud total de segmentos | 28127 px | 29293 px |
| Fichas superpuestas o atravesadas | 0 | 0 |

En esta fuente Esther Iris es una única persona, hermana de Bruno. No hay una ficha adicional llamada Iris. La solución no utiliza nombres ni apellidos.

## Criterios

- Trazo marrón de 1,9 px como mínimo (antes 1,6), codos de hasta 9 px (antes 4). Matrimonios conservan el color ciruela y mayor grosor.
- Selección: 25% más de grosor, opacidad completa; contexto a 0,18. Transiciones de 200 ms, sin glow. Se conserva la misma unidad seleccionada y las mismas relaciones destacadas.
- Separación base entre centros de generaciones: 200 px (antes 172). Carriles de 16 px (antes 12), con reserva adaptativa según la cantidad de familias superpuestas.
- Se penaliza el espacio ajeno entre bloques de hermanos de ambas ascendencias, descontando el ancho ocupado por sus parejas. Inserciones locales junto a hermanos permiten salir de la tanda del referente sin separar cónyuges. La proyección conserva huecos cuando ayudan a las conexiones.
- La elección final equilibra cruces, longitud, dispersión y ancho, después de verificar la validez geométrica. Fechas e identificadores sirven como orden inicial y desempate, sin imponer cronología rígida.
- Se prueban desplazamientos de ±20 px en hasta 12 bloques por layout. Sólo se aceptan si reducen contactos, mantienen puertos y continuidad, no atraviesan fichas y no alargan excesivamente las líneas. Los subniveles comparten carriles. En esta muestra no fue necesario desplazar verticalmente las fichas.

## Verificación

Vista local del componente real en escritorio (1440 × 960) y ventana angosta. Se comprobó selección, ficha, navegación entre cónyuges, zoom y el estado sin selección. Esther destaca 3 vínculos y atenúa 20; los colores matrimonial y de descendencia siguen distintos incluso seleccionados.

Pruebas del árbol ampliadas para familias de 8, 10 y 11 hermanos, proximidad Esther/Bruno y routing con subniveles. Se mantienen las comprobaciones de filtros, determinismo, cobertura, continuidad y ausencia de colisiones.

Resultado final: `npm test` 58/58; `npx tsc --noEmit` y `npm run lint` sin errores.

## Límite pendiente

Permanece un contacto entre vínculos y algunas conexiones largas entre familias. La optimización es local y acotada: no promete el mínimo global ni fuerza subniveles que no aporten una mejora comprobable.
