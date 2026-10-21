# Lista de Tareas: 002-phrase-validation-api

## Fase 1: Configuración de Entorno, Dependencias y Modelo de Datos CamelCase
- [x] 1.1 Instalar dependencias de producción (`helmet`, `cors`, `express-rate-limit`) y desarrollo (`supertest`, `@types/cors`, `@types/supertest`) en `backend/package.json`, y registrar los scripts `"dev": "tsx watch src/index.ts"` y `"start": "node dist/index.js"`.
  *(No hay dependencias. Desbloquea la infraestructura del servidor y pruebas).*
- [x] 1.2 Actualizar `backend/src/config/env.ts` con validación Zod para las nuevas variables de entorno:
  - `PORT` (number, default: 3000)
  - `SIMILARITY_THRESHOLD` (number en rango (0.0, 1.0], default: 0.80)
  - `TRUST_PROXY` (number, default: 1)
  - `EMBEDDING_CACHE_TTL_SECONDS` (number positivo, default: 3600)
  - `RATE_LIMIT_WINDOW_MS` (number positivo, default: 60000)
  - `RATE_LIMIT_INFERENCE_MAX` (number positivo, default: 30)
  - `RATE_LIMIT_READ_MAX` (number positivo, default: 100)
  - `CORS_ORIGINS` (string con orígenes válidos, default: "http://localhost:5173,http://localhost:3000")
  *(Depende de 1.1).*
- [x] 1.3 Actualizar `backend/src/db/schema.ts` para mapear las propiedades de TypeScript a `camelCase` nativo:
  - `similarityScore` mapeada a la columna SQL `similarity_score`
  - `similarToId` mapeada a la columna SQL `similar_to_id`
  - `validationStatus` mapeada a la columna SQL `validation_status`
  - `createdAt` mapeada a la columna SQL `created_at`
  - Añadir definición de índice compuesto `idx_phrases_created_at_id` sobre `(phrases.createdAt.desc(), phrases.id.desc())` para ordenamiento determinista y optimizado (RNF-11).
  *(Depende de 1.2).*
- [x] 1.4 Generar y aplicar la migración SQL con Drizzle (`npm run db:generate`, `npm run db:migrate`) y actualizar las referencias en `backend/tests/integration/database.integration.test.ts` para reflejar las propiedades TypeScript en `camelCase`.
  *(Depende de 1.3).*

## Fase 2: Capa de Caché LRU de Embeddings
- [x] 2.1 Definir el contrato abstracto `EmbeddingCache` en `backend/src/cache/embeddingCache.interface.ts` con métodos `get(key: string)`, `set(key: string, embedding: number[], ttlSeconds?: number)`, `delete(key: string)` y `clear()`.
  *(No hay dependencias. Desbloquea la memoria intermedia).*
- [x] 2.2 Refactorizar `InMemoryEmbeddingCache` en `backend/src/cache/inMemoryEmbeddingCache.ts` integrando la librería oficial de npm `lru-cache` con capacidad máxima de 1,000 entradas y expiración por marca de tiempo TTL (RF-6, CA-11).
  *(Depende de 2.1 e instalación de `lru-cache`).*
- [x] 2.3 Implementar suite de pruebas unitarias en `backend/tests/unit/inMemoryEmbeddingCache.test.ts` verificando:
  - Almacenamiento y recuperación exitosa (cache hit).
  - Retorno de `null` ante claves inexistentes (cache miss).
  - Expiración transparente tras cumplirse el TTL.
  - Desalojo del elemento menos recientemente consultado al alcanzar 1,000 entradas.
  *(Depende de 2.2).*

## Fase 3: Capa de Acceso a Datos `PhraseRepository`
- [x] 3.1 Definir la interfaz abstracta `PhraseRepositoryInterface` en `backend/src/repositories/phraseRepository.interface.ts`.
  *(Depende de la Fase 1).*
- [x] 3.2 Implementar `PhraseRepository` en `backend/src/repositories/phraseRepository.ts` utilizando Drizzle ORM:
  - `create(data)`: inserta registro y retorna la entidad en `camelCase`, convirtiendo `similarityScore` numéricamente (`row.similarityScore !== null ? Number(row.similarityScore) : null`).
  - `findAll({ page, limit, status })`: ejecuta consulta paginada utilizando `aliasedTable(phrases, 'similar_phrase')` para el `LEFT JOIN` auto-referencial sobre `similar_to_id`, ordenando por `created_at DESC, id DESC`, excluyendo el vector `embedding` y formateando `similarityScore` a `number | null` (CA-06, CA-07).
  - `countAll(status)`: conteo total para cálculo de `totalPages`.
  - `getAllEmbeddings()`: consulta de `id`, `text` y `embedding` para comparación en memoria.
  - `findByExactText(normalizedText)`: consulta case-insensitive mediante `LOWER(text) = LOWER(?)`, retornando `{ id, text, embedding }` (CA-10).
  *(Depende de 3.1).*
- [x] 3.3 Implementar pruebas de integración del repositorio con base de datos real PostgreSQL en `backend/tests/integration/phraseRepository.integration.test.ts`.
  *(Depende de 3.2).*

## Fase 4: Capa de Dominio `PhraseService` y Errores
- [x] 4.1 Crear la clase de error de dominio `DuplicatePhraseError` en `backend/src/errors/DuplicatePhraseError.ts` conteniendo `similarityScore`, `threshold` y `similarPhrase`.
  *(No hay dependencias).*
- [x] 4.2 Implementar `PhraseService` en `backend/src/services/phraseService.ts` recibiendo por inyección de dependencias `EmbeddingProvider`, `PhraseRepository`, `EmbeddingCache` y `threshold`:
  - `validatePhrase(text)`:
    1. Normaliza texto (`trim()` y colapso de `\s+`).
    2. Cortocircuito exacto vía `PhraseRepository.findByExactText`: si coincide, retorna score 1.0000 e `isDuplicate: true` con 0 llamadas a IA (CA-10, CE-2).
    3. Consulta de vector en `EmbeddingCache`; si miss, genera con `EmbeddingProvider` y guarda en caché con TTL de 1 hora (CA-11).
    4. Cómputo de similitud coseno contra catálogo: si catálogo vacío retorna `similarityScore: null` e `isDuplicate: false` (CE-1); si no está vacío, identifica la frase más afín y evalúa `isDuplicate = maxScore >= threshold` (CA-01, CA-02).
  - `createPhrase(text, confirmDuplicate)`:
    1. Ejecuta validación semántica interna; si detecta duplicado y `!confirmDuplicate`, lanza `DuplicatePhraseError` (CA-04).
    2. Si es duplicado confirmado (`confirmDuplicate === true`), reutiliza el vector de la frase idéntica o de la caché/proveedor y persiste como `CONFIRMED_DUPLICATE` (CA-05).
    3. Si es único, persiste como `UNIQUE` con metadatos nulos (CA-03).
  - `listPhrases(page, limit, status)`: calcula offsets y metadatos de paginación (`page, limit, total, totalPages`).
  *(Depende de 4.1, Fase 2 y Fase 3).*
- [x] 4.3 Implementar pruebas unitarias de `PhraseService` en `backend/tests/unit/phraseService.test.ts` con `MockEmbeddingProvider` determinista y `InMemoryEmbeddingCache`.
  *(Depende de 4.2).*

## Fase 5: Middlewares de Transporte, Seguridad y Errores
- [x] 5.1 Implementar `backend/src/middlewares/rateLimiter.ts` configurando dos instancias de `express-rate-limit`:
  - `inferenceLimiter`: 30 req/min para endpoints de inferencia/escritura (`POST /validate`, `POST /phrases`).
  - `readLimiter`: 100 req/min para catálogo (`GET /phrases`).
  - Manejador de bloqueo que retorna HTTP `429 Too Many Requests`, cabecera `Retry-After` y JSON constitucional con código `RATE_LIMIT_EXCEEDED` (CA-12, CE-8).
  *(Depende de la Fase 1).*
- [x] 5.2 Implementar `backend/src/middlewares/contentTypeValidator.ts` que rechaza peticiones `POST` con encabezado incompatible con HTTP `415 Unsupported Media Type` (CE-9).
  *(No hay dependencias).*
- [x] 5.3 Implementar `backend/src/middlewares/errorHandler.ts` para captura centralizada de errores:
  - `ZodError` -> `400 Bad Request` con código `BAD_REQUEST`.
  - `DuplicatePhraseError` -> `409 Conflict` con código `DUPLICATE_PHRASE_DETECTED`.
  - `ExternalAIProviderError` -> `503 Service Unavailable` con código `AI_SERVICE_UNAVAILABLE`.
  - Errores de base de datos -> `500 Internal Server Error` con código `DATABASE_ERROR` (CA-15, CE-11).
  - Sanitización en producción: ofuscar stack traces y consultas SQL internas (RNF-9).
  *(Depende de la Fase 1 y 4.1).*

## Fase 6: Controladores, Rutas y Servidor Express con Patrón Fábrica
- [x] 6.1 Definir los esquemas de validación Zod en `backend/src/controllers/phrase.schemas.ts`:
  - `validatePhraseSchema`: `{ text: z.string().trim().min(1, 'Phrase cannot be empty').max(280) }` (CA-08, CE-10).
  - `createPhraseSchema`: `{ text: z.string().trim().min(1, 'Phrase cannot be empty').max(280), confirmDuplicate: z.boolean().optional().default(false) }`.
  - `listPhrasesQuerySchema`: `{ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(10), status: z.enum(['UNIQUE', 'CONFIRMED_DUPLICATE']).optional() }`.
  *(No hay dependencias).*
- [x] 6.2 Implementar `backend/src/controllers/healthController.ts` que responde inmediatamente `200 OK` con `{ success: true, data: { status: 'healthy', timestamp: ... } }` (CA-14).
  *(No hay dependencias).*
- [x] 6.3 Implementar `backend/src/controllers/phraseController.ts` gestionando la validación Zod, invocando a `PhraseService` y retornando las respuestas canónicas en `camelCase`.
  *(Depende de 6.1 y Fase 4).*
- [x] 6.4 Implementar `backend/src/routes/phraseRoutes.ts` ensamblando de forma autónoma la cadena de dependencias del módulo (`PhraseRepository` con singleton `db`, `PhraseService`, `PhraseController`) y exportando el `Router` por defecto (`export default router`).
  *(Depende de 6.2, 6.3 y Fase 5).*
- [x] 6.5 Implementar `backend/src/app.ts` importando directamente `phraseRoutes` (`app.use('/api/phrases', phraseRoutes)`), manteniendo `app.ts` conciso y desacoplado ante nuevos módulos, exportando la fábrica `createApp()`:
  - Configura `app.set('trust proxy', config.TRUST_PROXY)` para Fly.io.
  - Inyecta middlewares globales: `helmet()`, `cors({ origin: CORS_ORIGINS })`, `express.json({ limit: '10kb' })`.
  - Sonda `GET /api/health` ultraligera.
  - Implementar `backend/src/index.ts` que arranca la aplicación llamando a `createApp()`.
  *(Depende de 6.4 y Fase 5).*

## Fase 7: Pruebas de Integración y Auditoría Constitucional
- [x] 7.1 Implementar la suite de pruebas de integración HTTP con `supertest` en `backend/tests/integration/phrases.api.integration.test.ts`:
  - `POST /api/phrases/validate` con catálogo vacío retorna `isDuplicate: false` y score `null` (CA-01, CE-1).
  - `POST /api/phrases/validate` con duplicado semántico retorna `isDuplicate: true` y score redondeado (CA-02).
  - `POST /api/phrases/validate` con texto idéntico activa cortocircuito con score 1.0000 (CA-10).
  - `POST /api/phrases` guarda frase única con metadatos nulos retornando 201 (CA-03).
  - `POST /api/phrases` bloquea duplicado no confirmado con 409 Conflict (CA-04).
  - `POST /api/phrases` con `confirmDuplicate: true` persiste como `CONFIRMED_DUPLICATE` retornando 201 (CA-05).
  - `GET /api/phrases` retorna listado paginado determinista sin exponer array `embedding` (CA-06, CA-07).
  - Peticiones con textos de espacios en blanco `"   "` son rechazadas con 400 Bad Request (CA-08, CE-10).
  - Peticiones con Content-Type incompatible son rechazadas con 415 (CE-9).
  - Fallo simulado de Hugging Face retorna 503 sin filtrar secretos (CA-09, CE-5).
  - `GET /api/health` responde 200 ultraligero exento de rate limit (CA-14).
  - Reutilización de vector en memoria entre validación y guardado sin segunda llamada (CA-11).
  *(Depende de la Fase 6).*
- [x] 7.2 Ejecutar suite completa de tests de integración y unitarios (`npm test` en `backend/`), verificar compilación estricta de TypeScript (`npx tsc --noEmit`) y validar cumplimiento con `python scripts/check_constitution.py`.
  *(Depende de 7.1).*
