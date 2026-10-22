# Documentación Integral, Evidencias de IA y Entregables de Producción (Documentation and Evidence)

## Resumen
Consolidación exhaustiva de la documentación técnica, guías de despliegue, estándares de ingeniería y evidencia experimental del motor de inteligencia artificial de Semantic Phrase Validator. Esta especificación define los requisitos para una arquitectura documental jerárquica y modular en el monorepo compuesta por tres portales técnicos: el `README.md` principal en la raíz (visión global, puesta en marcha monorepo, arquitectura y evidencia de IA), el `backend/README.md` (especializado en API REST, Drizzle ORM, Zod y Hugging Face) y el `frontend/README.md` (especializado en Vue 3, Vite, Tailwind CSS y máquina de estados). Asimismo, contempla la provisión del script SQL consolidado (`scripts/schema.sql`), comandos unificados en la raíz (`db:migrate`, `test:hf`, `test:monorepo`, `typecheck`) y la formalización de la evidencia reproducible de inferencia y similitud semántica.

## Casos de usuario
- **CU-1 (Desarrollador Fullstack - Puesta en marcha global):** Como ingeniero que clona el monorepo por primera vez, quiero contar con un `README.md` en la raíz que me permita levantar la base de datos con Docker y arrancar simultáneamente el backend (`http://localhost:3000`) y el frontend (`http://localhost:5173`) con un solo comando en menos de 5 minutos, conociendo la arquitectura global y los enlaces a la documentación específica de cada paquete.
- **CU-2 (Desarrollador Backend - Desarrollo y API REST):** Como ingeniero enfocado en el servidor, quiero disponer de un `backend/README.md` dedicado que detalle exclusivamente las variables de entorno del backend, la ejecución de migraciones con Drizzle, el catálogo de endpoints REST con sus contratos Zod, las suites de pruebas (`test:unit`, `test:integration`) y la ejecución del script de inferencia con Hugging Face.
- **CU-3 (Desarrollador Frontend - Desarrollo de la UI):** Como diseñador o ingeniero de interfaz, quiero contar con un `frontend/README.md` que explique la configuración de `VITE_API_BASE_URL`, el diseño con Tailwind CSS, la máquina de estados de validación de frases (`usePhraseValidation`), el catálogo reactivo y los comandos de ejecución y testing con Vitest y `@vue/test-utils`.
- **CU-4 (Ingeniero de ML / Calidad - Evidencia de Similitud Semántica):** Como auditor de modelos y capacidades de IA, quiero inspeccionar la evidencia tangible (código fuente del proveedor, modelo utilizado y resultados numéricos de inferencia verificados) de la integración con Hugging Face, junto con un comando ejecutable directo para comprobar en vivo la similitud matemática entre oraciones idénticas, paráfrasis complejas y temas no relacionados.
- **CU-5 (Administrador de Base de Datos / DevOps - Persistencia e Idempotencia):** Como administrador de infraestructura o desarrollador que prefiere no utilizar herramientas CLI de ORM (Drizzle Kit), quiero disponer de un script SQL consolidado e idempotente (`schema.sql`) para inicializar directamente la estructura relacional de la tabla de frases con sus índices, tipos `JSONB` y restricciones de integridad en cualquier motor PostgreSQL estándar (psql, DBeaver, Neon o Supabase), con comandos directos tanto para clientes locales como vía `docker exec`.

## Criterios de aceptación
- [ ] Se formaliza la especificación de la funcionalidad en `specs/2026-10-21-004-documentation-and-evidence/spec.md` cumpliendo la estructura canónica y aprobando la validación de `scripts/validate_sdd.py`.
- [ ] **README principal en la raíz (`README.md`):** Se actualiza integralmente, estructurado en las siguientes secciones obligatorias:
  - Descripción general del proyecto, contexto y valor diferencial de la solución de IA.
  - Enlaces de navegación rápida hacia los paquetes (`backend/README.md` y `frontend/README.md`).
  - Pila tecnológica detallada (Node.js v24+, Express, Vue 3, Tailwind CSS, PostgreSQL 17, Drizzle ORM, Vitest, Docker, Hugging Face SDK).
  - Prerrequisitos de sistema (Node.js LTS >= 20.19.0 / v24+, Docker Compose, y cuenta con saldo y token de Hugging Face para inferencia real en caliente, o uso del mock en desarrollo/testing sin costo).
  - Guía de instalación y ejecución rápida paso a paso (clonado, instalación monorepo, copia de archivos `.env.example`, inicio de PostgreSQL y arranque concurrente con `npm run dev`).
  - Resumen de variables de entorno de la solución y su sincronización de puertos.
  - Arquitectura y decisiones de ingeniería: diagrama conceptual en arte ASCII, justificación de capas desacopladas (Clean Architecture / Hexagonal), cálculo de similitud coseno en memoria de backend vs extensiones vectoriales externas, optimizaciones de red (proyección SQL sin vectores) y caché LRU de embeddings.
  - Evidencia de integración con Hugging Face: modelo utilizado (`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`), vector de 384 dimensiones, código del proveedor e informe con la salida experimental verificada (coincidencia idéntica ~0.9993, paráfrasis ~0.8390 y frases no relacionadas ~0.1014).
  - Guía completa de testing: explicación de comandos para tests monorepo (`npm run test:monorepo`), tests unitarios, de integración y frontend.
  - Guía de solución de problemas (Troubleshooting): puertos 5432/3000, puerto 5174 de Vite con ajuste de CORS y soporte sin Docker.
- [ ] **README del Backend (`backend/README.md`):** Se crea un documento técnico autosuficiente con:
  - Resumen del servicio API y responsabilidades del backend.
  - Variables de entorno del backend (las 12 variables validadas por Zod en `src/config/env.ts` con tipado, propósito y defaults).
  - Rutas de base de datos (Ruta A con Drizzle `npm run db:migrate` y Ruta B con `scripts/schema.sql`).
  - Documentación exhaustiva de endpoints REST (`POST /api/phrases/validate`, `POST /api/phrases`, `GET /api/phrases`, `GET /api/health`), con tablas de códigos HTTP, schemas de validación Zod y payloads JSON de entrada y salida.
  - Políticas de seguridad y defensas: limitación de payload a 10 KB, validación de `Content-Type: application/json` y Rate Limiting por IP.
  - Comandos de desarrollo, compilación (`build`, `typecheck`), testing (`test:unit`, `test:integration`, `test:all`) y verificación de Hugging Face (`test:hf`).
- [ ] **README del Frontend (`frontend/README.md`):** Se crea un documento técnico autosuficiente con:
  - Resumen de la interfaz de usuario y responsabilidades de la SPA.
  - Configuración de entorno (`VITE_API_BASE_URL` y sincronización con el puerto del backend).
  - Arquitectura frontend: Vue 3 (Composition API, `<script setup>`), Tailwind CSS, composables (`usePhraseValidation`, `usePhraseCatalog`) y catálogo de componentes.
  - Diagrama o tabla de la máquina de estados de validación de oraciones (`IDLE`, `VALIDATING`, `UNIQUE_APPROVED`, `DUPLICATE_INFORMATIVE`, `DUPLICATE_WARNING`, `SAVING`, `ERROR`).
  - Comandos de desarrollo (`npm run dev`), compilación (`build`, `preview`), verificación de tipos (`typecheck`) y tests con Vitest / Vue Test Utils (`npm run test`).
- [ ] Se crea el archivo `scripts/schema.sql` con las sentencias DDL consolidada e idempotente para PostgreSQL:
  - Sentencia condicional `CREATE EXTENSION IF NOT EXISTS "pgcrypto";` para garantizar máxima compatibilidad con generación de UUIDs.
  - Creación de tabla `phrases` con columnas `id`, `text`, `embedding` (`jsonb`), `similarity_score`, `similar_to_id`, `validation_status` y `created_at` mediante `CREATE TABLE IF NOT EXISTS`.
  - Definición de clave foránea reflexiva sobre `similar_to_id` con borrado en cascada neutro (`ON DELETE SET NULL`).
  - Creación condicional de índice compuesto descendente `idx_phrases_created_at_id` sobre `(created_at DESC, id DESC)` mediante `CREATE INDEX IF NOT EXISTS`.
- [ ] Se añaden scripts de conveniencia al `package.json` de la raíz del monorepo y paquetes hijos:
  - En raíz: `"db:migrate"` para ejecutar las migraciones de base de datos (`npm --prefix backend run db:migrate`).
  - En raíz: `"test:hf"` para ejecutar el script de verificación en vivo de Hugging Face (`tsx backend/src/scripts/testHuggingFace.ts`).
  - En raíz: `"test:monorepo"` para ejecutar de forma secuencial los 101 tests automatizados de la solución (backend unitario + backend integración + frontend).
  - En raíz: `"typecheck"` para compilar y validar estáticamente los tipos en backend y frontend sin emitir JS.
  - En `frontend/package.json`: `"typecheck": "vue-tsc -b --noEmit"` para permitir la verificación rápida de tipos en el frontend.
- [ ] El script de verificación de Hugging Face [`testHuggingFace.ts`](file:///c:/Workspaces/nanoxxi93/semantic-phrase-validator/backend/src/scripts/testHuggingFace.ts) valida preventivamente si el token configurado es un placeholder o carece de saldo, emitiendo una advertencia formativa sin crashear.
- [ ] Se actualiza `specs/roadmap.md` registrando la especificación `004-documentation-and-evidence` en la sección de tareas en curso.
- [ ] La totalidad de los scripts de validación (`python scripts/check_constitution.py` y `python scripts/validate_sdd.py`) se ejecutan sin reportar infracciones ni errores de formato.

## Requisitos funcionales
- **RF-1 (Arquitectura documental modular del Monorepo):** La documentación debe organizarse en una jerarquía clara de 3 niveles:
  - `README.md` (Raíz): Punto de entrada general, orquestación monorepo y decisiones globales.
  - `backend/README.md`: Manual operativo y de desarrollo específico para el backend.
  - `frontend/README.md`: Manual operativo y de desarrollo específico para el frontend.
- **RF-2 (Script SQL autónomo e idempotente):** El archivo `scripts/schema.sql` no debe requerir dependencias de Node.js ni herramientas de compilación para ser ejecutado; debe ser directamente interpretable por utilidades nativas de PostgreSQL (`psql -f scripts/schema.sql` o vía `docker exec`) y contener cláusulas `IF NOT EXISTS` para tolerar ejecuciones repetidas sin lanzar errores.
- **RF-3 (Comandos unificados de desarrollo en monorepo):** El archivo `package.json` raíz debe centralizar el ciclo de vida del desarrollador, permitiendo la instalación, migración de base de datos, ejecución de tests por nivel, verificación de tipos y prueba de IA mediante comandos estándar de npm sin requerir navegación manual entre carpetas.
- **RF-4 (Documentación de contratos canónicos de API):** La sección de API REST en `backend/README.md` y en el README raíz debe reflejar exactamente los esquemas de validación Zod y las respuestas de error estructuradas definidas en el backend (`{ success: true, data }` y `{ success: false, error: { code, message, details } }`), incluyendo el manejo de duplicados (código 409) y limitación de tasa (código 429).
- **RF-5 (Trazabilidad y reproducibilidad de la evidencia de IA):** La evidencia de Hugging Face debe incluir tanto el enlace al código fuente relevante como los valores numéricos precisos de la prueba empírica, junto con la instrucción de cómo reproducirla en un entorno local con credenciales válidas y saldo habilitado.
- **RF-6 (Diagnóstico preventivo de credenciales de IA):** El script `testHuggingFace.ts` debe interceptar la ausencia o falsedad de `HF_TOKEN` (ej. valor por defecto `hf_dummy_token_for_dev`) o errores de saldo y orientar con claridad sobre cómo obtener un token y configurar saldo en Hugging Face.

## Requisitos no funcionales
- **RNF-1 (Seguridad y no exposición de secretos):** Bajo ninguna circunstancia deben incluirse tokens de acceso reales de Hugging Face (`HF_TOKEN`) ni contraseñas de producción en los archivos `README.md`, `schema.sql` o archivos versionados, cumpliendo estrictamente la regla 3.1 de `specs/constitution.md`.
- **RNF-2 (Formato de fin de línea LF):** Todos los documentos creados (`spec.md`, `README.md`, `backend/README.md`, `frontend/README.md`, `schema.sql`) deben generarse con saltos de línea estilo Unix (`LF`), en conformidad con `.ai-context.md`.
- **RNF-3 (Convención lingüística y consistencia):** Toda la documentación debe redactarse en idioma español con estilo técnico formal, neutral y riguroso, conforme a la regla 4.2 de `specs/constitution.md`.
- **RNF-4 (Claridad multiplataforma en instrucciones):** Los bloques de comando sugeridos en los READMEs deben ser compatibles tanto con Git Bash / terminales POSIX como con PowerShell en Windows.

## Casos extremos
- **CE-1 (Despliegue local sin contenedor Docker):** El README debe contemplar la alternativa de conectar el backend a una base de datos PostgreSQL local instalada en el SO o administrada en la nube (ej. Neon, Supabase, Render) modificando únicamente la variable `DATABASE_URL` en `.env`.
- **CE-2 (Entorno de desarrollo o CI sin API Token de Hugging Face o sin saldo):** El README debe documentar explícitamente que para verificar el software y ejecutar la suite completa de tests (`npm run test:monorepo`) no es indispensable un token real de Hugging Face ni saldo cargado, ya que el sistema implementa una arquitectura basada en inversión de dependencias con un `MockEmbeddingProvider` determinista.
- **CE-3 (Ejecución redundante de scripts de migración):** El script `scripts/schema.sql` debe incorporar sentencias condicionales (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) para garantizar que múltiples ejecuciones accidentales sobre una misma base de datos no produzcan colisiones ni pérdida de datos.
- **CE-4 (Arranque en frío o degradación de la API de Hugging Face):** El README debe documentar cómo la arquitectura mitiga las latencias de arranque en frío (cold start de ~5-10s en modelos serverless) mediante reintentos automáticos en `HuggingFaceEmbeddingProvider.ts` y caché LRU en memoria.
- **CE-5 (Colisión de puertos locales 5432 o 3000):** La sección de solución de problemas del README debe detallar cómo remapear el puerto de PostgreSQL en `docker-compose.yml` (ej. `"5433:5432"`) actualizando `DATABASE_URL` a `localhost:5433`, o modificar la variable `PORT=3001` en `backend/.env` si el puerto 3000 se encuentra en uso por otra aplicación anfitriona, recordando actualizar en dicho caso `VITE_API_BASE_URL=http://localhost:3001/api` en `frontend/.env`.
- **CE-6 (Invocación de script de IA con token placeholder o sin saldo):** Si el desarrollador ejecuta `npm run test:hf` manteniendo `HF_TOKEN=hf_dummy_token_for_dev` o con una cuenta sin saldo activo de inferencia, el script intercepta la ejecución con antelación o captura el código de estado correspondiente (401/402/403), emite un mensaje instructivo para generar un token y verificar saldo en Hugging Face, y finaliza con código de salida limpio (1) sin desbordar trazas no controladas.
- **CE-7 (Vite conmuta al puerto 5174 y bloqueo de CORS):** Si el puerto 5173 está ocupado y Vite inicia automáticamente en el puerto 5174, las peticiones hacia la API serán bloqueadas por la directiva de orígenes cruzados. La guía de troubleshooting documentará cómo añadir `http://localhost:5174` a la variable `CORS_ORIGINS` en `backend/.env` para restablecer la comunicación inmediatamente.
- **CE-8 (Ejecución de `schema.sql` sin utilidad `psql` en el host):** Si el desarrollador no dispone del cliente PostgreSQL nativo en su sistema anfitrión, la documentación provee el comando `docker exec -i semantic_phrases_postgres psql -U postgres -d semantic_phrases < scripts/schema.sql` para inyectar y aplicar el esquema directamente dentro del contenedor sin dependencias de software local adicionales.
