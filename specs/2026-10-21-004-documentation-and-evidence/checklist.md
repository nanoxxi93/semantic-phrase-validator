# Lista de Comprobación y QA: 004-documentation-and-evidence

## Entornos de Prueba Requeridos
- [ ] Entorno CLI Monorepo (`bash` / `powershell` en la raíz del proyecto) con Node.js 24+ y npm.
- [ ] Entorno de Base de Datos PostgreSQL 17 local levantado mediante Docker Compose (`docker compose up -d`).
- [ ] Entorno de Servidor Backend local en Express (`npm --prefix backend run dev`) en `http://localhost:3000`.
- [ ] Entorno de Aplicación Cliente Frontend en Vite (`npm --prefix frontend run dev`) en `http://localhost:5173`.
- [ ] Entornos de Validación Automatizada: Vitest, TypeScript (`tsc`), `vue-tsc` y scripts Python de gobernanza (`check_constitution.py`, `validate_sdd.py`).

---

## Casos de Prueba (Criterios de Aceptación)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| **CA-01** | CLI | 1. Ejecutar `python scripts/validate_sdd.py`. | Valida satisfactoriamente la estructura canónica de los 4 artefactos (`spec.md`, `plan.md`, `tasks.md`, `checklist.md`) para las 5 especificaciones del proyecto. | [ ] | Verificación SDD automatizada. |
| **CA-02** | Archivos | 1. Abrir `README.md` en la raíz. 2. Inspeccionar la sección de navegación. | Presenta la visión del producto, enlaces funcionales relativos hacia `backend/README.md` y `frontend/README.md`, y justificación del valor de IA. | [ ] | Portal unificado monorepo. |
| **CA-03** | CLI / Docker | 1. Seguir la guía de inicio rápido del `README.md`. 2. Copiar archivos `.env.example`. 3. Ejecutar `docker compose up -d`. 4. Ejecutar `npm run dev`. | Los contenedores y servicios de backend (`:3000`) y frontend (`:5173`) inician simultáneamente sin errores de dependencias. | [ ] | Puesta en marcha rápida documentada. |
| **CA-04** | Documentación | 1. Contrastar la tabla de variables del `README.md` con `src/config/env.ts` (backend) y `src/config/env.ts` (frontend). | Documenta las 13 variables de entorno con sus tipos, valores por defecto, obligatoriedad y la sincronización entre `PORT` y `VITE_API_BASE_URL`. | [ ] | Cobertura total de configuración. |
| **CA-05** | Documentación | 1. Inspeccionar la sección de arquitectura del `README.md`. | Contiene el diagrama de capas en arte ASCII, la justificación de cálculo en memoria backend vs bases vectoriales, la proyección SQL sin vectores y la caché LRU. | [ ] | Decisiones técnicas sustentadas. |
| **CA-06** | CLI / Documentación | 1. Leer la sección de Evidencia de Hugging Face en el `README.md`. 2. Ejecutar `npm run test:hf` con credenciales activas. | Muestra las métricas numéricas verificadas (idéntica: ~0.9993, paráfrasis: ~0.8390, no relacionada: ~0.1014) y el comando ejecutable para reproducirlas. | [ ] | Evidencia experimental comprobada. |
| **CA-07** | Documentación | 1. Abrir `backend/README.md`. 2. Inspeccionar contratos REST. | Documenta los 4 endpoints (`validate`, `POST`, `GET`, `health`), códigos de estado HTTP (200, 201, 400, 409, 413, 415, 429, 503), esquemas Zod y Rate Limiting. | [ ] | Portal técnico backend. |
| **CA-08** | Documentación | 1. Abrir `frontend/README.md`. 2. Inspeccionar la arquitectura de la SPA. | Documenta Vue 3, Tailwind CSS, configuración de `VITE_API_BASE_URL`, componentes y la máquina de estados de validación semántica (7 estados). | [ ] | Portal técnico frontend. |
| **CA-09** | Base de Datos / CLI | 1. Inspeccionar `scripts/schema.sql`. 2. Ejecutar el script contra PostgreSQL. | Crea de forma idempotente la extensión `pgcrypto`, tabla `phrases`, clave foránea reflexiva e índice compuesto descendente `idx_phrases_created_at_id`. | [ ] | Persistencia SQL directa. |
| **CA-10** | CLI / package.json | 1. Inspeccionar los scripts del `package.json` raíz y `frontend/package.json`. | Existen y funcionan los atajos `"db:migrate"`, `"test:hf"`, `"test:monorepo"` y `"typecheck"`. | [ ] | Atajos de conveniencia DX. |
| **CA-11** | CLI / Script HF | 1. Ejecutar `npm run test:hf` configurando temporalmente `HF_TOKEN=hf_dummy_token_for_dev`. | Intercepta la ejecución antes de emitir peticiones a la red, muestra una guía amigable hacia `https://huggingface.co/settings/tokens` y finaliza con código 1. | [ ] | Diagnóstico preventivo de credenciales. |
| **CA-12** | CLI / Vitest | 1. Ejecutar `npm run test:monorepo` desde la raíz. | Ejecuta secuencialmente backend unitario, backend integración y frontend, reportando los 101 tests pasando con éxito. | [ ] | Suite completa automatizada. |
| **CA-13** | CLI / TypeScript | 1. Ejecutar `npm run typecheck` desde la raíz. | Compila y valida los tipos estáticos en backend (`tsc --noEmit`) y frontend (`vue-tsc -b --noEmit`) con 0 errores y cero tipos `any`. | [ ] | Validación estática estricta. |
| **CA-14** | CLI / Python | 1. Ejecutar `python scripts/check_constitution.py`. | Analiza el repositorio y certifica 0 violaciones constitucionales (cero secretos, cero `console.log` en producción, formato LF preservado). | [ ] | Cumplimiento de constitución. |
| **CA-15** | Gobernanza | 1. Revisar `specs/roadmap.md` y `CHANGELOG.md`. | La Fase 4 figura registrada, actualizada y lista para su cierre formal de entrega. | [ ] | Trazabilidad del roadmap. |

---

## Pruebas de Casos Extremos (Edge Cases)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| **CE-01** | Documentación | 1. Consultar la sección de base de datos sin Docker en el `README.md`. | Provee instrucciones claras para enlazar el backend a instancias PostgreSQL locales o administradas (Neon / Supabase) mediante `DATABASE_URL`. | [ ] | Soporte sin contenedor Docker. |
| **CE-02** | CLI / Vitest | 1. Ejecutar `npm run test:monorepo` sin conexión a internet o con `HF_TOKEN` no configurado. | Los 101 tests automatizados pasan al 100% sin errores de red gracias a la inyección del `MockEmbeddingProvider`. | [ ] | Testing determinista sin costo. |
| **CE-03** | CLI / SQL | 1. Aplicar `scripts/schema.sql` dos o más veces consecutivas sobre la misma base de datos. | Todas las ejecuciones completan con éxito sin lanzar errores de objetos duplicados gracias a las cláusulas `IF NOT EXISTS`. | [ ] | Idempotencia en persistencia SQL. |
| **CE-04** | Documentación | 1. Revisar la sección de mitigación de cold start en el `README.md`. | Explica la política de reintentos exponenciales en `HuggingFaceEmbeddingProvider.ts` y la caída de latencia a <2ms con la caché LRU. | [ ] | Mitigación de latencias de red. |
| **CE-05** | Configuración | 1. Simular colisión en puertos 5432 o 3000 siguiendo la guía de Troubleshooting. | Detalla el remapeo a `5433:5432` en `docker-compose.yml`, ajuste de `PORT=3001` en `backend/.env` y actualización de `VITE_API_BASE_URL`. | [ ] | Resolución de colisiones de puerto. |
| **CE-06** | CLI / Inferencia | 1. Invocar `testHuggingFace.ts` con una cuenta que no tenga saldo activo de inferencia. | El script captura el código de estado retornado por la API y orienta claramente al desarrollador sobre la configuración de saldo sin desbordar trazas no controladas. | [ ] | Control de errores de saldo. |
| **CE-07** | Frontend / Red | 1. Ocupar el puerto 5173 e iniciar el frontend en el puerto 5174 con Vite. | La guía de troubleshooting documenta cómo incorporar `http://localhost:5174` en la variable `CORS_ORIGINS` de `backend/.env` para evitar bloqueos por CORS. | [ ] | Manejo de CORS dinámico en Vite. |
| **CE-08** | CLI / Docker | 1. En una máquina sin cliente `psql` local, ejecutar `docker exec -i semantic_phrases_postgres psql -U postgres -d semantic_phrases < scripts/schema.sql`. | El script SQL se canaliza y ejecuta directamente dentro del contenedor de Docker inicializando el esquema sin dependencias locales. | [ ] | Despliegue SQL sin binarios cliente. |
