# CONTEXTO.md — Árbol Biani

Última actualización: 2026-08-14 — por Codex

## Qué es

Aplicación web personal para organizar una investigación genealógica familiar.
Reúne personas, relaciones, documentos y una futura bitácora para reemplazar
el trabajo disperso entre planillas y actas. El Árbol es el mapa de exploración;
Archivo Familiar conserva todas las operaciones de edición.

## Alcance

- Incluye: gestión manual de personas, filiaciones (padres/madres e hijos) y vínculos de cónyuge/pareja.
- Incluye: Árbol genealógico interactivo construido con `family-chart`, pan, zoom, encuadre completo y ficha de lectura rápida.
- Incluye: carga de uno o varios PDFs por persona, usando la relación `documento_persona` y el bucket privado `documentos` de Supabase Storage.
- No incluye: importación desde Excel, múltiples usuarios, permisos complejos ni una relación independiente de hermanos.
- No incluye todavía: Bitácora funcional, fotografías de personas ni un visor documental con zoom/paginación propios.

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

- **Árbol global con raíz técnica por componente** → `family-chart` necesita una persona principal. La raíz invisible conecta sólo una ancla por componente familiar, nunca a todas las personas sin padres. Conectar a ambos cónyuges como hijos de esa raíz hacía que la biblioteca recorriera los hijos comunes por dos caminos y duplicara fichas y vínculos.
  → resuelta: la capa `lib/arbol-chart.ts` normaliza antes de agrupar `parents`, `children` y `spouses` en ambos sentidos, conserva hermanos como dato derivado del panel y selecciona una ancla determinista por componente. La preferencia es: raíz sin padres con descendencia; luego cualquier persona con filiación; y sólo si el componente no tiene ninguna filiación, una persona conectada exclusivamente por pareja. Entre raíces posibles se prioriza la que alcanza más descendencia por `children`, porque ése es el recorrido direccional que realiza `family-chart`. El enlace técnico raíz→ancla no es una filiación real ni se expone en la UI.

- **Layout estable por orden determinista** → personas, hijos y cónyuges se ordenan por fecha de nacimiento disponible, apellido, nombre e id. Seleccionar una persona centra con pan sin cambiar la persona principal del layout.
  → resuelta: la vista por defecto usa `treeFit` para encuadrar todo el mapa; no centra el ego.
  → resuelta: la disposición no se reconstruye durante la navegación y mantiene el mismo orden relativo al volver a cargar datos.

- **Identidad visual Sakura, aprobada y aplicada** → la referencia floral acompaña la historia familiar sin convertir la interfaz en un tema literal. Los valores de la paleta y las sombras viven una sola vez en `app/globals.css`; `tailwind.config.ts` expone los roles semánticos `sakura` (`canvas`, `paper`, `petal`, `bloom`, `rose`, `lavender`, `plum`, `ink`, `muted`, `line`, `branch`) para usarlos de forma consistente. El sistema usa fondo `#FBF9FB`, papel cálido `#FFFCFE`, rosa empolvado `#EBCBD5`/`#B66D84`, lavanda grisácea `#E9E4F1`, ciruela `#49355F` y tinta `#2D2830`; se aplicó a navegación, Archivo, Bitácora, formularios, modales, controles y tarjetas del Árbol, sin cambiar su lógica. Las combinaciones de texto verificadas superan AA: plum/paper 10.53:1, plum/petal 9.45:1, ink/canvas 13.75:1 y muted/paper 5.48:1.

- **Flores de fondo del Árbol** → `components/arbol/sakura-backdrop.tsx` dibuja cinco flores mediante la forma SVG simple de cinco círculos aprobada: sin curvas adicionales, degradados ni blur. Miden entre 16 y 28 px, usan opacidades entre 0.16 y 0.31 y están distribuidas de forma irregular sin superponerse. La capa decorativa es fija, tiene `pointer-events: none` y queda detrás del SVG que se panea y hace zoom, por lo que nunca acompaña al contenido del árbol.

- **Orden horizontal de hermanos y parejas** → `family-chart` expone `setSortChildrenFunction` y conserva su propio cálculo de posiciones y parejas. El comparador entrega los hermanos con pareja femenina primero, los sin pareja en el centro y los hermanos con pareja masculina al final: la librería dibuja la pareja femenina a la izquierda y la masculina a la derecha, por lo que el bloque de hermanos queda consecutivo y cada pareja queda contigua por fuera.
  → descartado: asignar coordenadas o reordenar tarjetas después del layout; entraría en conflicto con el agrupamiento familiar y las ramas de matrimonios múltiples de la librería.

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
- Implementado: Árbol de datos reales de Supabase con `family-chart`; muestra filiación vertical, parejas horizontales y hermanos derivados en el panel de lectura. En desarrollo registra el `main_id` técnico, las anclas que éste entrega a `family-chart`, su coincidencia con la auditoría y el conteo de tarjetas realmente visibles en el DOM, además de reportar reciprocidades faltantes.
- Implementado: regresión de integración a escala con 36 personas sintéticas, cuatro líneas de sangre, matrimonios múltiples, medios hermanos y parejas sin filiación. Comprueba auditoría completa, anclas de sangre y una tarjeta única por persona antes de ampliar la carga real.
- Implementado: interacción del Árbol con pan, zoom por rueda/pellizco y botones, **Ver todo**, detalle de fichas según zoom, selección y recentrado sin reordenar.
- Implementado: panel de lectura con fechas/lugar existentes y accesos clickeables a padres/madres, hijos/as, cónyuges/parejas y hermanos/as; no muestra datos ausentes como alarmas.
- Verificación manual: `Referencias/PRUEBAS-MANUALES.md` incluye relaciones, documentos y mapa del Árbol.
- Pendiente: Bitácora. No existe un campo de foto en el modelo actual; cuando se incorpore, el nodo cercano y el panel pueden mostrarla sin cambiar el layout.

## Casos borde conocidos

- Grupos familiares desconectados se disponen bajo una raíz técnica invisible con una única ancla por grupo; sus líneas falsas se ocultan y no se presentan como parentescos. Una persona sólo vinculada por pareja no puede ser ancla mientras haya en su componente alguien con filiación; una persona sin vínculos forma un componente de una persona y aparece como nodo aislado.
- Personas sin fecha de nacimiento se ordenan de forma determinista por apellido, nombre e id para evitar saltos visuales.
- Las líneas de hermanos no se dibujan como una relación propia: la filiación compartida expresa ese vínculo. No se diferencia visualmente hermano completo de medio hermano por ahora.
- Un cónyuge sin otras personas cargadas solo aparece como pareja; el Árbol nunca inventa ni carga parientes externos.

## Problemas abiertos

- [Resuelto y validado en la transformación] Layout del Árbol: la causa era una raíz técnica que entregaba a `family-chart` dos cónyuges como ramas paralelas, mientras ambos declaraban los mismos hijos. La entrada ahora mantiene reciprocidad y una única ancla por componente, por lo que hijos, hermanos y parejas se calculan desde las relaciones reales sin nodos duplicados.
- [Resuelto y validado — 2026-08-13] Cobertura y layout del Árbol: el caso que destapó la causa usaba 11 personas reales, todas alcanzables en el JSON, pero la única ancla era Yamil Vozzi (`eb13f625-d872-4ddd-a536-4ed230a22e68`), una persona sin padres ni hijos vinculada sólo por matrimonio. `family-chart` parte de `children` desde el ancla y sólo podía dibujar a Yamil y a su cónyuge. La selección ahora exige primero una raíz de sangre con descendencia, después cualquier filiación y deja la ancla exclusivamente conyugal para componentes sin sangre. Con ese conjunto, Giusseppe Biani (`4d73b14d-5b01-409d-9c4f-e531531dab17`) queda como ancla, `family-chart` calcula 11 nodos únicos y la comprobación de DOM cuenta 11 tarjetas visibles. Se agregaron pruebas automáticas para el caso real, cuatro componentes simultáneos y su fusión por matrimonio, además de los tres casos manuales de regresión.
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
