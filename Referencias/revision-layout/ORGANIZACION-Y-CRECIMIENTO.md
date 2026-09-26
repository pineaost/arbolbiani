# Organización familiar y crecimiento del árbol

Se corrigió el motor de posiciones y líneas, sin cambiar las personas ni sus relaciones.

## Cambios

- Las hermandades se ordenan como conjuntos consecutivos de bloques conyugales. Una pareja compartida por dos familias se sitúa en su frontera. Las ascendencias de ambos integrantes orientan el bloque; no depende de nombres ni apellidos reconocidos.
- El orden cronológico de los hermanos sin otra ascendencia conyugal deja de depender de si tienen descendientes. La búsqueda conserva alternativas desde ambos extremos y agrupa hermanos con restricciones equivalentes para evitar explorar sus permutaciones.
- Las generaciones se alinean con la rama más profunda y luego se propagan hacia abajo. Las fechas de las raíces, en lugar de la mediana de toda la descendencia, determinan el desplazamiento cronológico de un componente independiente.
- Las tandas enlazadas con otra ascendencia permanecen en una fila. Su plegado ya no desaparece al añadir un hijo. Se mantiene la compactación de otras tandas que pueden plegarse de forma segura.
- Los carriles se ordenan según los contactos que provocarían sus troncos y bajadas, antes de asignarles alturas. La reserva vertical utiliza ese mismo plan.
- Cuando el orden de las familias exige más espacio, se ensaya bajar un núcleo completo —hermanos y parejas— y dar espacio a las generaciones siguientes del mismo componente. Sus líneas se distribuyen debajo de la subfila anterior. Sólo se acepta si reduce los cruces y conserva puertos, continuidad, límites y tarjetas libres.
- La auditoría distingue cruces puntuales de segmentos superpuestos y señala las relaciones involucradas.

## Evidencia

Las copias disponibles tienen 119 y 121 personas. Ninguna contiene los dos nuevos descendientes mencionados en el pedido. Para reproducir ese crecimiento se agregaron personas **sintéticas, sólo en las pruebas**, en tres pares de hermanos: Agustín/Eduardo, Isabel/María Luisa y José/Ricardo. También se probaron nuevas parejas, hermanos y nietos en un caso sin apellidos de las familias principales.

| Medida | Muestra de 119, antes | Muestra de 119, después | Muestra + dos hijos de prueba, después |
| --- | ---: | ---: | ---: |
| Cruces geométricos | 3 | 0 | 0 |
| Ancho | 6711 px | 6695 px | 6789 px |
| Alto | 2652 px | 2528 px | 2768 px |
| Distancia horizontal media padre–hijo | 408 px | 389 px | 408 px |
| Distancia horizontal máxima padre–hijo | 1472 px | 1257 px | 1479 px |

Bruno y Esther quedan adyacentes a la izquierda. Remigio queda inmediatamente junto a Esther y en el extremo izquierdo de los diez hermanos Biani. El espacio libre conyugal es de 20 px. Los tres pares de altas conservan el orden de los hermanos y las generaciones existentes, sin cruces, segmentos superpuestos, tarjetas atravesadas ni relaciones perdidas. La región Biani se desplaza menos de un paso entre hermanos.

Se revisó el renderizado real en `/preview-arbol`, incluyendo zoom y desplazamiento hasta la unión Podrecca–Biani, y el SVG del caso con dos hijos nuevos. Los SVG y JSON `organizacion-antes`, `organizacion-despues`, `crecimiento-antes` y `crecimiento-despues` permiten comparar la geometría. El caso de crecimiento anterior tenía un cruce, pero sacrificaba el agrupamiento y la estabilidad; el nuevo resultado conserva ambas familias y usa más altura.

Validación final: 70/70 pruebas aprobadas, TypeScript y lint sin errores, y compilación de producción completa con `npm run build`.

## Reproducción

```powershell
npm test
node scripts/probar-crecimiento-arbol.mjs
node scripts/auditar-arbol.mjs organizacion-despues
$env:ARBOL_DATOS = 'Referencias/revision-layout/personas-crecimiento-prueba.json'
node scripts/auditar-arbol.mjs crecimiento-despues
Remove-Item Env:ARBOL_DATOS
npm run build
```

El ordenado sigue siendo una heurística determinista y la separación adicional se limita a tres mejoras. Genealogías con restricciones incompatibles pueden conservar cruces residuales; se prioriza mantener todas las personas y filiaciones. Aumentar el árbol puede ampliar su tamaño, pero las altas probadas ya no intercalan ramas ni cambian las generaciones consolidadas.
