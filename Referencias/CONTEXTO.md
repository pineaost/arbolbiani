# CONTEXTO.md — Árbol Biani

Última actualización: 2026-09-04 — por Codex

## Qué es

Aplicación web personal para organizar una investigación genealógica familiar.
Reúne personas, relaciones, documentos y una futura bitácora para reemplazar
el trabajo disperso entre planillas y actas. El Árbol es el mapa de exploración;
Archivo Familiar conserva todas las operaciones de edición.

## Alcance

- Incluye: gestión manual de personas, filiaciones (padres/madres e hijos) y vínculos de cónyuge/pareja.
- Incluye: Árbol genealógico interactivo con layout propio, pan, zoom, encuadre completo y ficha de lectura rápida.
- Incluye: carga de uno o varios PDFs por persona, usando la relación `documento_persona` y el bucket privado `documentos` de Supabase Storage.
- No incluye: múltiples usuarios, permisos complejos ni una relación independiente de hermanos.
- No incluye todavía: fotografías de personas ni un visor documental con zoom/paginación propios.

## Etapas

- [x] Etapa 0: visión funcional y decisiones de diseño.
- [x] Etapa 1: Árbol — del prototipo conceptual al mapa interactivo con datos reales.
- [x] Etapa 2: modelo de datos y esquema de Supabase.
- [x] Etapa 3: Archivo Familiar, relaciones familiares y Documentos.
- [x] Etapa 4: Bitácora MVP (entradas, filtros y asociación opcional a personas).
- [ ] Etapa 5: sistema visual definitivo.
- [ ] Etapa 6: integración, refinamiento y producción.

## Decisiones de arquitectura

- **Next.js + React + Supabase** → stack acordado en la especificación; mantiene UI, acciones de servidor y base desacopladas.
  → descartado: cambiar de stack durante las primeras etapas.

- **Relaciones separadas en filiación y cónyuge** → representan reglas distintas y preservan la integridad referencial.
  → descartado: entidad de hermanos; se deducen de progenitores compartidos y se exponen como `hermanos_ids` en la lectura del Árbol.

- **Estado independiente por formulario de vínculo** → los selectores de progenitor, hijo/a y cónyuge no comparten una selección.
  → descartado: reutilizar un único `selectedPersonId`, que podía preseleccionar una relación distinta por error.

- **Grafo canónico separado del layout** → la aplicación normaliza todas las filas de Supabase como filiaciones dirigidas `progenitor → hijo` y cónyuges bidireccionales. Los componentes se calculan sobre ambos tipos de vínculo y pueden conservar varias raíces ancestrales. El runtime ya no depende de una raíz global ni de nodos técnicos de `family-chart`: `calcularLayoutArbol()` posiciona directamente una única tarjeta real por persona y `crearVinculosVisualesArbol()` deriva las líneas exclusivamente del grafo canónico. Las funciones antiguas de compatibilidad con `family-chart` permanecen sólo como apoyo de regresiones y no intervienen en `/arbol`.

- **Unidades parentales explícitas** → las personas vinculadas como pareja se mantienen cercanas para el layout. Cada conjunto exacto de progenitores conserva una familia distinta con sus propios hijos; así se separan matrimonios sucesivos y medios hermanos sin inventar vínculos conyugales. La línea de una familia incluye los brazos desde cada progenitor —aunque estén en alturas distintas— y el bus común hacia los hijos, por lo que no depende de una segunda línea para verse continua.

- **Cohortes genealógicas estructurales** → los hijos de una misma pareja parental comparten generación por sus filiaciones reales. Los medios hermanos permanecen en unidades separadas y conservan la profundidad exigida por sus demás vínculos; esto evita contradicciones cuando una pareja conecta generaciones diferentes. Las fechas sólo desplazan verticalmente una rama raíz completa y sirven de orden estable; nunca separan hermanos de la misma unidad entre filas.

- **Layout estable por orden determinista** → personas, raíces, hijos y parejas se ordenan por fecha de nacimiento disponible, apellido, nombre e id. Cada unidad reserva el ancho de su subárbol y se centra sobre sus descendientes; los componentes independientes mantienen un margen explícito. Seleccionar una persona centra con pan sin cambiar el layout.
  → resuelta: la vista por defecto calcula su propio encuadre completo y admite escalas pequeñas para mapas anchos; no centra una persona arbitraria.
  → resuelta: la disposición no se reconstruye durante la navegación y mantiene el mismo orden relativo al volver a cargar datos.

- **Identidad visual Sakura, aprobada y aplicada** → la referencia floral acompaña la historia familiar sin convertir la interfaz en un tema literal. Los valores de la paleta y las sombras viven una sola vez en `app/globals.css`; `tailwind.config.ts` expone los roles semánticos `sakura` (`canvas`, `paper`, `petal`, `bloom`, `rose`, `lavender`, `plum`, `ink`, `muted`, `line`, `branch`) para usarlos de forma consistente. El sistema usa fondo `#FBF9FB`, papel cálido `#FFFCFE`, rosa empolvado `#EBCBD5`/`#B66D84`, lavanda grisácea `#E9E4F1`, ciruela `#49355F` y tinta `#2D2830`; se aplicó a navegación, Archivo, Bitácora, formularios, modales, controles y tarjetas del Árbol, sin cambiar su lógica. Las combinaciones de texto verificadas superan AA: plum/paper 10.53:1, plum/petal 9.45:1, ink/canvas 13.75:1 y muted/paper 5.48:1.

- **Flores de fondo del Árbol** → `components/arbol/sakura-backdrop.tsx` dibuja cinco flores mediante la forma SVG simple de cinco círculos aprobada: sin curvas adicionales, degradados ni blur. Miden entre 16 y 28 px, usan opacidades entre 0.16 y 0.31 y están distribuidas de forma irregular sin superponerse. La capa decorativa es fija, tiene `pointer-events: none` y queda detrás del SVG que se panea y hace zoom, por lo que nunca acompaña al contenido del árbol.

- **Orden horizontal de hermanos y parejas** → el layout propio ordena unidades por familia, reserva un subárbol para cada una y minimiza la distancia entre parejas dentro del grupo. No se reordenan tarjetas después de calcular las líneas: posiciones y trazos consumen el mismo resultado determinista.

- **Indicador de presencia sólo conyugal** → al formar los datos de `family-chart`, se deriva `sinLineaSangre` cuando una persona no tiene padres ni hijos en las relaciones normalizadas y sí tiene al menos una pareja. La tarjeta recibe sólo un borde y tono gris sutil; no hay icono, texto ni campo persistido. Al crear una filiación, el indicador desaparece automáticamente en el siguiente cálculo.
  → descartado: guardar esta condición como columna o presentar una alerta de “no consanguíneo”; es una característica contextual del componente actual, no un dato de la persona.

- **Documentos privados y compartibles** → `archivo_url` guarda la ruta en Storage; la ficha obtiene un enlace firmado temporal para ver o descargar. Un documento puede pertenecer a varias personas mediante `documento_persona`.
  → descartado: URLs públicas y duplicar físicamente un archivo por cada persona asociada.

- **Archivo Familiar como único lugar de edición** → el Árbol es solo exploración; el panel enlaza a la ficha de Archivo para modificar datos.
  → descartado: editar datos o relaciones directamente desde el Árbol.

- **Placa “Árbol Biani” en la navegación** → el nombre de la familia se presenta como una pequeña placa de archivo con relieve sutil, usando sólo superficie, borde, velvet y sombra existentes; no lleva subtítulo.
  → descartado: un encabezado genérico o una paleta adicional para la marca.

- **`nivel_informacion` derivado, no persistido** → depende de datos biográficos y documentos asociados; evita sincronización con triggers.
  → descartado: usarlo como barra, porcentaje o mensaje de completitud en la interfaz. Se mantiene interno para una futura función documental definida.

- **Borrado bloqueado cuando hay vínculos o documentos** → evita perder relaciones, registros o archivos asociados por accidente.
  → descartado: borrar en cascada al eliminar una persona.

## Estado actual del código

- Implementado: autenticación, personas (crear, editar y eliminar), relaciones de filiación y cónyuge, con validaciones de integridad.
- Implementado: Archivo Familiar en grilla con búsqueda local; cualquier zona de una tarjeta abre un drawer lateral con la ficha única de la persona para editar datos personales, relaciones, notas, documentos y, al final, eliminarla si no conserva referencias. Se eliminaron lápiz y tacho de cada tarjeta para evitar entradas de edición contradictorias. La ficha muestra además un resumen de Bitácora asociado, de solo lectura.
- Implementado: Bitácora MVP con entradas de nota, hipótesis, duda, hallazgo, tarea pendiente y documento pendiente; texto libre, asociación opcional a persona, filtros por tipo/persona y CRUD completo.
- Implementado: Árbol de datos reales de Supabase con lectura paginada y auditoría previa de personas, filiaciones y cónyuges. Una referencia ausente, auto-referencia, persona repetida o filiación duplicada se informa y detiene la normalización en vez de descartarse silenciosamente.
- Implementado: layout propio sin nodos visibles o invisibles auxiliares en runtime, unidades parentales separadas, cohortes de hermanos, una tarjeta por persona y trazos familiares sólidos. En desarrollo se auditan por separado modelo, layout y cobertura visual relación por relación.
- Implementado: regresiones para ascendencias múltiples, personas aisladas, progenitor único, pareja con hijos, coprogenitores sin matrimonio, matrimonios múltiples, hermanos completos y medios hermanos, ramas de distinta profundidad, paginación, ciclos, recarga determinista y una integración a escala de 36 personas.
- Implementado: interacción del Árbol con pan, zoom por rueda/pellizco y botones, **Ver todo**, detalle de fichas según zoom, selección y recentrado sin reordenar.
- Implementado: panel de lectura con fechas/lugar existentes y accesos clickeables a padres/madres, hijos/as, cónyuges/parejas y hermanos/as; no muestra datos ausentes como alarmas.
- Verificación manual: `Referencias/PRUEBAS-MANUALES.md` incluye relaciones, documentos y mapa del Árbol.
- Pendiente: no existe un campo de foto en el modelo actual; cuando se incorpore, el nodo cercano y el panel pueden mostrarla sin cambiar el layout.

## Casos borde conocidos

- Los grupos familiares desconectados se disponen como componentes independientes con margen entre sí; no existe una raíz técnica ni una línea auxiliar en el runtime. Una persona sin vínculos reales forma un componente de una persona y aparece correctamente como nodo aislado.
- Personas sin fecha de nacimiento se ordenan de forma determinista por apellido, nombre e id para evitar saltos visuales.
- Las líneas de hermanos no se dibujan como una relación propia: la filiación compartida expresa ese vínculo. Los hermanos completos comparten unidad familiar y fila; los medios hermanos permanecen en unidades parentales distintas y el resto de su estructura determina la altura.
- Un cónyuge sin otras personas cargadas solo aparece como pareja; el Árbol nunca inventa ni carga parientes externos.

## Auditoría integral del Árbol — 2026-09-04

- **Datos autenticados de Supabase:** se revisaron 121 personas, 169 filiaciones y 22 filas de cónyuge. No hay extremos ausentes, auto-referencias, filiaciones duplicadas, parejas duplicadas activas ni ciclos de filiación. La orientación `padre_id → hijo_id` y la reciprocidad derivada son consistentes. No se modificó ni eliminó ninguna relación.
- **Casos que parecen aislados:** cinco personas no tienen hoy ninguna filiación ni pareja en la base: José Costa, Clara Agustino, Teresa Ruibal, Antonio Soriano y Yamil Vozzi. Sus tarjetas aisladas son coherentes con los datos disponibles; el sistema no infiere conexiones por nombre o apellido. Si corresponde vincularlas, debe hacerse explícitamente desde Archivo Familiar.
- **Coparentalidad sin matrimonio:** existe una familia válida formada por Giovanni Biani y María Biasotti con su hija Antonia Biani, sin fila conyugal entre esos progenitores. Otros vínculos colocan a Giovanni y María en generaciones distintas, por lo que forzar un grupo horizontal colapsaría una filiación real. Se conserva la profundidad de ambos y el trazo familiar los conecta desde sus respectivas alturas; no se crea ni persiste un matrimonio inexistente.
- **Causa 1 — líneas punteadas:** el trazador clasificaba ocho familias numerosas como `individual` cuando encontraba otras tarjetas entre sus hijos. Una regla CSS convertía automáticamente esa clasificación técnica en `stroke-dasharray`, sin significado de negocio. Se eliminó la clasificación, la degradación y el estilo punteado.
- **Causa 2 — vínculos visualmente cortados:** una familia con dos progenitores comenzaba en el punto medio de sus tarjetas y dependía de un vínculo conyugal SVG separado para llegar hasta ellas. En coparentalidades sin matrimonio el tronco quedaba flotante; con múltiples parejas podía quedar oculto detrás de otra tarjeta. Ahora el mismo path familiar toca a cada progenitor, se enruta por debajo si hay una tarjeta interpuesta y continúa mediante un bus sólido hasta cada hijo. La pareja con hijos no genera una segunda línea duplicada; las parejas sin hijos conservan su línea propia.
- **Causa 3 — personas aparentemente separadas:** la generación combinaba profundidad con un redondeo independiente de años cada 28 años. En los datos reales separaba hermanos de tres familias en filas distintas. Ahora los hijos del mismo conjunto parental forman una cohorte estructural indivisible; la fecha sólo desplaza ramas raíz completas. Los medios hermanos no se mezclan entre unidades y pueden ocupar otra altura si el resto de sus filiaciones lo exige.
- **Causa 4 — encuadre incompleto:** el mapa real medía aproximadamente 21.944 px de ancho y `Ver todo` imponía una escala mínima de 0,08, mayor que la necesaria para el viewport auditado. El mínimo bajó a 0,02 para que el encuadre incluya siempre el layout completo; los nombres se recuperan al acercar el zoom.
- **Cobertura resultante:** el modelo real conserva seis componentes, 25 unidades familiares y una única tarjeta por persona. Cinco componentes son las personas realmente sin vínculos mencionadas arriba; las otras 116 personas forman un único componente conectado. La auditoría visual nueva compara cada filiación y pareja esperada con su representación, detecta faltantes, duplicados, personas vinculadas sin línea y paths que no pudieron construirse.
- **Verificación autenticada del resultado:** las 169 filiaciones bajan a una generación posterior, las 22 parejas comparten fila y ninguna de las 25 unidades separa a sus hijos entre generaciones. El DOM contiene 121 tarjetas y 27 trazos consolidados; `Ver todo` encuadra las 121 y no existe ningún trazo punteado, oculto ni degradado.
- **Limitación pendiente:** a escala de encuadre completo, un árbol tan ancho muestra tarjetas como puntos y oculta sus textos intencionalmente. Es necesario acercar o seleccionar una persona para leerla; esto no elimina tarjetas ni relaciones. Los vínculos de los cinco registros aislados sólo pueden resolverse agregando datos reales.

## Problemas abiertos
- [Resuelto] Confirmaciones nativas: se reemplazaron todos los usos de `window.confirm()` y `window.alert()` por diálogos visuales propios reutilizables (`ConfirmDialog` y `NoticeDialog`). Si la integridad referencial bloquea borrar una persona, el mensaje se muestra en `NoticeDialog`, no en un diálogo del navegador.
- Diseñar un visor documental más rico (zoom y paginación) si el uso de actas escaneadas lo exige, sin recargar la ficha.
- Evaluar un campo opcional de fotografía o retrato para personas; no debe convertirse en requisito ni en señal de información faltante.
- Definir cómo exponer información confirmada, pendiente o documental cuando exista una necesidad investigativa concreta, sin medir “completitud” de personas.

## Notas para Codex

- No crear una entidad o vínculo de hermanos: inferirlos desde filiación.
- Mantener las reglas de negocio en `lib/` y las acciones de servidor; los componentes deben limitarse a presentación e interacción.
- El Árbol no edita: cualquier alta, edición, relación o documento se gestiona desde Archivo Familiar.
- Priorizar una estética de archivo familiar: sobria, legible, con espacio y sin patrones de CRM/dashboard.
- Antes de borrar campos o tablas, buscar sus usos y preservar los datos que puedan servir a las próximas etapas.
