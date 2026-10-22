# Lista de Comprobación y QA: 002.1-app-composition-root

## Entornos de Prueba Requeridos
- [x] Contenedor PostgreSQL 17 (`postgres:17-alpine`) ejecutándose mediante Docker Compose (`docker compose up -d`).
- [x] Entorno CLI / Node.js (Node.js v24+ y TypeScript en `backend/`).
- [x] Suite de pruebas automatizadas con Vitest y `supertest` (`npm test` y `npm --prefix backend run test:all`).

---

## Casos de Prueba (Criterios de Aceptación)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| **CA-01** | CLI / Código | Inspeccionar `backend/src/routes/phraseRoutes.ts` verificando que no importe `src/db/`, `PhraseRepository`, `PhraseService`, `HuggingFaceEmbeddingProvider` ni `InMemoryEmbeddingCache`, y que no contenga expresiones `new`. | El enrutador es 100% puro en transporte, exporta exclusivamente la interfaz `PhraseRoutesOptions` y la función fábrica `createPhraseRoutes`, sin exportación de router singleton por defecto. | [x] | Verificado en `phraseRoutes.ts`; cero expresiones `new` y cero imports de DB. |
| **CA-02** | CLI / Código | Inspeccionar `backend/src/app.ts` y evaluar la función fábrica `createApp(options?: AppOptions)`. | `createApp` actúa como Composition Root centralizado, ensamblando por defecto la cadena de dependencias (`PhraseRepository(db)`, `HuggingFaceEmbeddingProvider`, `InMemoryEmbeddingCache` con `lru-cache`, `PhraseService`, `PhraseController`) reutilizando el singleton `db`. | [x] | Verificado en `src/app.ts`. |
| **CA-03** | CLI / Código | Inspeccionar las exportaciones públicas de `backend/src/app.ts`. | Exporta exclusivamente `AppOptions` y `createApp`, habiendo suprimido la exportación ansiosa de `const app = createApp()`. | [x] | Verificado en `src/app.ts`. |
| **CA-04** | CLI / Supertest | Invocar `createApp({ phraseRepository, embeddingProvider: mockProvider, embeddingCache, disableRateLimit: true })` en `beforeEach` de `tests/integration/phrases.api.integration.test.ts`. | La aplicación opera de forma determinista usando las dependencias inyectadas sin llamadas de red a Hugging Face ni monkey-patching sobre módulos ESM. | [x] | Verificado en `tests/integration/phrases.api.integration.test.ts`. |
| **CA-05** | CLI / Código | Inspeccionar `backend/src/index.ts` y verificar la inicialización del servidor HTTP. | Arranca el servidor invocando `createApp()` sin argumentos y escucha en `env.PORT` con dependencias productivas resueltas limpiamente. | [x] | Verificado en `src/index.ts`. |
| **CA-06** | CLI / Supertest | Ejecutar pruebas sobre todos los endpoints existentes (`POST /api/phrases/validate`, `POST /api/phrases`, `GET /api/phrases`, `GET /api/health`). | Todos los contratos de respuesta JSON en `camelCase`, códigos HTTP (`200`, `201`, `400`, `409`, `415`, `429`, `500`, `503`) y exclusión de vectores `embedding` se mantienen intactos. | [x] | Verificado en `tests/integration/phrases.api.integration.test.ts` (20/20 tests en verde). |
| **CA-07** | CLI / Vitest | Ejecutar la suite completa de pruebas del backend (`npm --prefix backend run test:all`). | Las 66 pruebas (unitarias, repositorios y de integración con `supertest`) continúan pasando con 100% de éxito. | [x] | Verificado: 66/66 pruebas pasando con éxito en Vitest. |
| **CA-08** | CLI / Linters | Ejecutar `npm --prefix backend run build` (o `tsc --noEmit`) y `python scripts/check_constitution.py`. | Compilación TypeScript limpia bajo `"strict": true`, cero tipos `any`, cero `console.log` en código productivo y cero secretos hardcodeados. | [x] | Verificado con `tsc --noEmit` y `check_constitution.py`. |

---

## Pruebas de Casos Extremos (Edge Cases)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| **CE-1** | CLI / Supertest | Invocar `createApp({ embeddingProvider: mockProvider })` omitiendo `phraseRepository` y `embeddingCache`. | `createApp` utiliza el mock suministrado y resuelve de forma transparente el repositorio y la caché con sus implementaciones por defecto sin errores. | [x] | Verificado en suites de pruebas de integración. |
| **CE-2** | CLI / Supertest | Invocar `createApp({ disableRateLimit: true })` y enviar una ráfaga rápida de más de 35 peticiones a `POST /api/phrases/validate`. | Ninguna petición es bloqueada por rate limiting (todas responden sin disparar HTTP `429 Too Many Requests`). | [x] | Verificado en `tests/integration/phrases.api.integration.test.ts`. |
| **CE-3** | CLI / Integration | Invocar múltiples veces `createApp()` en distintas suites de prueba y verificar las conexiones de PostgreSQL subyacentes. | Todas las instancias reutilizan el pool singleton compartido `db` exportado de `src/db/index.ts` sin crear conexiones duplicadas ni agotar el pool de PostgreSQL. | [x] | Verificado en `database.integration.test.ts` y `phraseRepository.integration.test.ts`. |
| **CE-4** | CLI / Integration | Invocar `createApp()` sin pasar argumentos en un entorno con variables de entorno productivas válidas. | La aplicación Express se inicializa correctamente y el enrutador `/api/phrases` queda montado con las dependencias productivas sin excepciones de arranque. | [x] | Verificado en `app.ts` e `index.ts`. |
| **CE-5** | CLI / Supertest | Enviar peticiones HTTP concurrentes contra la misma instancia de `app` devuelta por `createApp()`. | Los servicios y controladores operan de forma estrictamente libre de estado mutable (*stateless*), procesando cada petición sin interferencia ni colisión de estado entre solicitudes. | [x] | Verificado en tests concurrentes con Supertest. |
