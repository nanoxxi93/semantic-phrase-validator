# Interfaz de Usuario Reactiva (Phrase Validator UI)

## Resumen
Aplicación de página única (SPA) interactiva desarrollada con Vue 3 y Tailwind CSS que permite a los usuarios registrar, pre-validar semánticamente y catalogar oraciones cortas. La interfaz previene proactivamente la duplicación conceptual comunicándose con la API backend de embeddings, proporcionando advertencias visuales con trazabilidad y otorgando control al usuario para confirmar o descartar frases semánticamente redundantes.

## Casos de usuario
- **CU-1 (Validación proactiva):** Como creador de contenido, quiero validar semánticamente una oración corta antes de guardarla para verificar si ya existe un concepto equivalente en el catálogo y conocer la frase más cercana con su porcentaje de afinidad.
- **CU-2 (Guardado directo con protección de duplicados):** Como usuario, quiero guardar directamente una frase mediante una sola acción; si resulta ser única se persiste de inmediato, y si el sistema detecta un duplicado semántico (código 409), me presenta la advertencia detallada para decidir conscientemente si confirmo el guardado o lo cancelo.
- **CU-3 (Decisión sobre duplicado advertido):** Al presentarse una advertencia de duplicidad (porcentaje de similitud ≥ 80.0%), quiero tener disponibles exclusivamente las acciones de «Confirmar y guardar de todos modos» o «Cancelar», con el área de texto bloqueada y los botones principales de validación y guardado deshabilitados para evitar alteraciones accidentales del texto analizado.
- **CU-4 (Exploración del catálogo histórico):** Como analista, quiero consultar la lista cronológica de oraciones registradas, filtrarlas según su estado de validación (Todas, Únicas, Duplicados Confirmados) y navegar entre páginas para auditar la relación de similitud y las marcas temporales sin perder el contexto de visualización.

## Criterios de aceptación
- [ ] La interfaz permite ingresar oraciones cortas de entre 1 y 280 caracteres con un contador reactivo en tiempo real.
- [ ] El botón «Validar similitud» ejecuta la pre-validación sin persistir y muestra retroalimentación visual según el resultado:
  - Si la similitud es menor al 80.0%, muestra un panel verde de unicidad con el porcentaje máximo y la frase más cercana.
  - Si la similitud es mayor o igual al 80.0%, muestra una tarjeta de advertencia destacada en color ámbar con el porcentaje exacto y el texto de la frase causante.
- [ ] Al mostrarse la tarjeta de advertencia de duplicado (`DuplicateAlertCard`):
  - El área de texto (`textarea`) se bloquea en modo solo lectura (`readonly`).
  - Los botones «Validar similitud» y «Guardar frase» quedan deshabilitados.
  - Los botones de la tarjeta «Confirmar y guardar de todos modos» y «Cancelar» permanecen activos e interactivos.
- [ ] Si tras una pre-validación aprobada (`UNIQUE_APPROVED`) el usuario modifica cualquier caracter del `textarea`, el panel verde se descarta de inmediato y el formulario regresa al estado `IDLE`.
- [ ] El botón «Guardar frase» permite el envío directo:
  - Si es única, se persiste con estado `UNIQUE` (201 Created), se limpia el formulario y se sincroniza el catálogo.
  - Si colisiona con el umbral (409 Conflict), la interfaz transiciona al estado de advertencia de duplicado preservando el texto intacto.
- [ ] La acción «Cancelar» en la advertencia de duplicado descarta la tarjeta, reactiva el `textarea` para edición libre y habilita los botones principales.
- [ ] La acción «Confirmar y guardar de todos modos» envía la petición con `confirmDuplicate: true`, persistiéndola como `CONFIRMED_DUPLICATE` (201 Created), desbloquea el formulario, limpia el texto y sincroniza el catálogo.
- [ ] Al guardar exitosamente una nueva frase (201 Created), para garantizar visibilidad inmediata de la oración registrada en el tope de la lista: si el filtro activo ocultaría la frase creada (ej. filtro «Únicas» al guardar un `CONFIRMED_DUPLICATE`), se conmuta automáticamente el filtro a «Todas» (`'ALL'`); asimismo, si el usuario se encontraba en una página posterior (`page > 1`), la vista del catálogo se restablece a la página 1.
- [ ] Al cambiar de pestaña de filtro («Todas», «Únicas», «Duplicados Confirmados»), la paginación del catálogo se reinicia automáticamente a la página 1.
- [ ] Al cargar la aplicación, se dispara una petición en segundo plano a `GET /api/health` para mitigar latencias por arranque en frío (cold start) del backend, sin renderizar indicadores visuales de salud en la interfaz.
- [ ] La cabecera muestra el título del producto y el umbral de similitud configurado de referencia (80.0%).
- [ ] El catálogo lista las frases ordenadas cronológicamente de forma descendente, con badges diferenciados (`Única` en verde, `Duplicado Confirmado` en ámbar con puntaje porcentual y referencia a la frase origen).
- [ ] La paginación muestra el total de registros del filtro activo, página actual y total de páginas (10 elementos por página), deshabilitando los botones «Anterior» y «Siguiente» en los límites.
- [ ] Durante operaciones asíncronas de red, se muestran estados de carga (spinners / skeletons) y se bloquean los controles para evitar doble envío.
- [ ] Ante fallos del servicio de inferencia de IA (503), límites de tasa (429 con `RATE_LIMIT_EXCEEDED`) o caídas de red, la interfaz muestra un banner de error explícito y comprensible sin perder el texto ingresado, manteniendo habilitados los botones principales para permitir el reintento directo.

## Requisitos funcionales
- **RF-1 (Entrada de datos y validaciones de cliente):** El área de texto limita la entrada a 280 caracteres. Los botones de acción se deshabilitan si el contenido tras recorte (`trim`) está vacío. Cualquier pulsación de tecla durante un estado de resultado previo (`UNIQUE_APPROVED`) o de error (`ERROR`) descarta el banner correspondiente y revierte inmediatamente el formulario al estado `IDLE`.
- **RF-2 (Máquina de estados de validación):** El formulario opera bajo las siguientes transiciones deterministas:
  - `IDLE`: Formulario habilitado para edición.
  - `VALIDATING`: Petición de validación en curso. Controles deshabilitados con spinner.
  - `SAVING`: Petición de guardado en curso. Controles deshabilitados con spinner.
  - `UNIQUE_APPROVED`: Frase validada con score < 80.0%. Muestra banner de unicidad y frase más cercana.
  - `DUPLICATE_WARNING`: Frase con score ≥ 80.0% o respuesta HTTP 409. Textarea en `readonly`; botones principales inactivos; botones de confirmación y cancelación activos.
  - `ERROR`: Captura de fallos (400, 429 con `RATE_LIMIT_EXCEEDED`, 503 con `AI_SERVICE_UNAVAILABLE`, error de red). Muestra el banner explicativo preservando el texto original; los botones «Validar similitud» y «Guardar frase» permanecen habilitados para permitir al usuario reintentar la operación directamente. Si el usuario edita el `textarea`, el banner de error se oculta y el formulario regresa a `IDLE`.
- **RF-3 (Pre-calentamiento silencioso):** Invocación de `GET /api/health` al montar la aplicación cliente sin impacto visual ni componentes de renderizado de salud.
- **RF-4 (Consumo de endpoints REST y configuración de entorno):** La URL base del backend se consume exclusivamente mediante la variable de entorno `import.meta.env.VITE_API_BASE_URL` (con fallback por defecto a `http://localhost:3000/api` en desarrollo local) para desacoplar el despliegue del frontend (Cloudflare Pages) y el backend (Fly.io).
  - Pre-validación: `POST /api/phrases/validate` con cuerpo `{ text }`.
  - Persistencia: `POST /api/phrases` con cuerpo `{ text, confirmDuplicate }`.
  - Catálogo: `GET /api/phrases?page={page}&limit={limit}&status={status}`.
  - Sonda de salud: `GET /api/health`.
- **RF-5 (Paginación y filtrado):** El catálogo soporta filtros por estado (`UNIQUE`, `CONFIRMED_DUPLICATE` o `'ALL'` para todas sin filtro). El valor `pagination.total` retornado por `GET /api/phrases` representa el conteo del filtro activo. Conmutar entre filtros siempre restablece `page = 1`. Tras persistir exitosamente una frase (201 Created), si el filtro activo ocultaría el nuevo elemento o si `page > 1`, el catálogo restablece la vista a la página 1 (conmutando a `'ALL'` si el filtro no coincide con el estado de la nueva frase) para garantizar que la nueva oración sea inmediatamente visible en la primera posición.
- **RF-6 (Limpieza de formulario):** Tras un guardado exitoso (201 Created), el formulario se vacía, sale del modo de solo lectura y regresa a `IDLE`.

## Requisitos no funcionales
- **RNF-1 (Separación arquitectónica estricta):** Cumplimiento con la Constitución (`specs/constitution.md`, Sección 1.3). Toda lógica reactiva, peticiones HTTP y estados deben encapsularse en composables (`usePhraseValidation`, `usePhraseCatalog`). Componentes UI puramente presentacionales sin llamadas `fetch` directas.
- **RNF-2 (Estilizado uniforme con Tailwind CSS):** Implementación gráfica exclusiva con clases de Tailwind CSS, respetando tipografías (`Inter` y `JetBrains Mono`), espaciados y paleta de la maqueta blueprint, sin CSS en bloque `<style>` ni atributos `style` inline.
- **RNF-3 (Rendimiento e interactividad):** Feedback visual inmediato (< 100 ms) tras interacción de usuario; manejo de loaders durante operaciones de red.
- **RNF-4 (Accesibilidad y semántica web):** Uso riguroso de etiquetas semánticas (`<header>`, `<main>`, `<section>`, `<article>`, `<time>`) y estados ARIA (`aria-live`, `aria-busy`, `aria-disabled`).
- **RNF-5 (Tipado estricto en TypeScript):** Cero uso de `any` en TypeScript con modo estricto habilitado (`strict: true`).
- **RNF-6 (Resiliencia ante fallos externos):** Manejo defensivo de errores HTTP 503 y 429 sin congelar ni corromper el estado de la aplicación.

## Casos extremos
- **CE-1 (Texto con espacios redundantes o solo saltos de línea):** Se aplica `trim()` en cliente. Si resulta vacío, se ignoran acciones de red y se mantienen deshabilitados los botones.
- **CE-2 (Límite superior de longitud - 280 caracteres exactos):** El textarea impide ingresar caracteres adicionales y el contador cambia a color ámbar advirtiendo el límite.
- **CE-3 (Doble clic o pulsaciones concurrentes):** Mientras el estado sea `VALIDATING` o `SAVING`, se deshabilitan los botones para evitar peticiones duplicadas.
- **CE-4 (Indisponibilidad del proveedor de IA - HTTP 503):** Se captura `AI_SERVICE_UNAVAILABLE`; se despliega el banner de error explicativo y se preserva el texto original intacto, permitiendo reintentar.
- **CE-5 (Exceso de peticiones / Rate Limiting - HTTP 429):** Se notifica al usuario que espere unos segundos ante error con código `RATE_LIMIT_EXCEEDED`, manteniendo los botones habilitados para reintentar tras la pausa.
- **CE-6 (Coincidencia exacta al 100%):** Detección por cortocircuito en backend (score 1.0000); despliega de inmediato la advertencia de duplicado bloqueando el textarea.
- **CE-7 (Catálogo vacío en primera ejecución):** Score nulo (`null`) en validación y mensaje de estado vacío informativo y accesible en el catálogo.
- **CE-8 (Error de red / Conectividad):** Fallo de comunicación (`Failed to fetch`) transiciona a `ERROR` ofreciendo información de reconexión y botón de reintento activo.
- **CE-9 (Edición tras pre-validación aprobada o tras error):** Si el usuario modifica el texto mientras se muestra el banner verde de unicidad (`UNIQUE_APPROVED`) o el banner de error (`ERROR`), el banner se destruye al instante y el formulario retorna a `IDLE`.
- **CE-10 (Protección contra alteración durante advertencia de duplicado):** El textarea se bloquea en modo solo lectura (`readonly`) mientras la tarjeta `DuplicateAlertCard` esté activa, garantizando que el usuario solo pueda confirmar el guardado del duplicado o cancelar para volver a editar.
