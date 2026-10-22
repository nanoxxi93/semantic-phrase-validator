# 002.1-app-composition-root: Centralización del Composition Root en Express Core (app.ts) y Pureza de Rutas

## Resumen
Esta especificación define la refactorización arquitectónica del ensamblaje de dependencias (*Composition Root*) del backend para centralizar la instanciación de la cadena de componentes (`PhraseRepository`, `HuggingFaceEmbeddingProvider`, `InMemoryEmbeddingCache` con `lru-cache`, `PhraseService`, `PhraseController`) directamente dentro de la función fábrica `createApp(options?: AppOptions)` en `src/app.ts`. El objetivo es erradicar la instanciación impropia de dependencias en el ámbito superior (*top-level scope*) de `src/routes/phraseRoutes.ts`, purificando el enrutador como un módulo exclusivo de transporte HTTP sin sobrecargar el proyecto con contenedores de inyección adicionales, adoptando una arquitectura pragmática, desacoplada y de alta testeabilidad adaptada a los requisitos del desafío técnico.

## Casos de usuario
- **CU-1**: Como Desarrollador de Backend, quiero que el enrutador `phraseRoutes.ts` sea 100% puro en la capa de transporte HTTP, recibiendo su controlador y limitadores de tasa vía inyección de dependencias en la función fábrica `createPhraseRoutes(options: PhraseRoutesOptions): Router`, sin importar ni instanciar base de datos, repositorios ni servicios de IA externos.
- **CU-2**: Como Desarrollador de la Plataforma, quiero que `src/app.ts` actúe como el Composition Root central del backend dentro de `createApp(options?: AppOptions)`, ensamblando de forma concisa y directa las dependencias productivas por defecto y permitiendo inyectar dependencias simuladas para pruebas, sin exportar instancias singleton globales en tiempo de importación.
- **CU-3**: Como Ingeniero de Pruebas (QA / Testing), quiero poder invocar `app = createApp({ phraseRepository: repository, embeddingProvider: mockProvider, embeddingCache: cache, disableRateLimit: true })` en `tests/integration/phrases.api.integration.test.ts` para ejecutar suites de integración completas con `supertest` de forma directa, sin ensamblaje manual repetitivo ni efectos colaterales entre tests.

## Criterios de aceptación
- [x] **CA-01 (Pureza de la Capa de Transporte en `phraseRoutes.ts`)**: `src/routes/phraseRoutes.ts` no contiene importaciones de `src/db/`, `PhraseRepository`, `PhraseService`, `HuggingFaceEmbeddingProvider` ni `InMemoryEmbeddingCache`, ni sentencias `new`. Expone la interfaz `PhraseRoutesOptions` y la función fábrica `createPhraseRoutes(options: PhraseRoutesOptions): Router`, absteniéndose de exportar instancias de router singleton por defecto.
- [x] **CA-02 (Composition Root en `createApp` de `src/app.ts`)**: `src/app.ts` define la interfaz `AppOptions` y la función fábrica `createApp(options?: AppOptions): express.Express`, centralizando el ensamblaje de `PhraseRepository`, `HuggingFaceEmbeddingProvider`, `InMemoryEmbeddingCache` (basado en `lru-cache`), `PhraseService` y `PhraseController` con resolución de instancias por defecto reutilizando el singleton compartido de base de datos `db`.
- [x] **CA-03 (Eliminación de Singleton Eager en `app.ts`)**: `src/app.ts` exporta exclusivamente la interfaz `AppOptions` y la función `createApp`, suprimiendo cualquier exportación ansiosa de `const app = createApp()`, garantizando que la importación de `app.ts` en archivos de pruebas no dispare instanciaciones productivas prematuras.
- [x] **CA-04 (Capacidad de Inyección y Sobrescritura para Tests)**: `AppOptions` permite sobrescribir de forma opcional `embeddingProvider`, `embeddingCache`, `phraseRepository`, `similarityThreshold` y `disableRateLimit`, permitiendo que las pruebas de integración inyecten mocks deterministas sin recurrir a monkey-patching sobre módulos ESM.
- [x] **CA-05 (Punto de Entrada Minimalista en `src/index.ts`)**: `src/index.ts` inicializa la aplicación llamando a `createApp()` (sin argumentos) y arranca el servidor HTTP escuchando en `env.PORT`.
- [x] **CA-06 (Integridad Funcional y de Contratos de la API)**: Todos los endpoints existentes (`POST /api/phrases/validate`, `POST /api/phrases`, `GET /api/phrases`, `GET /api/health`) mantienen al 100% sus contratos JSON en `camelCase`, códigos HTTP (`200`, `201`, `400`, `409`, `415`, `429`, `500`, `503`) y exclusión de vectores `embedding` en listados públicos.
- [x] **CA-07 (Verificación Automatizada Completa)**: La suite completa de 66 pruebas (unitarias, repositorios y de integración con `supertest`) continúa ejecutándose con 100% de éxito (`npm test`).
- [x] **CA-08 (Cumplimiento Constitucional Estricto)**: Compilación TypeScript `"strict": true` sin tipos `any`, cero `console.log` en código productivo y cero secretos hardcodeados, validado mediante `check_constitution.py`.

## Requisitos funcionales
- **RF-1 (Desacoplamiento Estricto de `phraseRoutes.ts`)**:
  - `src/routes/phraseRoutes.ts` debe operar estrictamente como capa de transporte HTTP.
  - Se prohíbe la instanciación de clases de acceso a datos (`PhraseRepository`), proveedores externos (`HuggingFaceEmbeddingProvider`), caché (`InMemoryEmbeddingCache`) o servicios de dominio (`PhraseService`) dentro del enrutador.
  - La interfaz de opciones del router debe declararse explícitamente:
    ```typescript
    export interface PhraseRoutesOptions {
      phraseController: PhraseController;
      inferenceLimiter: RequestHandler;
      readLimiter: RequestHandler;
    }
    ```
  - La función fábrica `createPhraseRoutes(options: PhraseRoutesOptions): Router` mapea exclusivamente los endpoints:
    - `POST /validate` con `contentTypeValidator`, `options.inferenceLimiter` y `options.phraseController.validate`.
    - `POST /` con `contentTypeValidator`, `options.inferenceLimiter` y `options.phraseController.create`.
    - `GET /` con `options.readLimiter` y `options.phraseController.list`.
- **RF-2 (Composition Root Centralizado en `src/app.ts`)**:
  - `src/app.ts` define la interfaz de opciones de configuración e inyección:
    ```typescript
    export interface AppOptions {
      embeddingProvider?: EmbeddingProvider;
      embeddingCache?: EmbeddingCache;
      phraseRepository?: PhraseRepositoryInterface;
      similarityThreshold?: number;
      disableRateLimit?: boolean;
    }
    ```
  - La función `createApp(options?: AppOptions): express.Express` realiza:
    1. Configuración de `trust proxy` para Fly.io (`env.TRUST_PROXY`).
    2. Cabeceras de seguridad HTTP mediante `helmet()`.
    3. Configuración CORS con lista blanca de orígenes (`env.CORS_ORIGINS`).
    4. Parser estricto JSON con límite de 10kb contra denegación de servicio.
    5. Montaje de la sonda ultraligera `GET /api/health` con `healthController`.
    6. Configuración de rate limiters utilizando las factorías existentes:
       - `createInferenceLimiter({ disabled: options?.disableRateLimit })`
       - `createReadLimiter({ disabled: options?.disableRateLimit })`
    7. Ensamblaje de dependencias de dominio con fallbacks a instancias por defecto:
       - Repositorio: `options?.phraseRepository ?? new PhraseRepository(db)` (consumiendo la conexión singleton de `src/db/index.ts`).
       - Proveedor de IA: `options?.embeddingProvider ?? new HuggingFaceEmbeddingProvider(env.HF_TOKEN, env.HF_MODEL)`.
       - Caché de embeddings: `options?.embeddingCache ?? new InMemoryEmbeddingCache({ maxCapacity: 1000, defaultTtlSeconds: env.EMBEDDING_CACHE_TTL_SECONDS })` basado en `lru-cache`.
       - Umbral de similitud: `options?.similarityThreshold ?? env.SIMILARITY_THRESHOLD`.
       - Servicio de dominio: `new PhraseService({ embeddingProvider, phraseRepository, embeddingCache, threshold })`.
       - Controlador HTTP: `new PhraseController(phraseService)`.
    8. Creación del enrutador modular mediante `createPhraseRoutes({ phraseController, inferenceLimiter, readLimiter })` y montaje en `app.use('/api/phrases', phraseRoutes)`.
    9. Middleware centralizado de manejo de errores `errorHandler`.
- **RF-3 (Punto de Entrada en `src/index.ts`)**:
  - `src/index.ts` importa `createApp` e inicializa el servidor llamando a `createApp()` sin argumentos, escuchando en el puerto configurado (`env.PORT`).

## Requisitos no funcionales
- **RNF-1 (Separación de Capas e Inversión de Dependencias)**:
  - Cumplimiento de la Sección 1.1 y 1.2 de `specs/constitution.md`.
  - La capa de transporte (`phraseRoutes.ts`) no importa capas de datos ni de infraestructura.
- **RNF-2 (Pragmatismo y Mantenibilidad del Código)**:
  - Mantener una arquitectura concisa y directa, sin sobrecarga de archivos contenedores de indirección innecesarios para el tamaño actual de la aplicación.
- **RNF-3 (Rendimiento en Tiempo de Ejecución)**:
  - La instanciación en `createApp` se ejecuta una única vez durante el arranque del proceso, con costo \(O(1)\) por petición HTTP subsiguiente.
- **RNF-4 (Aislamiento y Velocidad en Tests de Integración)**:
  - Las suites de pruebas automatizadas con `supertest` invocan directamente `createApp({ embeddingProvider: new MockEmbeddingProvider(), disableRateLimit: true })` ejecutándose de forma determinista y sin consumo de cuota de red ni código repetitivo de cableado en cada test.
- **RNF-5 (Tipado Estricto sin `any`)**:
  - Compilación obligatoria bajo `"strict": true` con tipado estático completo.

## Casos extremos
- **CE-1 (Inyección Parcial de Mocks en Tests)**: Si en un test de integración se suministra únicamente `{ embeddingProvider: mockProvider }`, `createApp` utiliza dicho mock y resuelve el resto de dependencias (`PhraseRepository`, `InMemoryEmbeddingCache`, etc.) con sus instancias por defecto sin fallos de dependencias incompletas.
- **CE-2 (Desactivación Segura de Rate Limiting en Tests)**: Cuando se pasa `disableRateLimit: true` a `createApp`, los limitadores de inferencia y lectura devuelven de forma segura un middleware passthrough (`next()`), evitando que peticiones concurrentes en tests disparen falsos positivos HTTP `429 Too Many Requests`.
- **CE-3 (Prevención de Múltiples Pools de Conexión a Base de Datos)**: Múltiples llamadas a `createApp()` (por ejemplo en distintas suites de prueba) comparten la misma conexión singleton `db` exportada de `src/db/index.ts`, previniendo fugas de conexiones en PostgreSQL.
- **CE-4 (Arranque por Defecto sin Parámetros en Producción)**: Al invocar `createApp()` sin argumentos en `src/index.ts`, el sistema ensambla automáticamente todas las dependencias productivas (`HuggingFaceEmbeddingProvider`, `PhraseRepository`, `InMemoryEmbeddingCache` con `lru-cache`, rate limiters activos) sin errores en tiempo de ejecución.
- **CE-5 (Concurrencia de Peticiones y Estado Inmutable)**: Las instancias de `PhraseService` y `PhraseController` creadas por `createApp` son estrictamente libres de estado mutable (*stateless*) respecto a las peticiones HTTP, garantizando seguridad y determinismo ante solicitudes concurrentes.

## Changelog de la Especificación
- **2026-10-21 (Creación inicial)**: Especificación formal para la refactorización arquitectónica intermedia `002.1-app-composition-root`, centralizando el Composition Root en `createApp()` de `src/app.ts` y asegurando la pureza de la capa de transporte en `src/routes/phraseRoutes.ts`.
- **2026-10-21 (Refinamiento y Clarificación - Skill clarify)**:
  - Estandarización de la función fábrica `createPhraseRoutes(options: PhraseRoutesOptions): Router` en `src/routes/phraseRoutes.ts`.
  - Eliminación de la exportación de instancia ansiosa (`export const app = createApp()`) en `src/app.ts` para evitar efectos colaterales durante la importación de tests.
  - Adopción explícita de `createInferenceLimiter({ disabled })` y `createReadLimiter({ disabled })` para el bypass determinista de rate limiting en tests.
  - Simplificación del setup de integración en `tests/integration/phrases.api.integration.test.ts` delegando el ensamblaje directamente en `createApp(options)`.
