# Hoja de ruta (Roadmap)

> **Versión publicada:** Ninguna  
> **Estado actual:** Fase 2 y Refactorización 002.1 completadas (preparando Fase 3: 003-phrase-validator-ui)

---

## Fase 0: Inicialización del Proyecto y Constitución (Completada)
Establecimiento de las bases metodológicas, arquitectura técnica y gobernanza bajo Spec-Driven Development (SDD).
- [x] Inicialización del repositorio y eliminación de placeholders en documentos de gobernanza.
- [x] Definición de la visión de producto y flujo de valor en `specs/mission.md`.
- [x] Selección del stack tecnológico y decisiones de ingeniería en `specs/tech-stack.md`.
- [x] Redacción de estándares innegociables y reglas arquitectónicas en `specs/constitution.md` y `specs/constitution.rules.json`.
- [x] Verificación de cumplimiento automatizado mediante scripts de auditoría (`check_constitution.py` y `validate_sdd.py`).

---

## Fase 1: `001-core-semantic-engine` (Motor Semántico y Persistencia Base - Completada)
Construcción del núcleo matemático, la capa de persistencia en PostgreSQL con Drizzle ORM y la integración de embeddings con Hugging Face.
- [x] Configuración del entorno de base de datos PostgreSQL local con Docker Compose.
- [x] Definición del esquema Drizzle ORM para la tabla `phrases` (`id`, `text`, `embedding` en `JSONB`, `similarity_score`, `similar_to_id`, `validation_status`, `created_at`).
- [x] Generación y ejecución de migraciones iniciales con `drizzle-kit`.
- [x] Implementación de la utilidad pura de cálculo de similitud coseno (`calculateCosineSimilarity`) en `utils/`.
- [x] Definición de la interfaz abstracta `EmbeddingProvider`.
- [x] Implementación del proveedor concreto `HuggingFaceEmbeddingProvider` utilizando `@huggingface/inference` y el modelo `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`.
- [x] Pruebas unitarias completas con Vitest para el cálculo de similitud coseno (casos límite: ortogonalidad, coincidencia idéntica, vectores nulos) y mock determinista del proveedor.

---

## Fase 2: `002-phrase-validation-api` (API REST y Lógica de Negocio - Completada)
Implementación de la capa de servicios, validación de esquemas Zod, endpoints HTTP en Express y manejo centralizado de errores.
- [x] Configuración de variables de entorno con esquema de validación Zod (`DATABASE_URL`, `HF_TOKEN`, `HF_MODEL`, `SIMILARITY_THRESHOLD`, `PORT`, `TRUST_PROXY`, `EMBEDDING_CACHE_TTL_SECONDS`, `RATE_LIMIT_*`, `CORS_ORIGINS`).
- [x] Implementación de `PhraseRepository` con Drizzle para operaciones CRUD de frases, ordenamiento determinista, lectura de vectores y resolución de auto-joins.
- [x] Implementación de `PhraseService` con la lógica de negocio:
  - Cortocircuito exacto de texto con 0 llamadas a IA (score 1.0000).
  - Consulta y almacenamiento en caché LRU de embeddings (`lru-cache`).
  - Inferencia con Hugging Face y cálculo de similitud coseno contra catálogo.
  - Determinación de duplicados y asociación de metadatos (`similar_to_id`, `similarity_score`).
- [x] Creación de endpoints REST con validación Zod y arquitectura modular:
  - `POST /api/phrases/validate`: pre-validación informativa con score más afín y frase causante.
  - `POST /api/phrases`: persistencia como `UNIQUE` o `CONFIRMED_DUPLICATE` (bloqueo 409 si no confirmada).
  - `GET /api/phrases`: consulta paginada determinista (`created_at DESC, id DESC`) con filtro de estado y exclusión del vector.
  - `GET /api/health`: sonda ultraligera de salud para Fly.io y Docker.
- [x] Middlewares de hardening (`helmet`, `cors`), rate limiting por IP real (`trust proxy`), Content-Type validator (415) y manejo canónico de errores.
- [x] Pruebas de integración automatizadas con Vitest y `supertest` cubriendo el flujo completo de validación y persistencia.

---

## Fase 2.1: `002-1-app-composition-root` (Refactorización de Ensamblaje en app.ts y Pureza de Rutas - Completada)
Refactorización de la arquitectura de ensamblaje (Composition Root) del backend, centralizando la instanciación de dependencias en `createApp()` de `src/app.ts` y purificando `src/routes/phraseRoutes.ts`.
- [x] [`002.1-app-composition-root`](2026-10-21-002-1-app-composition-root/) — Centralización del Composition Root en Express Core (`app.ts`) y pureza de rutas.

---

## Fase 3: `003-phrase-validator-ui` (Interfaz de Usuario Reactiva)
Construcción de la interfaz SPA con Vue 3, Vite y Tailwind CSS, implementando la máquina de estados de validación y la experiencia de usuario completa.
- [ ] Inicialización del frontend con Vue 3 (Composition API, `<script setup>`, TypeScript) y Tailwind CSS.
- [ ] Creación del composable `usePhraseValidation` para gestionar el ciclo de estados:
  - Estados: *idle*, *validating*, *duplicate_detected*, *saving*, *success*, *error*.
- [ ] Creación del composable `usePhraseCatalog` para consultar y sincronizar el listado histórico de frases.
- [ ] Componente `PhraseForm`: campo de entrada para oraciones cortas con botón de acción interactivo.
- [ ] Componente `DuplicateAlertModal`: alerta visual que informa la detección de duplicado potencial, mostrando la frase más similar encontrada, el puntaje porcentual de afinidad y botones de acción ("Confirmar Guardado" / "Cancelar").
- [ ] Componente `PhraseList`: listado de frases guardadas con badges visuales de estado (`UNIQUE` en verde, `CONFIRMED_DUPLICATE` en ámbar), fecha y puntaje de similitud asociado.
- [ ] Manejo de feedback visual: estados de carga (spinners), deshabilitación de botones durante inferencia y mensajes de error amigables si falla el servicio de IA.

---

## Fase 4: Documentación y Evidencia
Consolidación final del proyecto, verificación integral de calidad y documentación de la arquitectura.
- [ ] Documentación detallada en `README.md` con instrucciones de configuración local, ejecución de migraciones, variables de entorno y comandos de test.
- [ ] Diagramas de arquitectura y flujo de validación semántica documentados.
- [ ] Registro de evidencias de integración exitosa con la API de Hugging Face y capturas del flujo de usuario.
- [ ] Auditoría de cierre: verificación de cero infracciones constitucionales y pase de la suite completa de tests.

---

## Tareas Sueltas

### En curso
- Ninguna tarea activa en este momento (preparando Fase 3).

### Completadas
- [002-phrase-validation-api](2026-10-21-002-phrase-validation-api/) — API REST con Express, servicios de validación semántica, persistencia relacional paginada, caché LRU, rate limiting y manejo centralizado de errores (Fase 2).
- [001-core-semantic-engine](2026-10-20-001-core-semantic-engine/) — Motor semántico de cálculo de similitud coseno, abstracción de embeddings con Hugging Face y persistencia base en PostgreSQL (Fase 1).

### En main, sin versión todavía
- Gobernanza fundacional (`specs/mission.md`, `specs/tech-stack.md`, `specs/constitution.md`, `specs/constitution.rules.json`, `specs/roadmap.md`).

### Después de la 1.0.0
- Migración a extensión `pgvector` en PostgreSQL para búsqueda vectorial indexada mediante HNSW / IVFFlat en catálogos de alta escala.
- Soporte para ajuste dinámico del umbral de similitud directamente desde un panel de ajustes en la interfaz de usuario.
