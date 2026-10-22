# Plan de Implementación Técnico: 003-phrase-validator-ui

## Información general sobre la arquitectura
Esta funcionalidad construye la interfaz de usuario completa (SPA) para el sistema **Semantic Phrase Validator**, correspondiente a la Fase 3 del roadmap. Provee una experiencia visual reactiva y fluida que permite a los usuarios registrar frases cortas, pre-validar su afinidad conceptual mediante inferencia de embeddings de IA, recibir advertencias con trazabilidad y gestionar el catálogo histórico paginado.

La arquitectura del frontend respeta una separación de responsabilidades unidireccional y desacoplada, cumpliendo con la Sección 1.3 de la Constitución (`specs/constitution.md`):
1. **Capa de Servicios y Transporte (`src/services/`):** Encapsula el cliente HTTP `fetch`, normaliza errores canónicos y expone métodos fuertemente tipados contra la API REST del backend (`phraseService.ts`).
2. **Capa de Lógica y Estado Reactivo (`src/composables/`):** Gestiona el ciclo de vida de validación semántica mediante una máquina de estados determinista (`usePhraseValidation.ts`) y la sincronización/paginación del catálogo (`usePhraseCatalog.ts`).
3. **Capa Presentacional de Componentes (`src/components/`):** Componentes Vue 3 (`<script setup lang="ts">`) que consumen los composables o interactúan mediante props y eventos, absteniéndose de ejecutar llamadas directas a APIs de red.
4. **Capa de Estilos Utilitarios:** Tailwind CSS configurado para replicar con máxima fidelidad la maqueta blueprint (`d:\downloads\_\maqueta_ui_semantic_phrase_validator.html`), utilizando las fuentes *Inter* y *JetBrains Mono*, sin estilos en bloques `<style>` ni atributos `style` en línea.

### Diagrama de Arquitectura y Flujo de Interacción

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                       FRONTEND SPA                                     │
│                         (Vue 3 + Vite + Tailwind CSS + TypeScript)                     │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                              CAPA DE PRESENTACIÓN                              │   │
│   │                                                                                │   │
│   │   App.vue                                                                      │   │
│   │   ├── <AppHeader /> ────────► Título, descripción y umbral fijo (80.0%)        │   │
│   │   │                                                                            │   │
│   │   ├── <PhraseForm /> ───────► Input textarea [1-280 chars], contador dinámico  │   │
│   │   │   ├── <ValidationResultCard />  ──► Estado UNIQUE_APPROVED (<80%)          │   │
│   │   │   ├── <DuplicateAlertCard />    ──► Estado DUPLICATE_WARNING (≥80% / 409)  │   │
│   │   │   └── <ErrorAlertBanner />      ──► Estado ERROR (503, 429, red)           │   │
│   │   │                                                                            │   │
│   │   └── <PhraseCatalog /> ────► Catálogo histórico reactivo                      │   │
│   │       ├── <PhraseFilterBar />  ──► Tabs: Todas, Únicas, Duplicados             │   │
│   │       ├── <PhraseList />       ──► Lista de <PhraseCard /> o estado vacío      │   │
│   │       └── <PaginationBar />    ──► Controles de página y contadores            │   │
│   └───────────────────────────────────────┬────────────────────────────────────────┘   │
│                                           │ Eventos / Props                            │
│                                           ▼                                            │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                        CAPA DE COMPOSABLES / ESTADO                            │   │
│   │                                                                                │   │
│   │   usePhraseValidation()                                                        │   │
│   │   ├── text, charCount, isValidText, uiState (IDLE, VALIDATING, SAVING, etc.)    │   │
│   │   ├── validate(), saveDirectly(), confirmDuplicateSave(), cancelDuplicate()   │   │
│   │   └── reset()                                                                  │   │
│   │                                                                                │   │
│   │   usePhraseCatalog()                                                           │   │
│   │   ├── phrases, pagination, activeFilter ('ALL'|'UNIQUE'|'CONFIRMED_DUPLICATE')  │   │
│   │   ├── setFilter(filter), changePage(page), fetchCatalog()                      │   │
│   │   └── onPhraseCreated(newPhrase) ──► Reajusta página/filtro para visibilidad   │   │
│   └───────────────────────────────────────┬────────────────────────────────────────┘   │
│                                           │ Llamadas tipadas                           │
│                                           ▼                                            │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                        CAPA DE SERVICIOS Y RED (HTTP)                          │   │
│   │                                                                                │   │
│   │   phraseService                                                                │   │
│   │   ├── validatePhrase(text) ──► POST /api/phrases/validate                      │   │
│   │   ├── createPhrase(text, confirmDuplicate) ──► POST /api/phrases               │   │
│   │   ├── listPhrases(page, limit, status) ──► GET /api/phrases                    │   │
│   │   └── checkHealth() ──► GET /api/health (sonda silenciosa de cold start)       │   │
│   │                                                                                │   │
│   │   apiClient (`api.ts`)                                                         │   │
│   │   └── Parseo Zod/Tipos, inyección VITE_API_BASE_URL, manejo ApiClientError     │   │
│   └───────────────────────────────────────┬────────────────────────────────────────┘   │
└───────────────────────────────────────────┼────────────────────────────────────────────┘
                                            │ HTTP / JSON (CORS)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                       BACKEND                                          │
│                      (Express + Node.js 24 + Drizzle ORM en Fly.io)                    │
│                                                                                        │
│   Endpoints:                                                                           │
│   ├── GET  /api/health            ──► Health probe inmediata                           │
│   ├── POST /api/phrases/validate  ──► Pre-validación semántica informativa             │
│   ├── POST /api/phrases           ──► Persistencia (UNIQUE o CONFIRMED_DUPLICATE)      │
│   └── GET  /api/phrases           ──► Catálogo paginado con filtro de status           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Pila tecnológica y decisiones clave

- **Decisión 1: Configuración Monorepo con Workspaces de npm (`/frontend` y `/backend`)**
  - **Por qué:** Mantiene un único repositorio versionado con scripts compartidos en la raíz (`npm run build`, `npm run test`, `npm run dev`), facilitando el desarrollo local sin fragmentar herramientas de control ni pipelines de CI/CD.
  - **Alternativas consideradas:**
    - *Repositorios Git separados (polyrepo):* Descartada porque dificulta la sincronización de contratos de datos TypeScript entre backend y frontend en fases tempranas.
  - **Requisitos cubiertos:** RNF-1, RNF-5.

- **Decisión 2: Vue 3 Composition API con `<script setup lang="ts">` y Máquina de Estados Finita en Composable**
  - **Por qué:** Permite modelar el ciclo de vida de validación de forma predecible a través de estados mutuamente excluyentes (`IDLE`, `VALIDATING`, `SAVING`, `UNIQUE_APPROVED`, `DUPLICATE_INFORMATIVE`, `DUPLICATE_WARNING`, `ERROR`). La lógica no reside en componentes de interfaz, lo que permite testear unitariamente todas las transiciones y casos extremos en Vitest sin necesidad de montar el DOM. Al diferenciar la pre-validación duplicada informativa (`DUPLICATE_INFORMATIVE`) del bloqueo de guardado con conflicto (`DUPLICATE_WARNING`), se preserva una UX intuitiva y ergonómica.
  - **Alternativas consideradas:**
    - *Librería pesada de gestión de estado global (Pinia / Vuex):* Descartada por sobrecarga innecesaria para el alcance de una SPA centrada en un único flujo de negocio; los Vue Composables con `ref` y `computed` ofrecen reactividad nativa pura y aislada.
  - **Requisitos cubiertos:** CU-1, CU-2, CU-3, RF-1, RF-2, RNF-1.

- **Decisión 3: Estilizado Utilitario con Tailwind CSS v3 y Tipografías Específicas**
  - **Por qué:** Replica exactamente la maqueta funcional blueprint proporcionada (`maqueta_ui_semantic_phrase_validator.html`). Al utilizar clases utilitarias (`bg-indigo-600`, `border-amber-300`, `bg-emerald-50`, `font-mono`), se evita CSS redundante o dependencias de librerías UI externas (ej. Vuetify o PrimeVue) que alterarían la estética o introducirían sobrecostes en el bundle.
  - **Requisitos cubiertos:** RNF-2, RNF-3, RNF-4.

- **Decisión 4: Manejo Defensivo y Centralizado de Errores de Red con `ApiClientError`**
  - **Por qué:** El backend emite errores en formato JSON canónico `{ success: false, error: { code, message, details } }`. El cliente HTTP `src/services/api.ts` intercepta cualquier respuesta con `status >= 400`, desempaqueta este payload y genera una instancia tipada de `ApiClientError`. Esto permite a los composables distinguir limpiamente entre un error de duplicado (HTTP 409 con código `DUPLICATE_PHRASE`), un fallo del proveedor de IA (HTTP 503 con código `AI_SERVICE_UNAVAILABLE`), un límite de tasa (HTTP 429 con código `RATE_LIMIT_EXCEEDED`) o un error de red (`NETWORK_ERROR`), mapeándolos directamente al estado visual correspondiente.
  - **Alternativas consideradas:**
    - *Interpretar códigos HTTP con `try/catch` dispersos en componentes:* Descartada por violar el principio DRY y generar código frágil propenso a inconsistencias.
  - **Requisitos cubiertos:** RF-2, RF-4, RNF-6, CE-4, CE-5, CE-8.

- **Decisión 5: Reseteo Inteligente de Vistas al Persistir Frases**
  - **Por qué:** Al guardar una frase, si el usuario tiene activo un filtro que excluiría la frase (ej. filtro `UNIQUE` pero guardó un `CONFIRMED_DUPLICATE`), o si se encuentra en `page > 1`, el catálogo restablece automáticamente `activeFilter = 'ALL'` y `currentPage = 1`. Esto asegura retroalimentación inmediata, permitiendo al usuario visualizar la frase recién agregada en la primera posición sin tener que conmutar manualmente de pestaña.
  - **Requisitos cubiertos:** CU-2, Criterios de Aceptación, RF-5, RF-6.

- **Decisión 6: Sonda Silenciosa de Despertar de la API (`GET /api/health`)**
  - **Por qué:** Las instancias serverless o contenedores con escalado a cero (como en Fly.io) presentan latencia por cold start en la primera petición. Ejecutar una llamada no bloqueante a `GET /api/health` durante el `onMounted()` de `App.vue` calienta la infraestructura de forma invisible para el usuario sin saturar la interfaz con badges o widgets de monitoreo.
  - **Requisitos cubiertos:** RF-3, Criterios de Aceptación.

- **Decisión 7: Prevención de Flash de Carga (FLS) mediante Retardo de Skeleton (Debounced Loading a 150 ms)**
  - **Por qué:** En llamadas locales o con respuestas cacheadas en memoria (< 150 ms), montar y desmontar inmediatamente el panel prominente de análisis semántico (`state-panel-VALIDATING`) produce un parpadeo visual molesto (Flash of Loading State). Se establece un retardo de 150 ms para la aparición del panel azul, mientras que el botón proporciona retroalimentación táctil inmediata deshabilitándose y mostrando su spinner.
  - **Requisitos cubiertos:** RNF-3, Criterios de Aceptación, RF-2.

---

## Secuencia de implementación

La construcción de la Fase 3 se organizará en 7 etapas incrementales y verificables:

### Etapa 1: Inicialización del Proyecto Frontend y Tooling
1. Crear el paquete `frontend/` mediante `npm create vite@latest frontend -- --template vue-ts`.
2. Actualizar `package.json` de raíz para declarar `workspaces: ["backend", "frontend"]` y añadir scripts unificados (`"dev:frontend"`, `"test:frontend"`).
3. Instalar y configurar Tailwind CSS v3 (`tailwindcss`, `postcss`, `autoprefixer`) con las fuentes *Inter* y *JetBrains Mono* configuradas en `tailwind.config.js`.
4. Configurar Vitest y `@vue/test-utils` con entorno `happy-dom` en `frontend/vite.config.ts`.

### Etapa 2: Capa de Tipos, Configuración de Entorno y Cliente HTTP
1. Definir los contratos de datos en `src/types/`:
   - `phrase.ts`: `ValidationStatus`, `SimilarPhraseSummary`, `PhraseListItem`.
   - `api.ts`: `ApiResponse<T>`, `ApiErrorResponse`, `PhraseValidationResult`, `PaginatedPhrases`.
   - `ui.ts`: `UiState` (`'IDLE' | 'VALIDATING' | 'SAVING' | 'UNIQUE_APPROVED' | 'DUPLICATE_INFORMATIVE' | 'DUPLICATE_WARNING' | 'ERROR'`), `ErrorState`.
2. Crear `src/config/env.ts` para resolver `import.meta.env.VITE_API_BASE_URL` con fallback a `http://localhost:3000/api`.
3. Implementar `src/services/api.ts` con manejo canónico de respuestas JSON y la clase de error `ApiClientError`.
4. Implementar `src/services/phraseService.ts` exponiendo `validatePhrase`, `createPhrase`, `listPhrases` y `checkHealth`.
5. Pruebas unitarias para `phraseService` y `api.ts` utilizando mocks de `fetch`.

### Etapa 3: Composables Reactivos (Máquinas de Estados y Catálogo)
1. Implementar `src/composables/usePhraseValidation.ts`:
   - Estado de entrada: `phraseText`, `charCount`, `isValidText`, `uiState`, `validationResult`, `errorState`.
   - Acciones: `validatePhrase()` (transiciona a `UNIQUE_APPROVED` si `< 80%` o a `DUPLICATE_INFORMATIVE` si `≥ 80%`), `savePhrase()` (si 409 Conflict transiciona a `DUPLICATE_WARNING`), `confirmDuplicateSave()`, `cancelDuplicate()`, `reset()`, y manejo de eventos `@input` para restaurar a `IDLE` desde `UNIQUE_APPROVED`, `DUPLICATE_INFORMATIVE` o `ERROR`.
   - Bloqueo en solo lectura del textarea exclusivamente durante `DUPLICATE_WARNING`.
2. Implementar `src/composables/usePhraseCatalog.ts`:
   - Estado: `phrases`, `pagination`, `activeFilter`, `isLoading`.
   - Acciones: `fetchCatalog()`, `setFilter(filter)`, `changePage(page)`, `onPhraseCreated(phrase)`.
3. Pruebas unitarias completas en Vitest para ambos composables cubriendo todas las transiciones, conmutaciones de filtro y casos de error (503, 429, 409).

### Etapa 4: Componentes del Formulario y Feedback de Validación
1. Crear `src/components/AppHeader.vue`: Cabecera con branding y píldora con umbral fijo (80.0%).
2. Crear/Adaptar `src/components/ValidationResultCard.vue`: Tarjeta informativa para `UNIQUE_APPROVED` (verde, unicidad) y `DUPLICATE_INFORMATIVE` (ámbar, duplicado detectado sin botones de persistencia).
3. Crear `src/components/DuplicateAlertCard.vue`: Tarjeta ámbar para estado `DUPLICATE_WARNING` (HTTP 409 tras guardado directo) con botones de acción ("Confirmar y guardar" y "Cancelar").
4. Crear `src/components/ErrorAlertBanner.vue`: Banner para estado `ERROR` con detalle de código (`AI_SERVICE_UNAVAILABLE`, `RATE_LIMIT_EXCEEDED`, etc.).
5. Crear `src/components/PhraseForm.vue`: Formulario principal integrando textarea, contador reactivo de 280 caracteres, barra de botones ("Validar similitud" y "Guardar frase") y ranura dinámica para los banners de estado.
6. Pruebas de componentes con `@vue/test-utils` validando deshabilitación de botones y emisión de eventos.

### Etapa 5: Componentes del Catálogo Histórico y Paginación
1. Crear `src/components/PhraseFilterBar.vue`: Pestañas de filtrado ("Todas", "Únicas", "Duplicados Confirmados") con conteos y colores de estado.
2. Crear `src/components/PhraseCard.vue`: Tarjeta individual de frase con badge de estado, porcentaje de similitud formateado, referencia a la frase causal y fecha legible.
3. Crear `src/components/PaginationBar.vue`: Controles de paginación con cálculo de página actual, total de páginas y botones "Anterior" / "Siguiente".
4. Crear `src/components/PhraseList.vue`: Listado que renderiza la colección de tarjetas o un estado vacío amigable si no hay elementos.
5. Crear `src/components/PhraseCatalog.vue`: Contenedor principal que ensambla filtro, lista y paginación.

### Etapa 6: Ensamble Principal y Estilizado Fiel a la Maqueta
1. Ensamblar en `src/App.vue`:
   - Integración de `<AppHeader />`, `<PhraseForm />` y `<PhraseCatalog />`.
   - Invocación silenciosa de `phraseService.checkHealth()` en `onMounted()`.
   - Conexión del evento `phrase-saved` desde el formulario hacia `onPhraseCreated` del catálogo.
2. Afinar estilos globales y clases de Tailwind CSS en `src/assets/main.css` asegurando paridad visual 1:1 con la maqueta blueprint.

### Etapa 7: Verificación, Tests de Integración y Auditoría Constitucional
1. Ejecutar la suite completa de pruebas unitarias y de componentes en el frontend (`npm run test:frontend`).
2. Verificar compilación estricta de TypeScript (`vue-tsc --noEmit`).
3. Ejecutar las auditorías de gobernanza: `python scripts/check_constitution.py` y `python scripts/validate_sdd.py`.
4. Comprobar que no existan advertencias de linting ni usos de `console.log` o tipos `any`.

---

## Comprobación de la Constitución

A continuación se audita el diseño técnico propuesto contra cada regla de `specs/constitution.md`:

| Regla Constitucional | Estado | Justificación Técnica en el Plan |
|---|---|---|
| **1.3 Frontend Desacoplado y Arquitectura de Composables** | **CUMPLE** | Toda la lógica asíncrona, de red y de estado reactivo reside exclusivamente en `usePhraseValidation.ts` y `usePhraseCatalog.ts`. Los componentes de UI son puramente presentacionales sin llamadas `fetch` incrustadas. |
| **1.3 Estilizado Exclusivo con Tailwind CSS** | **CUMPLE** | La interfaz utiliza clases de utilidad de Tailwind CSS sin bloques `<style>` locales ni estilos en línea. |
| **2.2 Estructura JSON Estandarizada** | **CUMPLE** | El cliente `api.ts` parsea y valida las respuestas canónicas `{ success: true, data }` y `{ success: false, error }` devueltas por el backend. |
| **2.3 Manejo Canónico de Códigos HTTP** | **CUMPLE** | El plan maneja explícitamente los códigos `200` (validación), `201` (creación), `400` (validación Zod), `409` (`DUPLICATE_PHRASE`), `429` (`RATE_LIMIT_EXCEEDED`) y `503` (`AI_SERVICE_UNAVAILABLE`). |
| **3.1 Configuración Externa Segura** | **CUMPLE** | Cero credenciales o URLs fijas en el código; la URL base se lee de `import.meta.env.VITE_API_BASE_URL`. |
| **4.1 Test-Driven Development y Cobertura** | **CUMPLE** | Toda la lógica de composables, servicios y componentes se valida mediante Vitest y `@vue/test-utils` con mocks de red controlados. |
| **4.2 Convención Lingüística y Nomenclatura** | **CUMPLE** | Código, interfaces y variables 100% en inglés técnico; documentación, especificación y plan 100% en español. Commits con Conventional Commits. |
| **4.3 Calidad de Código en Producción** | **CUMPLE** | Compilación con TypeScript `"strict": true`, cero uso de `any`, y ausencia de sentencias `console.log`. |

---

## Suposiciones y preguntas abiertas

### Suposiciones asumidas en el diseño
1. **Configuración de CORS en el backend:** Se asume que el backend desarrollado en la Fase 2 admite peticiones de orígenes locales de desarrollo (`http://localhost:5173` por defecto en Vite) y del dominio de Cloudflare Pages a través de la variable `CORS_ORIGINS`.
2. **Compatibilidad del navegador:** Se asume que los navegadores objetivo soportan la API nativa de JavaScript moderno (`fetch`, `AbortController`, `Intl.DateTimeFormat`).
3. **Ausencia de enrutador (SPA limpia):** Se asume que la aplicación no requiere Vue Router ni múltiples vistas; toda la experiencia vive de manera cohesiva en una única pantalla responsiva, cumpliendo estrictamente con `specs/tech-stack.md`.
4. **Formateo de fechas:** Las fechas provienen en formato ISO 8601 (`createdAt`) y se formatean en el cliente utilizando las APIs estándar de `Intl.DateTimeFormat` o una función utilitaria determinista para mostrar tiempo relativo ("Hace X minutos") y fecha absoluta.

### Preguntas abiertas
- *Ninguna:* Todos los aspectos de interacción, estados, manejo de errores y códigos HTTP fueron clarificados y alineados con el backend en las etapas de `specify` y `clarify`.
