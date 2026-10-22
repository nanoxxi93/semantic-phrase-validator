# Changelog

Registro de cambios de Semantic Phrase Validator. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); el proyecto usa [Versionado Semántico](https://semver.org/lang/es/) desde la primera versión publicada.

Mientras no haya versiones, todo va en **Sin publicar**, agrupado por fecha (la más reciente arriba).

Categorías: **Añadido** (algo nuevo) · **Cambiado** (algo existente se comporta distinto) · **Obsoleto** (se eliminará pronto) · **Eliminado** · **Corregido** (bugs) · **Seguridad**.

## [Sin publicar]

### 2026-10-22

#### Añadido
- Implementación completa de `004-documentation-and-evidence` (Fase 4 del roadmap):
  - Arquitectura documental modular en 3 niveles: portal unificado en raíz (`README.md`), manual técnico de la API (`backend/README.md`) y manual técnico de la SPA (`frontend/README.md`).
  - Script SQL consolidado e idempotente (`scripts/schema.sql`) para inicialización directa en PostgreSQL 17 sin herramientas de build, con extensión `pgcrypto`, tabla `phrases`, auto-referencia foránea e índice compuesto descendente.
  - Comandos unificados de ciclo de vida en `package.json`: `npm run test:monorepo` (101 tests), `npm run typecheck`, `npm run test:hf` y `npm run db:migrate`.
  - Diagnóstico preventivo en `backend/src/scripts/testHuggingFace.ts` ante tokens placeholder o cuentas sin saldo de inferencia.
  - Informe de evidencia experimental reproducible con Hugging Face (`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`) con métricas comprobadas: idéntica `0.9993`, paráfrasis `0.8390` y no relacionada `0.1014`.
  - Guía de resolución de problemas (Troubleshooting) cubriendo colisiones de puertos (5432/3000), CORS ante puerto dinámico de Vite (`5174`) y despliegue sin Docker.
- Implementación completa de `003-phrase-validator-ui` (Fase 3 del roadmap):
  - SPA reactiva desarrollada con Vue 3 (Composition API, `<script setup>`), Tailwind CSS v3 y Vite.
  - Máquina de estados de validación semántica en `usePhraseValidation` con 7 estados deterministas (`IDLE`, `VALIDATING`, `UNIQUE_APPROVED`, `DUPLICATE_INFORMATIVE`, `DUPLICATE_WARNING`, `SAVING`, `ERROR`).
  - Catálogo reactivo paginado en `usePhraseCatalog` con selector de filtros por estado y reseteo automático de visualización.
  - Componentes accesibles (`PhraseForm`, `DuplicateAlertCard`, `ValidationResultCard`, `ErrorAlertBanner`, `PhraseCard`, `PaginationBar`).
  - Suite de 35 pruebas automatizadas con Vitest, `@vue/test-utils` y `happy-dom`.

### 2026-10-21

#### Cambiado
- Refactorización de la arquitectura de ensamblaje (`002.1-app-composition-root`):
  - Centralización del Composition Root en `createApp(options?: AppOptions)` de `src/app.ts`, con soporte para inyección de dependencias en tests y resolución productiva por defecto.
  - Purificación estricta de la capa de transporte en `src/routes/phraseRoutes.ts`, exportando exclusivamente la interfaz `PhraseRoutesOptions` y la factoría `createPhraseRoutes(options)`, erradicando sentencias `new` e importaciones de base de datos.
  - Supresión de la exportación ansiosa de singleton (`export const app = createApp()`) en `app.ts` para evitar efectos colaterales al importar en tests.
  - Simplificación del setup de pruebas de integración en `tests/integration/phrases.api.integration.test.ts` delegando el ensamblaje directamente en `createApp`.

#### Añadido
- Implementación completa de `002-phrase-validation-api` (Fase 2 del roadmap):
  - Endpoints REST en Express (`POST /api/phrases/validate`, `POST /api/phrases`, `GET /api/phrases`, `GET /api/health`).
  - Pre-validación informativa con score exacto y frase más cercana sin consumir cuota externa en coincidencias exactas (cortocircuito a 1.0000).
  - Persistencia condicionada con bloqueo `409 Conflict` (`DUPLICATE_PHRASE_DETECTED`) ante duplicados no confirmados y guardado de `CONFIRMED_DUPLICATE` con trazabilidad al confirmar.
  - Paginación determinista en catálogo con índice compuesto `(created_at DESC, id DESC)`, exclusión del vector `embedding` y filtros por estado.
  - Capa de acceso a datos `PhraseRepository` con Drizzle ORM, casting numérico de `similarityScore` y resolución de auto-joins.
  - Capa de caché LRU en memoria con `lru-cache` y TTL de 1 hora para reutilización transparente de vectores.
  - Arquitectura modular de rutas donde `phraseRoutes.ts` ensambla su cadena de dependencias con pool singleton de base de datos (`db`).
  - Middlewares de seguridad: `helmet`, `cors`, `contentTypeValidator` (HTTP 415), `rateLimiter` (30 req/min inferencia, 100 req/min lectura con soporte para `trust proxy` en Fly.io) y manejador canónico de errores (`errorHandler`).
  - Suite de integración E2E con `supertest` y Vitest, alcanzando 66 pruebas automatizadas con 100% de éxito.
- Implementación completa de `001-core-semantic-engine` (Fase 1 del roadmap).
- Estructura monorepo con `backend/` en TypeScript estricto (`"strict": true`, `"moduleResolution": "node16"`).
- Entorno de base de datos PostgreSQL 17 (`postgres:17-alpine`) en `docker-compose.yml`.
- Esquema Drizzle ORM para tabla `phrases` con columna `embedding` vectorial en `JSONB`, clave foránea auto-referencial `similar_to_id` (`ON DELETE SET NULL`) y precisión `NUMERIC(5,4)` para `similarity_score`.
- Migración SQL inicial generada mediante Drizzle Kit (`backend/src/db/migrations/0000_lush_proteus.sql`).
- Validación estricta de variables de entorno en arranque con Zod (`DATABASE_URL`, `HF_TOKEN`, `HF_MODEL`).
- Función matemática pura de similitud coseno (`calculateCosineSimilarity`) en $O(N)$, con acotación a `[0.0000, 1.0000]` y redondeo a 4 decimales.
- Interfaz `EmbeddingProvider` y dos implementaciones:
  - `MockEmbeddingProvider`: determinista mediante algoritmo de hash y fixtures inyectables para pruebas sin red.
  - `HuggingFaceEmbeddingProvider`: con reintentos progresivos ante cold-start (HTTP 503), desempaquetado tolerante de tensores 2D y sanitización estricta de tokens en errores.
- Script de diagnóstico y validación semántica real en vivo `backend/src/scripts/testHuggingFace.ts`.
- Suite automatizada con 21 pruebas unitarias y de integración pasando al 100% en Vitest.

### 2026-10-20

#### Añadido
- Inicialización del proyecto y configuración de gobernanza base SDD (Fase 0).
- Definición de documentos fundacionales en `specs/`: misión del producto, stack tecnológico (Node.js v24+, Express, TypeScript, Vue 3, Drizzle ORM, PostgreSQL y Hugging Face Inference), constitución del software y roadmap de desarrollo.
- Reglas automatizadas de cumplimiento de la constitución (`specs/constitution.rules.json`) para escaneo de secretos y logs.
