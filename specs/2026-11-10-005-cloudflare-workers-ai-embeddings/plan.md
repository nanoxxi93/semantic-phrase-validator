# Plan de Implementación Técnico: 005-cloudflare-workers-ai-embeddings

## Información general sobre la arquitectura

Esta funcionalidad incorpora la compatibilidad con **Cloudflare Workers AI** y su modelo multilingüe **BGE-M3 (`@cf/baai/bge-m3`)** como alternativa de inferencia de embeddings en capa gratuita, estableciendo una arquitectura multi-proveedor desacoplada en el backend y una experiencia unificada en el frontend.

El diseño preserva la arquitectura en capas unidireccional y la inversión de dependencias del proyecto:
1. **Configuración Dinámica (`env.ts`)**: Validación Zod que discrimina entre `EMBEDDING_PROVIDER = 'cloudflare'` y `'huggingface'`, exigiendo las credenciales específicas según el proveedor seleccionado por defecto en arranque.
2. **Abstracción de Inferencia (`EmbeddingProvider`)**: La interfaz incorpora la propiedad `readonly modelIdentifier: string`. Se implementa `CloudflareEmbeddingProvider` utilizando el cliente HTTP nativo (`fetch`) con control de timeouts (`AbortSignal`) y reintentos ante códigos 429/503.
3. **Resolución Dinámica de Modelos en Servicio de Dominio (`PhraseService`)**: `PhraseService` gestiona un registro de proveedores instanciados (`providers: Map<string, EmbeddingProvider>`). En cada solicitud de validación (`POST /api/phrases/validate`) o persistencia (`POST /api/phrases`), resuelve dinámicamente el proveedor asociado al `model` indicado por el cliente, validando previamente que pertenezca a los modelos permitidos (`ALLOWED_MODELS`). Si no se suministra un modelo, opera con el proveedor predeterminado del servidor.
4. **Generalización Matemática (`cosineSimilarity.ts`)**: La función matemática pura se flexibiliza para evaluar vectores de cualquier dimensión $N$ (permitiendo 1024 además de 384), manteniendo su naturaleza determinista sin estado.
5. **Aislamiento de Catálogo en PostgreSQL (`phrases.embedding_model`)**: La tabla `phrases` incorpora la columna `embedding_model` con un índice compuesto `(embedding_model, created_at DESC, id DESC)`. La consulta de validación y el endpoint de catálogo (`GET /api/phrases`) se filtran de forma estricta por el modelo correspondiente, evitando cualquier colisión o contaminación entre espacios latentes incompatibles.
6. **Caché LRU con Clave Compuesta**: La capa de caché en memoria almacena los vectores bajo la clave `${modelIdentifier}:${normalizedText}`, evitando que consultas compartidas entre diferentes modelos utilicen vectores espurios.
7. **Diagnóstico CLI (`testCloudflareAI.ts`)**: Script independiente ejecutable mediante `npm run test:cf` para verificar la conectividad con Cloudflare, medir la latencia y recomendar la calibración del umbral para BGE-M3.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                             Frontend SPA (Vue 3)                                        │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ AppHeader.vue                                                                                     │  │
│  │   • Selector dinámico [ Cloudflare BGE-M3 (1024d) | Hugging Face MiniLM-L12-v2 (384d) ]           │  │
│  │   • Badge "Activo en Servidor" dinámico obtenido desde GET /api/model                             │  │
│  │   • Badge Umbral dinámico: (threshold * 100)%                                                     │  │
│  └───────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ PhraseForm.vue                                                                                    │  │
│  │   • POST /api/phrases/validate { text, model: selectedModel }                                     │  │
│  │   • POST /api/phrases { text, confirmDuplicate, model: selectedModel }                           │  │
│  └───────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ PhraseCatalog.vue & PhraseCard.vue                                                                │  │
│  │   • GET /api/phrases?model={selectedModel}                                                        │  │
│  │   • Badge en cada tarjeta: "BGE-M3 · 1024d" o "MiniLM · 384d"                                     │  │
│  └───────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ ValidationResultCard.vue / DuplicateAlertCard.vue                                                 │  │
│  │   • Inferencia ejecutada con el modelo seleccionado + Umbral aplicado                             │  │
│  └───────────────────────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────▲─────────────────────────────────────────────────────┘
                                                    │ REST API
┌───────────────────────────────────────────────────▼─────────────────────────────────────────────────────┐
│                                           Backend Express API                                           │
│  GET /api/model ──► ModelController (in-memory provider metadata: identifier, dimension, threshold)     │
│  GET /api/phrases?model=:model ──► PhraseController (filtra por modelo seleccionado o activo)           │
│  POST /api/phrases/validate ──► PhraseController (valida model contra ALLOWED_MODELS y delega)          │
│  POST /api/phrases ──► PhraseController (valida model contra ALLOWED_MODELS y persiste)                 │
└───────────────────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                                    │
┌───────────────────────────────────────────────────▼─────────────────────────────────────────────────────┐
│                                   Composition Root                                                      │
│                                (backend/src/app.ts)                                                     │
│                                                                                                         │
│                 providers: Map<string, EmbeddingProvider>                                               │
│                 ├── '@cf/baai/bge-m3' ──► CloudflareEmbeddingProvider (1024d)                           │
│                 └── 'MiniLM-L12-v2'   ──► HuggingFaceEmbeddingProvider (384d)                           │
│                                                   │                                                     │
│                                                   ▼                                                     │
│                                    ┌─────────────────────────────┐                                      │
│                                    │   PhraseService (Dominio)   │                                      │
│                                    │   getProvider(model)        │                                      │
│                                    └──────────────┬──────────────┘                                      │
└───────────────────────────────────────────────────┼─────────────────────────────────────────────────────┘
                                                    │
                              ┌─────────────────────┴─────────────────────┐
                              ▼                                           ▼
                  ┌────────────────────────┐                  ┌────────────────────────┐
                  │   PhraseRepository     │                  │ calculateCosineSimil.  │
                  │   (Drizzle ORM)        │                  │     (Utilidad Pura)    │
                  │ WHERE model = :target  │                  │     (Cualquier N > 0)  │
                  └───────────┬────────────┘                  └────────────────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │ PostgreSQL (JSONB Vec) │
                  │ + embedding_model col  │
                  │ + composite index      │
                  └────────────────────────┘
```

---

## Decisiones arquitectónicas y justificación

- **Decisión 1: Generalización dimensional en `cosineSimilarity.ts` sin acoplamiento a 384 dimensiones**
  - **Por qué:** La similitud coseno es una fórmula geométrica pura sobre el producto punto y las normas de dos vectores euclidianos. No debe estar condicionada a ninguna dimensión fija. El único requisito matemático es que ambos vectores compartan exactamente la misma dimensión ($N > 0$).
  - **Requisitos No Funcionales cubiertos:** RNF-1 (Rendimiento), RNF-3 (Calidad de código), RNF-6 (Gobernanza del Core).

- **Decisión 2: Proveedor desacoplado `CloudflareEmbeddingProvider` con cliente HTTP nativo (`fetch`)**
  - **Por qué:** Node.js v24 incluye `fetch` nativo optimizado con soporte para `AbortSignal.timeout()`. No se requieren librerías de terceros pesadas adicionales para consumir la API de Cloudflare Workers AI.
  - **Requisitos No Funcionales cubiertos:** RNF-2 (Minimización de dependencias), RNF-4 (Uso eficiente de capa gratuita).

- **Decisión 3: Discriminación por modelo en base de datos (`embedding_model`) e índices compuestos**
  - **Por qué:** Vectores densos generados por diferentes modelos de embeddings habitan en espacios latentes semánticos completamente incompatibles. Comparar un vector de 384 dimensiones contra uno de 1024 generaría un error de dimensión, y comparar vectores de igual dimensión generados por arquitecturas distintas produciría resultados caóticos.
  - **Requisitos No Funcionales cubiertos:** RNF-1 (Consultas rápidas), RNF-6 (Integridad relacional).

- **Decisión 4: Calibración empírica y reporte en CLI (`npm run test:cf`)**
  - **Por qué:** BGE-M3 y MiniLM producen distribuciones de similitud coseno distintas ante paráfrasis y oraciones irrelevantes. Un script ejecutable en caliente permite contrastar empíricamente oraciones canónicas en Cloudflare Workers AI.
  - **Requisitos No Funcionales cubiertos:** RNF-4 (Diagnóstico temprano sin consumo innecesario).

- **Decisión 5: Prohibición estricta de Fallback silencioso entre proveedores**
  - **Por qué:** Si Cloudflare devuelve HTTP 429 (límite de cuota) o falla temporalmente, alternar automáticamente a Hugging Face podría facturar cuotas pagadas o contaminar el catálogo con vectores incompatibles. Si el servicio de IA falla, se devuelve HTTP 503 (`AI_SERVICE_UNAVAILABLE`).
  - **Requisitos No Funcionales cubiertos:** RNF-2 (Control de costos y seguridad), Cumplimiento constitucional (Sección 2.3).

- **Decisión 6: Endpoint dedicado `GET /api/model` para desacoplamiento y dinamismo del Frontend**
  - **Por qué:** El frontend no debe asumir ni tener quemado en código cuál es el modelo predeterminado del backend ni cuál es su umbral de corte. Exponer un endpoint ultraliviano `GET /api/model` que retorne la configuración del Composition Root (`provider`, `modelIdentifier`, `dimension`, `threshold`) permite que la SPA se adapte dinámicamente sin redeploy, actualice el encabezado y muestre badges fidedignos sin consultar base de datos ni consumir cuota de IA.
  - **Requisitos No Funcionales cubiertos:** RNF-7 (UX dinámica), RNF-1 (Baja latencia en sondeo inicial).

- **Decisión 7: Selector de 2 modelos en Frontend con sincronización unificada de validación, creación y catálogo**
  - **Por qué:** Al seleccionar un modelo en el encabezado, el frontend conmuta de forma íntegra tanto la exploración del catálogo (`GET /api/phrases?model=...`) como la validación semántica (`POST /api/phrases/validate`) y la persistencia (`POST /api/phrases`), enviando el modelo elegido en el cuerpo de las peticiones. Esto garantiza consistencia total en la experiencia de usuario y elimina la necesidad de banners de advertencia de discrepancia.
  - **Requisitos No Funcionales cubiertos:** RNF-7 (Accesibilidad y claridad de dominio), RNF-8 (Cero regresiones visuales).

- **Decisión 8: Validación estricta en Backend mediante lista blanca (`ALLOWED_MODELS`)**
  - **Por qué:** Tanto `validatePhraseSchema`, `createPhraseSchema` como `listPhrasesQuerySchema` validan que cualquier parámetro `model` pertenezca estrictamente al conjunto de los 2 modelos autorizados (`@cf/baai/bge-m3` y `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`), rechazando peticiones con modelos no contemplados con HTTP 400 Bad Request.
  - **Requisitos No Funcionales cubiertos:** RNF-2 (Seguridad y robustez ante payloads no autorizados).

---

## Secuencia de implementación

La implementación se organiza en 10 fases incrementales siguiendo TDD (Test-Driven Development):

### Fase 1: Generalización Matemática y Contrato del Proveedor
1. Actualizar `backend/src/utils/cosineSimilarity.ts`:
   - Validar `vecA.length === vecB.length` y `vecA.length > 0`.
   - Ajustar `InvalidVectorDimensionError` para recibir las longitudes reales de ambos vectores.
   - Actualizar tests unitarios en `tests/unit/cosineSimilarity.test.ts` con casos de 1024 dimensiones, disparidad dimensional y magnitud cero.
2. Actualizar `backend/src/providers/embeddingProvider.interface.ts`:
   - Declarar `readonly modelIdentifier: string`.
3. Actualizar `backend/src/providers/huggingFaceEmbeddingProvider.ts`:
   - Exponer `readonly modelIdentifier = this.model`.
4. Actualizar `backend/src/providers/mockEmbeddingProvider.ts`:
   - Aceptar opción `dimension` (por defecto 384, configurable a 1024) y `modelIdentifier`.

### Fase 2: Implementación de `CloudflareEmbeddingProvider`
1. Crear `backend/src/providers/cloudflareEmbeddingProvider.ts`:
   - Normalización de entrada y comprobación de `EmptyTextError`.
   - Llamada HTTP `POST` a Cloudflare Workers AI con `AbortSignal.timeout(8000)`.
   - Desempaquetado tolerante de array plano o matriz bidimensional a exactamente 1024 elementos.
   - Manejo de reintentos con backoff ante códigos 429, 500 y 503.
   - Mapeo a `ExternalAIProviderError` sanitizando cabeceras y secretos.
2. Pruebas unitarias en `backend/tests/unit/cloudflareEmbeddingProvider.test.ts`.

### Fase 3: Variables de Entorno y Configuración
1. Actualizar `backend/src/config/env.ts`:
   - Añadir variables `EMBEDDING_PROVIDER`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_MODEL`, `CLOUDFLARE_GATEWAY_ID`.
   - Validación Zod condicional con `.superRefine()`.
2. Actualizar `.env.example` y tests en `backend/tests/unit/env.test.ts`.

### Fase 4: Migración de Base de Datos y Repositorio
1. Actualizar esquema Drizzle en `backend/src/db/schema.ts`:
   - Añadir columna `embedding_model varchar('embedding_model', { length: 150 }).notNull()`.
   - Añadir índice compuesto `idx_phrases_model_created_at_id`.
2. Generar migración SQL `0002_flawless_morph.sql`.
3. Actualizar `PhraseRepositoryInterface` y `PhraseRepository`:
   - Métodos `create`, `findByExactText`, `getAllEmbeddings`, `findAll`, `countAll` con parámetro `embeddingModel`.
4. Pruebas de repositorio en `tests/integration/phraseRepository.integration.test.ts`.

### Fase 5: Caché y Servicio de Dominio Multi-Modelo
1. Actualizar `PhraseService`:
   - Soporte para registro de proveedores (`providers: Map<string, EmbeddingProvider>`) y resolución dinámica `getProvider(model)`.
   - Métodos `validatePhrase(text, model)` y `createPhrase(text, confirmDuplicate, model)` con aislamiento estricto por modelo.
   - Clave de caché en formato `${provider.modelIdentifier}:${normalizedText.toLowerCase()}`.
2. Pruebas unitarias en `backend/tests/unit/phraseService.test.ts`.

### Fase 6: Diagnóstico CLI y Calibración
1. Implementar `backend/src/scripts/testCloudflareAI.ts`:
   - Verificación de conectividad directa con Workers AI, métricas de latencia y recomendación de umbral.
2. Añadir script `"test:cf": "tsx src/scripts/testCloudflareAI.ts"` en `backend/package.json`.

### Fase 7: Endpoints REST API y Validación de Esquemas
1. Esquemas Zod en `backend/src/controllers/phrase.schemas.ts`:
   - Definir `ALLOWED_MODELS` y validar `model` opcional en `validatePhraseSchema`, `createPhraseSchema` y `listPhrasesQuerySchema`.
2. Actualizar `PhraseController`:
   - Extraer `model` en `validate`, `create` y `list` delegando al servicio.
3. Crear `ModelController` y registrar ruta `GET /api/model`.
4. Composition Root en `backend/src/app.ts`:
   - Instanciación de proveedores disponibles en `Map<string, EmbeddingProvider>` y cableado a `PhraseService`.
5. Pruebas de integración en `tests/integration/phrases.api.integration.test.ts`.

### Fase 8: Constantes, Tipos y Servicios en Frontend
1. Crear `frontend/src/constants/models.ts`:
   - Lista inmutable `AVAILABLE_MODELS` con Cloudflare BGE-M3 (1024d) y Hugging Face MiniLM-L12-v2 (384d).
2. Actualizar tipos en `frontend/src/types/`:
   - Añadir `embeddingModel: string` a `PhraseListItem` en `phrase.ts`.
   - Añadir `ActiveModelInfo` a `api.ts`.
3. Actualizar `frontend/src/services/phraseService.ts`:
   - Añadir método `getActiveModel(): Promise<ActiveModelInfo>`.
   - Enviar `model` en `validatePhrase(text, model)` y `createPhrase(text, confirmDuplicate, model)`.
   - Extender `listPhrases(page, limit, status, model)` para admitir filtro opcional de modelo.

### Fase 9: Componentes UI de Frontend y Experiencia Multi-Modelo
1. Actualizar `AppHeader.vue`:
   - Reemplazar texto estático de Hugging Face por selector interactivo `<select>` con los 2 modelos soportados.
   - Mostrar indicador visual ("Activo en Servidor") junto a la opción que coincide con la respuesta de `GET /api/model`.
   - Mostrar el porcentaje de umbral reactivo recibido del backend.
2. Actualizar `App.vue`:
   - Pasar `selectedModel` a `PhraseForm.vue` y `PhraseCatalog.vue`.
3. Actualizar `PhraseForm.vue` y composable `usePhraseValidation.ts`:
   - Conectar `selectedModel` para que las solicitudes de validación y guardado utilicen el modelo elegido por el usuario.
4. Actualizar `PhraseCatalog.vue`:
   - Refrescar automáticamente el listado ante cambios de `selectedModel`.
5. Actualizar `PhraseCard.vue`:
   - Mostrar badge estilizado con `shortLabel` y dimensionalidad del modelo de la frase.
6. Actualizar `DuplicateAlertCard.vue` y `ValidationResultCard.vue`:
   - Mostrar badge del modelo con el que se realizó la inferencia y umbral de evaluación.

### Fase 10: Pruebas Automatizadas de Frontend, Verificación Integral y Auditoría
1. Actualizar y crear suites de pruebas en `frontend/tests/`:
   - Pruebas unitarias para `AppHeader.vue` (carga de modelo dinámico y selector).
   - Pruebas unitarias para `PhraseCatalog.vue` (recarga reactiva con modelo seleccionado).
   - Pruebas unitarias para `PhraseForm.vue` y `usePhraseValidation.ts` (propagación de modelo seleccionado).
   - Pruebas unitarias para `PhraseCard.vue` (renderizado de badges por modelo).
2. Ejecutar suite completa del monorepo (`npm run test:all`, `npm run test:frontend`, `npm run typecheck`, `npm run check:constitution`, `npm run validate:sdd`).

---

## Comprobación de la Constitución

A continuación se audita el diseño propuesto contra las directivas no negociables de `specs/constitution.md`:

| Sección Constitucional | Principio / Regla | Estado en este Plan | Justificación |
| :--- | :--- | :---: | :--- |
| **1.1 Separación Estricta por Capas** | Desacoplamiento de `controllers/`, `services/`, `repositories/`, `providers/`, `utils/`. | **CUMPLE** | `CloudflareEmbeddingProvider` reside en `providers/`, `cosineSimilarity` en `utils/`, y la orquestación en `services/`. Los controladores no conocen detalles de la IA. |
| **1.2 Inversión de Dependencias en IA** | Uso obligatorio de la interfaz `EmbeddingProvider` e inyección de dependencias en `createApp()`. Mocks en tests. | **CUMPLE** | `CloudflareEmbeddingProvider` implementa `EmbeddingProvider`. Se inyecta en `app.ts` y todas las pruebas de Vitest usan `MockEmbeddingProvider`. |
| **1.3 Frontend Desacoplado** | Los composables gestionan el estado y la UI es presentacional con Tailwind. | **CUMPLE** | La UI consume la API REST mediante `phraseService` y composables reactivos. El selector y badges se sincronizan con el modelo seleccionado sin acoplarse a detalles internos de BD o proveedores. |
| **2.1 Validación con Zod** | Validación estricta de esquemas de entrada y entorno. | **CUMPLE** | `env.ts` se extiende con Zod y `.superRefine()` para validar condicionalmente credenciales de Cloudflare o Hugging Face. El parámetro `model` se restringe a `ALLOWED_MODELS` en todos los esquemas de `phrase.schemas.ts`. |
| **2.2 Estructura JSON Estandarizada** | Formato canónico `{ success: true, data }` y `{ success: false, error }`. | **CUMPLE** | `GET /api/model` y todas las respuestas siguen el sobre estandarizado `{ success: true, data }`. |
| **2.3 Códigos HTTP Obligatorios** | Respuestas HTTP canónicas (503 Service Unavailable para fallos de IA externa, 400 para modelos no autorizados). | **CUMPLE** | Todo fallo o límite de cuota (429) de Cloudflare se traduce limpiamente en HTTP 503 sin caídas del proceso ni fallback no autorizado. Modelos inválidos reciben HTTP 400. |
| **3.1 Variables de Entorno Estrictas** | Prohibido quemar secretos o tokens en código fuente. | **CUMPLE** | `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` se cargan exclusivamente desde `.env`. Ningún token se expone en `GET /api/model` ni en logs. |
| **3.2 Minimización de Datos** | Almacenar solo textos, vectores, metadatos y fechas sin PII. | **CUMPLE** | Solo se añade la columna `embedding_model` con el nombre del modelo, sin recopilar datos personales. |
| **4.1 TDD y Cobertura** | Tests automatizados deterministas sin red en Vitest. | **CUMPLE** | Las pruebas unitarias y de integración usan `MockEmbeddingProvider` (1024d) y mocks de `fetch`, con 0 llamadas a servidores de Cloudflare. Se añaden tests de componentes Vue. |
| **4.2 Convención Lingüística** | Código en inglés, especificaciones y documentación en español. | **CUMPLE** | Código fuente en inglés (`ActiveModelInfo`, `AVAILABLE_MODELS`, `ALLOWED_MODELS`), specs y changelogs en español. |
| **4.3 Calidad en Producción** | Cero `console.log` en código productivo y `"strict": true` sin tipos `any`. | **CUMPLE** | Tipado estricto en todas las interfaces de Cloudflare, frontend y scripts; solo se usan logs en el script CLI de diagnóstico. |
| **5. Gobernanza y Auditoría** | Actualizar `constitution.md` y `tech-stack.md` ante variaciones arquitectónicas. | **CUMPLE** | Se contempla la actualización documental y verificación con `check_constitution.py`. |

---

## Suposiciones y preguntas abiertas

### Suposiciones:
1. **Disponibilidad de la API REST de Cloudflare Workers AI**: Se asume que el endpoint `https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/run/@cf/baai/bge-m3` se mantiene disponible y estable en la API v4 de Cloudflare con autenticación Bearer token.
2. **Cuota Gratuita (Free Tier)**: Se asume que el límite diario de 10,000 neuronas de Cloudflare Workers AI es suficiente para el flujo de desarrollo, testing puntual y uso personal moderado, apoyado por la caché LRU en memoria.
3. **Formato Vectorial de BGE-M3**: Se asume que el modelo BGE-M3 devuelve un vector denso de 1024 números de coma flotante. Si Cloudflare actualiza la respuesta para incluir salidas sparse o multivectoriales de BGE-M3, el desempaquetador tolerante extraerá exclusivamente el vector denso principal (`result.data`).
4. **Persistencia en PostgreSQL**: Se asume que la columna `JSONB` almacena arrays de 1024 elementos sin restricciones de tamaño (un vector de 1024 floats ocupa aprox. 8-10 KB en JSONB, muy por debajo del límite de PostgreSQL).

### Preguntas abiertas:
- *Ninguna pendiente*: Todas las dudas sobre compatibilidad de dimensiones, coexistencia de modelos en base de datos, sincronización unificada de validación/catálogo y validación estricta de modelos fueron resueltas y ratificadas.
