# Hoja de ruta (Roadmap)

> **Versión publicada:** Ninguna  
> **Estado actual:** Fase 0 completada (Constitución y Arquitectura Inicial)

---

## Fase 0: Inicialización del Proyecto y Constitución (Completada)
Establecimiento de las bases metodológicas, arquitectura técnica y gobernanza bajo Spec-Driven Development (SDD).
- [x] Inicialización del repositorio y eliminación de placeholders en documentos de gobernanza.
- [x] Definición de la visión de producto y flujo de valor en `specs/mission.md`.
- [x] Selección del stack tecnológico y decisiones de ingeniería en `specs/tech-stack.md`.
- [x] Redacción de estándares innegociables y reglas arquitectónicas en `specs/constitution.md` y `specs/constitution.rules.json`.
- [x] Verificación de cumplimiento automatizado mediante scripts de auditoría (`check_constitution.py` y `validate_sdd.py`).

---

## Fase 1: `001-core-semantic-engine` (Motor Semántico y Persistencia Base)
Construcción del núcleo matemático, la capa de persistencia en PostgreSQL con Drizzle ORM y la integración de embeddings con Hugging Face.
- [ ] Configuración del entorno de base de datos PostgreSQL local con Docker Compose.
- [ ] Definición del esquema Drizzle ORM para la tabla `phrases` (`id`, `text`, `embedding` en `JSONB`, `similarity_score`, `similar_to_id`, `validation_status`, `created_at`).
- [ ] Generación y ejecución de migraciones iniciales con `drizzle-kit`.
- [ ] Implementación de la utilidad pura de cálculo de similitud coseno (`calculateCosineSimilarity`) en `utils/`.
- [ ] Definición de la interfaz abstracta `EmbeddingProvider`.
- [ ] Implementación del proveedor concreto `HuggingFaceEmbeddingProvider` utilizando `@huggingface/inference` y el modelo `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`.
- [ ] Pruebas unitarias completas con Vitest para el cálculo de similitud coseno (casos límite: ortogonalidad, coincidencia idéntica, vectores nulos) y mock determinista del proveedor.

---

## Fase 2: `002-phrase-validation-api` (API REST y Lógica de Negocio)
Implementación de la capa de servicios, validación de esquemas Zod, endpoints HTTP en Express y manejo centralizado de errores.
- [ ] Configuración de variables de entorno con esquema de validación Zod (`DATABASE_URL`, `HF_TOKEN`, `HF_MODEL`, `SIMILARITY_THRESHOLD`, `PORT`).
- [ ] Implementación de `PhraseRepository` con Drizzle para operaciones CRUD de frases y lectura de vectores existentes.
- [ ] Implementación de `PhraseService` con la lógica de negocio:
  - Generación de embedding para la frase entrante.
  - Comparación contra el catálogo de frases previas mediante similitud coseno.
  - Evaluación del umbral de similitud configurable (`SIMILARITY_THRESHOLD`).
  - Determinación de duplicados y asociación de metadatos (`similar_to_id`, `similarity_score`).
- [ ] Creación de endpoints REST con validación Zod:
  - `POST /api/phrases/validate`: analiza una frase candidata y retorna si es potencialmente duplicada con su score y frase causante.
  - `POST /api/phrases`: persiste la frase con su estado (`UNIQUE` o `CONFIRMED_DUPLICATE`) y metadatos correspondientes.
  - `GET /api/phrases`: lista todas las frases registradas ordenadas cronológicamente con sus metadatos.
- [ ] Middleware global para manejo de errores estandarizado (`400 Bad Request`, `500 Internal Server Error`, `503 Service Unavailable`).
- [ ] Pruebas de integración automatizadas con Vitest y `supertest` cubriendo el flujo completo de validación y persistencia.

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
- Ninguna (Fase 0 completada; pendiente inicio de Fase 1 bajo SDD).

### En main, sin versión todavía
- Gobernanza fundacional (`specs/mission.md`, `specs/tech-stack.md`, `specs/constitution.md`, `specs/constitution.rules.json`, `specs/roadmap.md`).

### Después de la 1.0.0
- Migración a extensión `pgvector` en PostgreSQL para búsqueda vectorial indexada mediante HNSW / IVFFlat en catálogos de alta escala.
- Soporte para ajuste dinámico del umbral de similitud directamente desde un panel de ajustes en la interfaz de usuario.
