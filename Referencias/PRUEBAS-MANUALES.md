# Pruebas manuales — Archivo Familiar

## Vínculos independientes

Objetivo: confirmar que elegir un cónyuge no crea ni preselecciona una filiación.

1. Abrir la ficha de X, con al menos otra persona Y registrada.
2. En **Cónyuges / parejas**, elegir Y. Verificar que el selector de **Hijos / hijas** permanece vacío.
3. Guardar el vínculo de cónyuge con Y.
4. Recargar o volver a abrir la ficha de X.
5. Confirmar que Y aparece únicamente en **Cónyuges / parejas** y no en **Hijos / hijas**.
6. Agregar explícitamente Y como hijo/a solo si corresponde; recién entonces debe aparecer en esa lista.

## Documentos PDF

1. Abrir una ficha y, en **Documentos**, elegir un tipo y seleccionar uno o más archivos PDF.
2. Pulsar **Subir** y confirmar que cada archivo aparece con su tipo.
3. Usar **Ver** y **Descargar** en uno de ellos.
4. Eliminar un documento y confirmar que desaparece de la ficha.
5. Intentar eliminar la persona mientras tiene un documento asociado: la aplicación debe bloquear la acción hasta quitar los documentos.

## Árbol explorable

1. Abrir **Árbol** con personas de más de una generación. La vista inicial debe mostrar el mapa completo o su mayor parte, sin centrar una ficha concreta.
2. Arrastrar el mapa, usar la rueda y los botones `+`, `−` y **Ver todo**. Confirmar que se puede volver a encuadrar el árbol completo.
3. Alejar el zoom: las fichas deben pasar a iniciales; al acercar, deben volver a mostrar nombre y años disponibles.
4. Elegir una persona con cónyuge Y y sin una filiación hacia Y. Confirmar que la línea de pareja es horizontal y que Y no aparece como hijo/a salvo que exista una filiación explícita.
5. Abrir el panel de una persona y usar padres/madres, hijos/as, cónyuges/parejas y hermanos/as. Cada acceso debe centrar el mismo mapa en la persona elegida, sin reconstruir ni reordenar la disposición.
6. Registrar una persona desde Archivo Familiar, volver al Árbol y confirmar que las ramas ya existentes conservan el mismo orden relativo. Las personas sin fecha de nacimiento deben ubicarse de forma estable por apellido, nombre e id.
7. Con datos reales de Supabase, elegir una pareja con dos hijos. En la consola de desarrollo, verificar el registro **[Árbol Biani] Diagnóstico family-chart**: ambos adultos deben declararse mutuamente en `spouses`, los dos hijos deben tener ambos ids en `parents` y cada adulto debe incluirlos en `children`. Confirmar visualmente que la pareja queda adyacente y ambos hijos en la fila siguiente, agrupados.
8. Repetir con una persona con dos parejas y medios hermanos. Cada pareja debe mostrarse una sola vez; los hijos de cada unión deben estar debajo de sus progenitores y los medios hermanos compartir únicamente el progenitor real. No deben aparecer tarjetas repetidas ni líneas sueltas.
9. Registrar o revisar una persona sin padres ni fecha de nacimiento. Debe actuar como raíz de su propio componente, conservar un orden estable y no desplazar ni conectar de forma falsa a las otras ramas.
10. Registrar una persona con un solo hijo/a, sin cónyuge ni padres cargados. Ambas personas deben aparecer: la persona adulta como ancla visible de la rama y el hijo/a en la generación inmediatamente inferior.
11. Registrar una pareja sin hijos ni padres cargados. Ambas personas deben aparecer adyacentes, unidas solamente por el vínculo de cónyuge.
12. Registrar una persona sin padres, hijos ni cónyuge. Debe aparecer como una ficha aislada en el mapa. En desarrollo, el diagnóstico debe indicar la misma cantidad para `cantidadPersonas` y `cantidadAlcanzables`, y `faltantes` debe estar vacío.
13. Crear una persona con un hijo/a y sin cónyuge; abrir el Árbol y confirmar que ambos aparecen. Agregar un cónyuge, volver a confirmar la misma rama y borrar ese cónyuge. La persona y su hijo/a deben seguir visibles antes, durante y después; `faltantes` y `faltantesEnLayout` deben permanecer vacíos en desarrollo.
14. Crear un hombre con dos matrimonios y un hijo de cada unión. En cada hijo/a, registrar explícitamente a ambos progenitores reales. Confirmar que cada hijo queda debajo de su pareja correspondiente, que ambas esposas están vinculadas al hombre y que no hay líneas entre esposas. En el diagnóstico, `familias` debe contener una entrada distinta por cada par de progenitores y `hijosAmbiguos` debe estar vacío.
15. **Caso integrado de familias mixtas (datos reales de Supabase).** En el mismo árbol, registrar: (a) una persona A con un hijo/a, sin cónyuge; (b) una persona B con dos cónyuges, un hijo con cada pareja; y (c) un medio hermano de uno de esos hijos que comparta sólo uno de sus progenitores. Confirmar que todas las personas aparecen, A y su hijo/a quedan en generaciones consecutivas, cada hijo de B queda bajo su combinación real de progenitores, los medios hermanos comparten nivel sin fingir un segundo progenitor y no hay líneas cruzadas entre las dos parejas. En la consola de desarrollo, la auditoría completa y la cobertura calculada por `family-chart` deben indicar cero faltantes.
16. **Regresión — cónyuge que se casa hacia adentro.** Cargar una familia de varias generaciones donde X sólo es cónyuge de una persona de la línea: X no tiene padres ni hijos propios cargados, mientras otra persona del mismo componente sí es raíz sin padres y con descendencia. Abrir **Árbol** y verificar en el registro **[Árbol Biani] main_id/root y anclas entregadas a family-chart** que `mainIdFamilyChart` es sólo la raíz técnica invisible y que `anclasEnviadas`/`anclasAuditadas` contienen una raíz de sangre, nunca X. Confirmar visualmente que se ven todas las personas; en **Cobertura calculada por family-chart**, `nodosVisibles` debe coincidir con `esperadas` y no debe haber faltantes ni duplicados. Repetir con el conjunto real del diagnóstico: Yamil Vozzi (`eb13f625-d872-4ddd-a536-4ed230a22e68`) nunca puede ser el ancla si sigue existiendo Giusseppe Biani (`4d73b14d-5b01-409d-9c4f-e531531dab17`) u otra raíz con descendencia.
17. **Cuatro componentes desconectados.** Registrar simultáneamente cuatro grupos sin filiación ni pareja cruzada: tres ramas con una persona raíz y al menos un descendiente, y una pareja sin padres ni hijos. Abrir **Árbol** y confirmar que los cuatro grupos aparecen en el mismo mapa, unidos únicamente por la raíz técnica invisible (sin línea visible). En el diagnóstico deben existir cuatro `anclas`: las tres raíces de sangre se eligen con `criterioAncla: "raiz-con-descendencia"`; sólo la pareja sin filiación puede tener `criterioAncla: "solo-conyugal"`. La cobertura visual debe incluir a todas las personas una sola vez.
18. **Fusión de componentes.** Crear una rama con raíz y descendiente, y una persona aislada en un segundo componente. Verificar primero que la auditoría informa dos anclas. Agregar el matrimonio entre el descendiente y la persona aislada, volver a **Árbol** y confirmar que queda un solo componente y una sola ancla de sangre. Ninguna persona puede desaparecer ni duplicarse; el orden relativo de la rama original debe mantenerse y el reencuadre no debe introducir una animación brusca. La cobertura visual debe seguir sin faltantes ni duplicados.
19. **El ancla actual deja de ser válida.** Crear A como raíz de sangre sin padres, con B como hijo/a, y darle a B descendencia propia. Antes de desvincularlos, intentar eliminar directamente a A: la aplicación debe bloquear el borrado, conservar a A y B y mostrar el `NoticeDialog` indicando que todavía tiene vínculos registrados. Luego eliminar únicamente la filiación entre A y B, sin borrar personas, volver a **Árbol** y confirmar que B pasa a ser la única ancla de su componente con `criterioAncla: "raiz-con-descendencia"`; todas las personas deben mantenerse visibles una sola vez, sin tarjetas duplicadas. Por último, eliminar A —ya sin vínculos— y confirmar que el árbol conserva con normalidad toda la descendencia de B, con B como ancla y sin faltantes ni duplicados en la cobertura visual.
20. **Pareja sin filiación y orden de hermanos.** Crear una pareja progenitora con cuatro hijos/as; asignar a uno de los hermanos un cónyuge sin padres ni hijos cargados. Abrir **Árbol** y confirmar que los cuatro hermanos forman un bloque consecutivo, sin que la pareja se intercale entre ellos; el cónyuge debe quedar inmediatamente al lado de su pareja real, por fuera de ese bloque. Su tarjeta debe usar un tono y borde apenas más gris que las demás, sin icono ni leyenda. Agregar luego un hijo/a a esa pareja y volver a **Árbol**: la misma tarjeta debe recuperar el tono normal, porque ya tiene filiación propia, sin que se alteren la agrupación de hermanos ni la cobertura visual.

## Bitácora

1. Crear una entrada de cada tipo, con y sin persona asociada. Confirmar que aparecen en el listado y que los filtros por tipo y persona funcionan en combinación.
2. Editar el contenido, tipo y persona asociada de una entrada; recargar y confirmar los cambios.
3. Eliminar una entrada y confirmar mediante el diálogo propio de la aplicación.
4. Abrir la ficha de una persona asociada y verificar que la sección **Bitácora** muestra el resumen de sus entradas y un acceso de solo lectura hacia la pantalla de Bitácora.
