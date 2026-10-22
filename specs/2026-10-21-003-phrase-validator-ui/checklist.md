# Lista de Comprobación y QA: 003-phrase-validator-ui

## Entornos de Prueba Requeridos
- Navegador Web moderno (Google Chrome, Firefox o Edge en sus versiones recientes) con soporte para ES2022+ y Fetch API.
- Entorno de Servidor Backend local en Node.js 24 (`npm --prefix backend run dev`) escuchando en `http://localhost:3000`.
- Entorno de Desarrollo Frontend con Vite (`npm --prefix frontend run dev`) en `http://localhost:5173`.
- Entorno CLI de pruebas automatizadas con Vitest y `@vue/test-utils` (`npm --prefix frontend run test`).

---

## Casos de Prueba (Criterios de Aceptación)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| **CA-01** | Navegador | 1. Escribir texto en el `textarea`. 2. Observar el contador inferior. | El contador se actualiza en tiempo real mostrando `{longitud} / 280 caracteres`. No permite sobrepasar los 280 caracteres. | [ ] | |
| **CA-02** | Navegador | 1. Escribir una frase conceptualmente distinta a las del catálogo. 2. Hacer clic en «Validar similitud». | Transiciona a `VALIDATING` con spinner; al recibir respuesta con similitud < 80.0%, muestra `<ValidationResultCard />` verde indicando unicidad, el score exacto y la frase más cercana. | [ ] | |
| **CA-03** | Navegador | 1. Escribir una paráfrasis o frase semánticamente cercana (≥ 80.0%) a una existente. 2. Pulsar «Validar similitud». | Muestra `<DuplicateAlertCard />` destacada en ámbar con el score de similitud porcentual, la frase causante y botones de decisión obligatoria. | [ ] | |
| **CA-04** | Navegador | 1. Provocar el estado de advertencia de duplicado. 2. Intentar escribir en el `textarea` y hacer clic en «Validar» o «Guardar». | El `textarea` está bloqueado en solo lectura (`readonly`). Los botones «Validar similitud» y «Guardar frase» están deshabilitados. Solo «Confirmar y guardar» y «Cancelar» están interactivos. | [ ] | |
| **CA-05** | Navegador | 1. Pre-validar una frase obteniendo `UNIQUE_APPROVED`. 2. Modificar un caracter en el `textarea`. | El banner verde de unicidad desaparece al instante y el formulario retorna al estado `IDLE`. | [ ] | |
| **CA-06** | Navegador | 1. Escribir una frase única. 2. Pulsar directamente en «Guardar frase» sin haber pre-validado antes. | El backend responde 201 Created; el formulario se limpia, vuelve a `IDLE` y la nueva frase aparece en la primera posición del catálogo. | [ ] | |
| **CA-07** | Navegador | 1. Escribir una frase duplicada. 2. Pulsar directamente en «Guardar frase» sin haber pre-validado antes. | El backend responde 409 Conflict (`DUPLICATE_PHRASE`); la UI captura el error y activa de inmediato `<DuplicateAlertCard />` preservando el texto intacto. | [ ] | |
| **CA-08** | Navegador | 1. Estando en advertencia de duplicado, pulsar el botón «Cancelar». | La tarjeta de duplicado se oculta, el `textarea` se desbloquea para edición y los botones «Validar similitud» y «Guardar frase» vuelven a habilitarse. | [ ] | |
| **CA-09** | Navegador | 1. Estando en advertencia de duplicado, pulsar «Confirmar y guardar de todos modos». | Envía `POST /api/phrases` con `confirmDuplicate: true`; se persiste como `CONFIRMED_DUPLICATE` (201), el formulario se vacía y el catálogo se refresca mostrando el badge ámbar. | [ ] | |
| **CA-10** | Navegador | 1. Seleccionar la pestaña de filtro «Únicas» (o estar en página > 1). 2. Guardar un duplicado confirmado. | El catálogo restablece la vista automáticamente a la **página 1** y conmuta el filtro a **«Todas»** (`'ALL'`), mostrando la nueva frase inmediatamente en el tope. | [ ] | |
| **CA-11** | Navegador | 1. Navegar a la página 2 del catálogo. 2. Conmutar a la pestaña «Únicas». | La paginación del catálogo se reinicia automáticamente a la página 1. | [ ] | |
| **CA-12** | Red / DevTools | 1. Cargar o recargar la aplicación en el navegador. 2. Inspeccionar la pestaña Network. | Se emite una petición silenciosa `GET /api/health` que responde 200 OK. La cabecera NO muestra indicadores visuales de salud de la API. | [ ] | |
| **CA-13** | Navegador | 1. Inspeccionar la cabecera `<AppHeader />`. | Se visualiza el título de la aplicación y la píldora fija informativa «Umbral: 80.0%». | [ ] | |
| **CA-14** | Navegador | 1. Observar las tarjetas de frases en el catálogo. | Se muestran ordenadas de la más reciente a la más antigua; las frases únicas exhiben badge verde «Frase Única» y `Score: —`; los duplicados confirmados exhiben badge ámbar, score porcentual y bloque «Similar a: «...»». | [ ] | |
| **CA-15** | Navegador | 1. Navegar por los controles de paginación `<PaginationBar />`. | Muestra «Página X de Y · Total: Z frases». El botón «Anterior» está deshabilitado en página 1 y «Siguiente» en la última página. | [ ] | |
| **CA-16** | Navegador | 1. Pulsar «Validar similitud» o «Guardar frase». 2. Intentar hacer clic repetido rápidamente. | Durante la petición asíncrona, se muestra el spinner animado y los botones ignoran nuevos clics evitando peticiones duplicadas. | [ ] | |
| **CA-17** | Navegador | 1. Simular un fallo 503 (`AI_SERVICE_UNAVAILABLE`) o 429 (`RATE_LIMIT_EXCEEDED`). | Se muestra `<ErrorAlertBanner />` con el código y mensaje comprensible; el texto escrito no se borra y los botones principales permanecen habilitados para reintentar. | [ ] | |

---

## Pruebas de Casos Extremos (Edge Cases)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| **CE-01** | Navegador | 1. Ingresar solo espacios en blanco o saltos de línea en el `textarea`. | Los botones «Validar similitud» y «Guardar frase» permanecen deshabilitados; no se emiten peticiones HTTP. | [ ] | |
| **CE-02** | Navegador | 1. Tipear o pegar un texto de 280 caracteres. 2. Intentar escribir un caracter número 281. | El campo bloquea caracteres adicionales. El contador se resalta en color ámbar (`text-amber-600 font-semibold`). | [ ] | |
| **CE-03** | CLI / Vitest | 1. Disparar dos llamadas concurrentes a `validatePhrase()` en el composable. | Solo se procesa una petición activa y la segunda es descartada o ignorada mientras `uiState === 'VALIDATING'`. | [ ] | |
| **CE-04** | Navegador | 1. Simular respuesta HTTP 503 con código `AI_SERVICE_UNAVAILABLE` desde el backend. | La interfaz despliega `<ErrorAlertBanner />` indicando indisponibilidad temporal del proveedor de IA y mantiene el texto en el textarea intacto. | [ ] | |
| **CE-05** | Navegador | 1. Enviar ráfaga de peticiones superando 30 req/min para provocar HTTP 429 con `RATE_LIMIT_EXCEEDED`. | La interfaz muestra el banner de error por exceso de peticiones, indicando esperar brevemente antes de reintentar. | [ ] | |
| **CE-06** | Navegador | 1. Ingresar una frase idéntica exacta a una ya existente en catálogo. | El backend responde inmediatamente con score 1.0000 (100.00%); la UI activa la alerta de duplicado mostrando 100.00% y la frase idéntica. | [ ] | |
| **CE-07** | Navegador | 1. Iniciar con catálogo en base de datos completamente vacío. 2. Validar una frase. | La pre-validación retorna similitud nula; la UI informa que es única al ser la primera en el sistema. El catálogo muestra el componente de estado vacío. | [ ] | |
| **CE-08** | Navegador | 1. Detener el backend o desconectar la red. 2. Intentar validar o listar frases. | Se captura la excepción `NETWORK_ERROR`; la interfaz muestra el banner de error de conectividad sin congelarse ni caerse. | [ ] | |
| **CE-09** | Navegador | 1. Provocar un error visible en `<ErrorAlertBanner />`. 2. Modificar el texto del `textarea`. | El banner de error se destruye inmediatamente y el formulario regresa al estado `IDLE`. | [ ] | |
| **CE-10** | Navegador | 1. Estando en `<DuplicateAlertCard />`, intentar hacer foco y editar el textarea con teclado o ratón. | El atributo `readonly` impide cualquier modificación al texto hasta que se presione explícitamente «Cancelar». | [ ] | |
