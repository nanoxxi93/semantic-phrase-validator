# Lista de Comprobación y QA: 005-cloudflare-workers-ai-embeddings

## Entornos de Prueba Requeridos
- [x] Entorno CLI / Node.js (Node.js v24+, TypeScript estricto en `backend/`).
- [x] Suite de pruebas automatizadas con Vitest (`npm test` en `backend/`).
- [x] Contenedor PostgreSQL 17 (`postgres:17-alpine`) en Docker Compose (`docker compose up -d`).
- [x] CLI interactivo con conexión a Cloudflare Workers AI (`npm run test:cf`).
- [x] Entorno Frontend SPA (Vue 3, Vite, Tailwind CSS, Vitest en `frontend/`).

---

## Casos de Prueba (Criterios de Aceptación)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| **CA-01** | CLI / Vitest | 1. Iniciar la factoría de aplicación `createApp` configurando `EMBEDDING_PROVIDER = 'cloudflare'`.<br>2. Comprobar la instancia de proveedor inyectada en `PhraseService`. | Se instancia y asocia `CloudflareEmbeddingProvider`. Si `EMBEDDING_PROVIDER = 'huggingface'`, se asocia `HuggingFaceEmbeddingProvider`. | [x] | Verificado en `app.ts` y tests de integración. |
| **CA-02** | CLI / Node.js | 1. Configurar `EMBEDDING_PROVIDER = 'cloudflare'` sin definir `CLOUDFLARE_ACCOUNT_ID` ni `CLOUDFLARE_API_TOKEN`.<br>2. Ejecutar validación de `env.ts`. | La validación Zod falla de inmediato en el arranque informando los campos requeridos faltantes. | [x] | Verificado en `env.test.ts`. |
| **CA-03** | CLI / Vitest | 1. Invocar `generateEmbedding` en `CloudflareEmbeddingProvider` con una frase válida de hasta 280 caracteres.<br>2. Inspeccionar la promesa resultante. | Resuelve a un array plano `number[]` de exactamente 1024 números de coma flotante sin valores `NaN` ni nulos. | [x] | Verificado en `cloudflareEmbeddingProvider.test.ts` y `npm run test:cf`. |
| **CA-04** | CLI / Vitest | 1. Simular respuesta de Workers AI con matriz bidimensional `[[0.12, ...]]`.<br>2. Simular respuesta con array unidimensional `[0.12, ...]`. | En ambos casos, el proveedor desempaqueta correctamente entregando un array unidimensional de 1024 floats. | [x] | Verificado en `cloudflareEmbeddingProvider.test.ts`. |
| **CA-05** | CLI / Vitest | 1. Invocar `calculateCosineSimilarity` pasando dos vectores de 1024 dimensiones idénticos, ortogonales y opuestos.<br>2. Invocar con dos vectores de 384 dimensiones. | Retorna `1.0000` para idénticos, `0.0000` para ortogonales/opuestos, acotado en `[0.0000, 1.0000]` y redondeado a 4 decimales en ambas dimensiones. | [x] | Verificado en `cosineSimilarity.test.ts`. |
| **CA-06** | CLI / PostgreSQL | 1. Ejecutar migración de Drizzle en PostgreSQL.<br>2. Inspeccionar la estructura de la tabla `phrases`. | La tabla contiene la columna `embedding_model VARCHAR(150) NOT NULL` y el índice compuesto `idx_phrases_model_created_at_id`. Frases previas tienen default de MiniLM. | [x] | Verificado en migración Drizzle `0002_flawless_morph.sql` y `scripts/schema.sql`. |
| **CA-07** | CLI / Vitest / Supertest | 1. Guardar frases con modelo Hugging Face (384d).<br>2. Cambiar a Cloudflare (1024d) y validar una nueva frase.<br>3. Consultar `GET /api/phrases`. | La validación de duplicados y la respuesta de `GET /api/phrases` operan exclusivamente sobre frases con `embedding_model = '@cf/baai/bge-m3'`. | [x] | Verificado en `phrases.api.integration.test.ts` y `phraseRepository.integration.test.ts`. |
| **CA-08** | CLI / Vitest | 1. Simular error de cuota HTTP 429 o fallo en Cloudflare Workers AI.<br>2. Ejecutar petición de validación o guardado. | El sistema **NO** realiza fallback a Hugging Face; retorna limpiamente código de estado HTTP 503 (`SERVICE_UNAVAILABLE`). | [x] | Verificado en `cloudflareEmbeddingProvider.test.ts`. |
| **CA-09** | CLI / Vitest | 1. Simular fallo temporal HTTP 503 o 429 en la primera llamada de Cloudflare y éxito en el segundo intento. | El cliente reintenta automáticamente con backoff y resuelve con éxito sin arrojar error al llamador. | [x] | Verificado en `cloudflareEmbeddingProvider.test.ts`. |
| **CA-10** | CLI / Terminal | 1. Configurar credenciales de Cloudflare en `.env`.<br>2. Ejecutar `npm run test:cf`. | Conecta con Cloudflare Workers AI, imprime forma del tensor (1024d), latencia en ms, scores de similitud y recomendación de umbral. | [x] | Verificado con Cloudflare Workers AI en vivo (latencia 1607 ms, score 0.9956 / 0.9241 / 0.3251). |
| **CA-11** | CLI / Vitest | 1. Ejecutar `npm run test` con `MockEmbeddingProvider` configurado a 1024 dimensiones. | Todos los tests pasan de manera 100% determinista sin llamadas de red salientes ni credenciales reales. | [x] | Verificado con 52 tests unitarios pasando en Vitest. |
| **CA-12** | CLI / Supertest | 1. Enviar `GET /api/model`. | Retorna HTTP 200 con `{ success: true, data: { provider, modelIdentifier, dimension, threshold } }` en memoria. | [x] | Verificado en `phrases.api.integration.test.ts` y `phraseService.spec.ts`. |
| **CA-13** | CLI / Supertest | 1. Enviar `GET /api/phrases?model=@cf/baai/bge-m3`.<br>2. Enviar `GET /api/phrases?model=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`. | Filtra estrictamente las frases del modelo solicitado en lugar del activo por defecto. | [x] | Verificado en `phrases.api.integration.test.ts`. |
| **CA-14** | Frontend / Vitest | 1. Montar `AppHeader.vue` con respuesta de `GET /api/model`. | Muestra `<select>` con los 2 modelos, etiqueta "(Activo en Servidor)" en la opción correcta y porcentaje de umbral reactivo. | [x] | Verificado en `AppHeader.spec.ts` y `App.spec.ts`. |
| **CA-15** | Frontend / Vitest | 1. Seleccionar un modelo en el `<select>`.<br>2. Validar una frase y consultar el catálogo. | El formulario de validación/guardado y el catálogo se sincronizan con el modelo seleccionado sin mostrar banners de discrepancia. | [x] | Verificado en `PhraseCatalog.spec.ts` y `PhraseForm.spec.ts`. |
| **CA-16** | Frontend / Vitest | 1. Renderizar `PhraseCard.vue` con frase que contiene `embeddingModel`. | Muestra badge estilizado con modelo y dimensiones (ej. `BGE-M3 · 1024d` o `MiniLM · 384d`). | [x] | Verificado en `PhraseCard.spec.ts`. |
| **CA-17** | Frontend / Vitest | 1. Ejecutar validación de frase en `ValidationResultCard.vue` o recibir duplicado en `DuplicateAlertCard.vue`. | Muestra badge con el modelo de inferencia y porcentaje de umbral utilizado. | [x] | Verificado en `PhraseForm.spec.ts`. |
| **CA-18** | Backend / Supertest | 1. Enviar petición a `/api/phrases/validate`, `/api/phrases` o `GET /api/phrases` con modelo no autorizado. | El backend rechaza la petición con HTTP 400 Bad Request y código BAD_REQUEST. | [x] | Verificado en `phrases.api.integration.test.ts`. |

---

## Pruebas de Casos Extremos (Edge Cases)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| **CE-1** | CLI / Vitest / DB | 1. Persistir una frase con `embedding_model = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'`.<br>2. Validar una frase candidata con `embedding_model = '@cf/baai/bge-m3'`. | El sistema no colisiona ni lanza `InvalidVectorDimensionError`; aísla el catálogo y trata la frase como `UNIQUE`. | [x] | Verificado en `phrases.api.integration.test.ts` y `phraseRepository.integration.test.ts`. |
| **CE-2** | CLI / Vitest | 1. Agotar la cuota de Cloudflare (simular HTTP 429 tras reintentos). | Responde HTTP 503 sin intentar llamar a la API de Hugging Face de forma encubierta ni consumir tokens pagados. | [x] | Verificado en `cloudflareEmbeddingProvider.test.ts`. |
| **CE-3** | CLI / Vitest | 1. Simular respuesta HTTP 429 persistente con cabecera `Retry-After`. | Ejecuta 2 reintentos con backoff progresivo y luego eleva `ExternalAIProviderError` mapeado a HTTP 503. | [x] | Verificado en `cloudflareEmbeddingProvider.test.ts`. |
| **CE-4** | CLI / Vitest | 1. Invocar Cloudflare con `CLOUDFLARE_API_TOKEN` erróneo (HTTP 401) o `CLOUDFLARE_ACCOUNT_ID` inexistente (HTTP 404). | Aborta inmediatamente en el primer intento sin reintentos inútiles, arrojando `ExternalAIProviderError`. | [x] | Verificado en `cloudflareEmbeddingProvider.test.ts`. |
| **CE-5** | CLI / Vitest | 1. Enviar una frase compuesta por espacios `"   "` o secuencias de saltos de línea `"\n\t"`. | Rechaza la petición síncronamente con `EmptyTextError` antes de generar peticiones HTTP a Cloudflare. | [x] | Verificado en `cloudflareEmbeddingProvider.test.ts`. |
| **CE-6** | CLI / Vitest | 1. Simular latencia de red superior a 8000 ms en la llamada a Cloudflare. | La petición es abortada por `AbortSignal.timeout(8000)` y procesada por la política de reintentos antes de devolver 503. | [x] | Verificado en `cloudflareEmbeddingProvider.test.ts`. |
| **CE-7** | CLI / Vitest | 1. Invocar `calculateCosineSimilarity` pasando un vector de 1024 ceros (`norma = 0`). | Retorna `0.0000` de forma segura sin producir anomalías matemáticas como `NaN` o `Infinity`. | [x] | Verificado en `cosineSimilarity.test.ts`. |
| **CE-8** | CLI / Vitest | 1. Simular respuesta de Workers AI con un vector truncado (ej. 512 números en lugar de 1024). | Lanza `InvalidEmbeddingResponseError` rechazando el vector antes de que alcance la base de datos o el catálogo. | [x] | Verificado en `cloudflareEmbeddingProvider.test.ts`. |
| **CE-9** | Frontend / Vitest | 1. Simular caída de red o HTTP 500 en `GET /api/model`. | La SPA no se rompe; recurre defensivamente a defaults estándar (`@cf/baai/bge-m3`, 80.0%) y carga la interfaz. | [x] | Verificado en `App.vue` try/catch y `App.spec.ts`. |
| **CE-10** | Frontend / Vitest | 1. Seleccionar un modelo sin frases en el catálogo. | Muestra estado vacío informativo indicando que no hay frases para ese modelo. | [x] | Verificado en `PhraseCatalog.spec.ts`. |
| **CE-11** | Frontend / Vitest | 1. Renderizar `PhraseCard` con `embeddingModel` desconocido o no contemplado. | Renderiza badge seguro con el identificador truncado sin lanzar excepciones. | [x] | Verificado en `PhraseCard.spec.ts`. |
