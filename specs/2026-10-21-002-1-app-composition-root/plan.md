# Plan de Implementación Técnico: 002.1-app-composition-root

## Información general sobre la arquitectura

Esta funcionalidad intermedia refactoriza la inicialización y el ensamblaje de dependencias (*Composition Root*) del backend de **Semantic Phrase Validator**, centralizando la instanciación en la función fábrica `createApp(options?: AppOptions)` de `src/app.ts` y purificando la capa de transporte en `src/routes/phraseRoutes.ts`.

La arquitectura adopta un enfoque pragmático y de alta cohesión: en lugar de introducir contenedores de indirección adicionales, `src/app.ts` asume formalmente la responsabilidad de Composition Root de la aplicación. Al mismo tiempo, `src/routes/phraseRoutes.ts` se convierte en un enrutador 100% puro que recibe sus dependencias vía inyección y desconoce por completo la base de datos, repositorios o servicios externos de IA.

### Diagrama de Ensamblaje y Flujo de Dependencias

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        PUNTO DE ENTRADA HTTP                           │
│                                                                        │
│   src/index.ts                                                         │
│   └── const app = createApp() ──► Arranca servidor en env.PORT         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Invocación productiva sin argumentos
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  COMPOSITION ROOT CENTRALIZADO                         │
│                                                                        │
│   src/app.ts: createApp(options?: AppOptions)                          │
│   ├── 1. Middlewares transversales (trust proxy, helmet, cors, json)   │
│   ├── 2. GET /api/health ──► healthController                          │
│   ├── 3. Limitadores de tasa:                                          │
│   │   ├── createInferenceLimiter({ disabled: options?.disableRateLimit})│
│   │   └── createReadLimiter({ disabled: options?.disableRateLimit })   │
│   ├── 4. Ensamblaje de dependencias (con fallbacks a singletons):      │
│   │   ├── repository: options?.phraseRepository ?? new PhraseRepository(db) │
│   │   ├── provider: options?.embeddingProvider ?? new HuggingFace...   │
│   │   ├── cache: options?.embeddingCache ?? new InMemoryEmbeddingCache │
│   │   ├── service: new PhraseService({ repository, provider, cache })  │
│   │   └── controller: new PhraseController(service)                    │
│   ├── 5. Inyección en transporte:                                      │
│   │   └── const phraseRoutes = createPhraseRoutes({                    │
│   │         phraseController: controller,                              │
│   │         inferenceLimiter,                                          │
│   │         readLimiter,                                               │
│   │       })                                                           │
│   ├── 6. Montaje: app.use('/api/phrases', phraseRoutes)                │
│   └── 7. Middleware centralizado: app.use(errorHandler)                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Inyecta controller + limiters
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  ENRUTADOR DE TRANSPORTE PURO                          │
│                                                                        │
│   src/routes/phraseRoutes.ts: createPhraseRoutes(options)              │
│   ├── POST /api/phrases/validate ──► contentTypeValidator +            │
│   │                                  inferenceLimiter +                │
│   │                                  options.phraseController.validate │
│   ├── POST /api/phrases          ──► contentTypeValidator +            │
│   │                                  inferenceLimiter +                │
│   │                                  options.phraseController.create   │
│   └── GET  /api/phrases          ──► readLimiter +                     │
│                                      options.phraseController.list     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Pila tecnológica y decisiones clave

- **Decisión 1: Centralización del Composition Root en `createApp` de `src/app.ts` sin Contenedores Adicionales**
  - **Por qué:** Mantiene el backend conciso, legible y directo. Para el tamaño y alcance actual del reto técnico, encapsular el ensamblaje en `createApp` evita la sobrecarga conceptual y de mantenimiento de clases contenedoras adicionales (`PhraseContainer`), centralizando en un único lugar visible cómo se conectan los middlewares, la base de datos, la caché y los servicios de dominio.
  - **Alternativas consideradas:**
    - *Contenedor modular por dominio (`PhraseContainer`):* Descartado por el usuario por representar un exceso de código de instanciación para el alcance del desafío técnico.
    - *Ensamblaje en `phraseRoutes.ts`:* Descartado taxativamente porque viola la pureza de la capa de transporte, acoplando el router a la infraestructura y bases de datos.
  - **Requisitos cubiertos:** CA-02, RF-2, RNF-1, RNF-2.

- **Decisión 2: Pureza Total en `src/routes/phraseRoutes.ts` con la Factoría `createPhraseRoutes`**
  - **Por qué:** El enrutador debe ser exclusivamente una declaración de rutas y enlace de middlewares HTTP. Al recibir `PhraseRoutesOptions` (`{ phraseController, inferenceLimiter, readLimiter }`), `phraseRoutes.ts` elimina por completo las sentencias `new`, no importa la base de datos `db` ni los proveedores de IA, y elimina cualquier exportación por defecto de singletons. Esto garantiza estricta cohesión y separación de capas conforme a la Sección 1.1 de la Constitución.
  - **Alternativas consideradas:**
    - *Exportar router pre-instanciado:* Descartada porque fuerza la inicialización de infraestructura en tiempo de importación de módulo y dificulta el aislamiento en tests.
  - **Requisitos cubiertos:** CA-01, RF-1, RNF-1, RNF-5.

- **Decisión 3: Supresión de la Exportación de Instancia Singleton (`export const app = createApp()`) en `app.ts`**
  - **Por qué:** Exportar una constante `app = createApp()` en el ámbito superior de `src/app.ts` genera una inicialización ansiosa (*eager execution*) cada vez que cualquier archivo (como las suites de pruebas unitarias o de integración) importa `app.ts`. Al suprimir esta exportación, `createApp` se convierte en la única interfaz pública de `src/app.ts`, delegando la creación de la instancia de producción exclusivamente a `src/index.ts`.
  - **Alternativas consideradas:**
    - *Mantener `export const app = createApp()`:* Descartada porque dispara la conexión con dependencias de producción en tests que solo necesitan importar la factoría `createApp`.
  - **Requisitos cubiertos:** CA-03, CA-05, RF-2, RF-3, RNF-4.

- **Decisión 4: Gestión de Rate Limiting mediante Factorías Parametrizadas (`createInferenceLimiter` / `createReadLimiter`)**
  - **Por qué:** [`src/middlewares/rateLimiter.ts`](file:///c:/Workspaces/nanoxxi93/semantic-phrase-validator/backend/src/middlewares/rateLimiter.ts) ya dispone de `createInferenceLimiter({ disabled: boolean })` y `createReadLimiter({ disabled: boolean })`. Conectar `options?.disableRateLimit` directamente a estas funciones permite que `createApp` desactive el limitador en tests mediante un middleware transparente `(_req, _res, next) => next()` sin alterar variables globales de entorno ni introducir lógica condicional dispersa.
  - **Alternativas consideradas:**
    - *Condicionales basados en `process.env.NODE_ENV === 'test'` dentro del middleware:* Descartada porque impide validar el comportamiento real del bloqueo 429 (CA-12 de Fase 2) en los tests que expresamente lo requieran (`disableRateLimit: false`).
  - **Requisitos cubiertos:** CA-04, RF-2, CE-2, RNF-4.

- **Decisión 5: Inyección Directa en Suites de Integración (`phrases.api.integration.test.ts`)**
  - **Por qué:** En lugar de requerir que cada prueba de integración instancie y ensamble manualmente `PhraseService`, `PhraseController` y `createPhraseRoutes`, los tests simplemente llaman a `app = createApp({ phraseRepository, embeddingProvider, embeddingCache, disableRateLimit: true })`. Esto reduce drásticamente el código repetitivo (*boilerplate*) en los tests y valida el mismo Composition Root que corre en producción.
  - **Alternativas consideradas:**
    - *Crear una función auxiliar de test específica:* Descartada por ser redundante, ya que `createApp` ya provee soporte nativo para inyección de opciones.
  - **Requisitos cubiertos:** CU-3, CA-04, RNF-4, CE-1.

---

## Secuencia de implementación

La refactorización se ejecutará en 4 etapas progresivas:

### Etapa 1: Purificación de la Capa de Transporte en `src/routes/phraseRoutes.ts`
1. Modificar `backend/src/routes/phraseRoutes.ts` para eliminar:
   - Importaciones de `src/db/`, `PhraseRepository`, `PhraseService`, `HuggingFaceEmbeddingProvider`, `InMemoryEmbeddingCache`, `env`.
   - Instanciación de singletons top-level (`phraseRepository`, `embeddingProvider`, `embeddingCache`, `phraseService`, `phraseController`).
   - Exportación por defecto (`export default defaultRouter`).
2. Declarar la interfaz y función fábrica:
   ```typescript
   export interface PhraseRoutesOptions {
     phraseController: PhraseController;
     inferenceLimiter: RequestHandler;
     readLimiter: RequestHandler;
   }

   export function createPhraseRoutes(options: PhraseRoutesOptions): Router {
     const router = Router();
     const { phraseController, inferenceLimiter, readLimiter } = options;

     router.post('/validate', contentTypeValidator, inferenceLimiter, phraseController.validate);
     router.post('/', contentTypeValidator, inferenceLimiter, phraseController.create);
     router.get('/', readLimiter, phraseController.list);

     return router;
   }
   ```

### Etapa 2: Centralización del Composition Root en `src/app.ts` y Ajuste en `src/index.ts`
1. Modificar `backend/src/app.ts`:
   - Importar `PhraseRepository`, `HuggingFaceEmbeddingProvider`, `InMemoryEmbeddingCache`, `PhraseService`, `PhraseController`, `db`, `env`.
   - Importar `createInferenceLimiter`, `createReadLimiter` de `src/middlewares/rateLimiter.ts`.
   - Importar `createPhraseRoutes` de `src/routes/phraseRoutes.ts`.
   - Declarar `AppOptions`:
     ```typescript
     export interface AppOptions {
       embeddingProvider?: EmbeddingProvider;
       embeddingCache?: EmbeddingCache;
       phraseRepository?: PhraseRepositoryInterface;
       similarityThreshold?: number;
       disableRateLimit?: boolean;
     }
     ```
   - Implementar el ensamblaje en `createApp(options?: AppOptions): express.Express`:
     - Rate limiters: `createInferenceLimiter({ disabled: options?.disableRateLimit })` y `createReadLimiter({ disabled: options?.disableRateLimit })`.
     - Dependencias: fallbacks a `new PhraseRepository(db)`, `new HuggingFaceEmbeddingProvider(...)`, `new InMemoryEmbeddingCache(...)`.
     - Ensamblaje: `new PhraseService(...)` y `new PhraseController(...)`.
     - Rutas: `createPhraseRoutes({ phraseController, inferenceLimiter, readLimiter })`.
     - Montaje en `/api/phrases`.
   - Suprimir la línea `export const app = createApp();`.
2. Modificar `backend/src/index.ts`:
   - Asegurar que cree la instancia explícita: `const app = createApp();` y levante el listener en `env.PORT`.

### Etapa 3: Refactorización de la Suite de Integración (`phrases.api.integration.test.ts`)
1. Actualizar `backend/tests/integration/phrases.api.integration.test.ts`:
   - Limpiar importaciones redundantes (`PhraseService`, `createPhraseRouter`, etc.).
   - En `beforeEach`, simplificar la inicialización:
     ```typescript
     app = createApp({
       phraseRepository: repository,
       embeddingProvider: mockProvider,
       embeddingCache: cache,
       similarityThreshold: 0.80,
       disableRateLimit: true,
     });
     ```
   - En la prueba de rate limiting (CA-12, CE-8):
     ```typescript
     const rateLimitedApp = createApp({
       phraseRepository: repository,
       embeddingProvider: mockProvider,
       embeddingCache: cache,
       similarityThreshold: 0.80,
       disableRateLimit: false,
     });
     ```

### Etapa 4: Verificación Integral, Tipos y Auditoría Constitucional
1. Ejecutar verificación de tipos: `npm --prefix backend run build` (o `tsc --noEmit`).
2. Ejecutar la suite completa de pruebas: `npm --prefix backend run test:all` (verificando 100% de éxito en 66+ pruebas).
3. Ejecutar `python scripts/check_constitution.py` y `python scripts/validate_sdd.py`.

---

## Comprobación de la Constitución

A continuación se audita el diseño contra cada directiva de [`specs/constitution.md`](file:///c:/Workspaces/nanoxxi93/semantic-phrase-validator/specs/constitution.md):

| Principio Constitucional | Estado | Evidencia en este Plan |
|---|---|---|
| **1.1 Separación Estricta por Capas** | CUMPLE | `phraseRoutes.ts` pertenece exclusivamente a la capa de transporte; no importa base de datos ni servicios de dominio. El ensamblaje de infraestructura vive en el Composition Root (`createApp` en `src/app.ts`). |
| **1.2 Inversión de Dependencias en IA** | CUMPLE | `PhraseService` recibe la abstracción `EmbeddingProvider`. `createApp` permite inyectar `MockEmbeddingProvider` determinista en las suites de integración sin llamadas de red a Hugging Face. |
| **2.1 Validación de Contratos con Zod** | CUMPLE | Los esquemas Zod en `src/controllers/phrase.schemas.ts` se mantienen intactos; las rutas puras canalizan el tráfico a través de los mismos controladores. |
| **2.2 Estructura JSON Estandarizada** | CUMPLE | Todas las respuestas preservan `{ success: true, data }` y `{ success: false, error }` sin alteraciones. |
| **2.3 Códigos HTTP Obligatorios** | CUMPLE | Se preservan todos los códigos: `200`, `201`, `400`, `409`, `415`, `429`, `500`, `503`. |
| **3.1 Variables de Entorno Estrictas** | CUMPLE | Cero secretos en código; configuración centralizada en `src/config/env.ts`. |
| **3.2 Minimización de Datos y Privacidad** | CUMPLE | La API sigue omitiendo los vectores `embedding` en consultas públicas. |
| **4.1 TDD y Cobertura Automatizada** | CUMPLE | Todas las pruebas de integración con `supertest` y Vitest se mantienen en verde (66+ tests). |
| **4.2 Convención Lingüística y Nomenclatura** | CUMPLE | Código en inglés (`createPhraseRoutes`, `PhraseRoutesOptions`, `createApp`); especificaciones y documentación en español. Commits semánticos convencionales. |
| **4.3 Calidad de Código en Producción** | CUMPLE | Compilación TypeScript `"strict": true` sin tipos `any`. Cero `console.log` en código productivo, verificado por `check_constitution.py`. |

---

## Suposiciones y preguntas abiertas

### Suposiciones:
1. **Singleton Compartido de PostgreSQL:** Se asume que todas las llamadas a `createApp` consumen la misma instancia del cliente/pool `db` exportada de `src/db/index.ts`, evitando abrir múltiples pools de base de datos en tests o producción.
2. **Statelessness de Servicios y Controladores:** Se asume que `PhraseService` y `PhraseController` son libres de estado mutable (*stateless*) respecto a las solicitudes HTTP, garantizando seguridad y determinismo ante peticiones concurrentes (CE-5).
3. **Eliminación de la Instancia Eager `app`:** Se asume que ningún archivo del proyecto depende de la exportación `export const app = createApp()` en `src/app.ts`, ya que `src/index.ts` inicializa su propia instancia y los tests llaman a `createApp(options)`.

### Preguntas Abiertas:
- *Ninguna pregunta abierta pendiente.* Las decisiones de diseño, nomenclatura (`createPhraseRoutes`), supresión del singleton ansioso y parametrización de rate limiting fueron plenamente acordadas durante la etapa de clarificación.
