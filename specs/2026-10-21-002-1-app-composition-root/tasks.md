# Lista de Tareas: 002.1-app-composition-root

## Fase 1: Purificación de la Capa de Transporte en `phraseRoutes.ts`
- [ ] 1.1 Eliminar las importaciones de infraestructura y dominio (`src/db/`, `PhraseRepository`, `PhraseService`, `HuggingFaceEmbeddingProvider`, `InMemoryEmbeddingCache`, `env`) y la instanciación de singletons top-level en `backend/src/routes/phraseRoutes.ts` (RF-1, CA-01).
- [ ] 1.2 Definir y exportar la interfaz `PhraseRoutesOptions` (`phraseController: PhraseController`, `inferenceLimiter: RequestHandler`, `readLimiter: RequestHandler`) en `backend/src/routes/phraseRoutes.ts` (RF-1, CA-01).
- [ ] 1.3 Implementar la función fábrica pura `createPhraseRoutes(options: PhraseRoutesOptions): Router` mapeando exclusivamente los endpoints (`POST /validate`, `POST /`, `GET /`) hacia `options.phraseController` aplicando los middlewares correspondientes y eliminando cualquier exportación por defecto de instancias (`export default defaultRouter`) (RF-1, CA-01).

## Fase 2: Centralización del Composition Root en `createApp` de `src/app.ts` y Ajuste en `src/index.ts`
- [ ] 2.1 Actualizar `backend/src/app.ts` para importar las dependencias concretas (`PhraseRepository`, `HuggingFaceEmbeddingProvider`, `InMemoryEmbeddingCache`, `PhraseService`, `PhraseController`, `db`, `env`), las factorías de rate limit (`createInferenceLimiter`, `createReadLimiter`) y la factoría pura de rutas (`createPhraseRoutes`) (RF-2, CA-02).
- [ ] 2.2 Declarar la interfaz `AppOptions` (`embeddingProvider?`, `embeddingCache?`, `phraseRepository?`, `similarityThreshold?`, `disableRateLimit?`) e implementar el ensamblaje de la cadena de dependencias con fallbacks a instancias por defecto dentro de `createApp(options?: AppOptions): express.Express` (RF-2, CA-02, CA-04, CE-1, CE-2, CE-3).
- [ ] 2.3 Suprimir la exportación ansiosa `export const app = createApp()` en `backend/src/app.ts`, dejando a `createApp` como la única exportación pública del módulo para evitar efectos colaterales durante la importación en tests (RF-2, CA-03).
- [ ] 2.4 Verificar que `backend/src/index.ts` cree explícitamente `const app = createApp()` y arranque el servidor HTTP escuchando en `env.PORT` con dependencias productivas resueltas automáticamente (RF-3, CA-05, CE-4).

## Fase 3: Refactorización y Simplificación de la Suite de Integración (`phrases.api.integration.test.ts`)
- [ ] 3.1 Actualizar `backend/tests/integration/phrases.api.integration.test.ts` eliminando el cableado manual repetitivo de `PhraseService`, `PhraseController` y `createPhraseRouter`, e inicializar `app` directamente mediante `createApp({ phraseRepository: repository, embeddingProvider: mockProvider, embeddingCache: cache, similarityThreshold: 0.80, disableRateLimit: true })` en `beforeEach` (CA-04, CA-06).
- [ ] 3.2 Actualizar el caso de prueba de rate limiting en `backend/tests/integration/phrases.api.integration.test.ts` instanciando la aplicación mediante `createApp({ phraseRepository: repository, embeddingProvider: mockProvider, embeddingCache: cache, similarityThreshold: 0.80, disableRateLimit: false })` para validar el bloqueo HTTP `429 Too Many Requests` (CA-04, CA-06).

## Fase 4: Verificación Integral, Calidad y Cumplimiento Constitucional
- [ ] 4.1 Ejecutar verificación estricta de tipos con TypeScript (`npm --prefix backend run build` o `tsc --noEmit`), asegurando cero errores y compilación `"strict": true` sin tipos `any` (CA-08, RNF-5).
- [ ] 4.2 Ejecutar la suite completa de pruebas unitarias, de integración y de repositorios (`npm --prefix backend run test:all`), verificando 100% de éxito en todos los tests (CA-07).
- [ ] 4.3 Ejecutar auditoría automatizada constitucional (`python scripts/check_constitution.py`) y validación de especificaciones SDD (`python scripts/validate_sdd.py`) (CA-08).
