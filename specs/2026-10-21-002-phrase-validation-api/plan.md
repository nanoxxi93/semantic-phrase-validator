# Plan de Implementación Técnico: 002-phrase-validation-api

## Información general sobre la arquitectura
Esta funcionalidad construye la API REST y la lógica de negocio completa para el sistema **Semantic Phrase Validator**, correspondiente a la Fase 2 del roadmap. Provee los endpoints HTTP necesarios para validar y persistir oraciones cortas, consultar el catálogo paginado y exponer sondas de salud para orquestación en contenedores. 

La arquitectura adopta un desacoplamiento estricto por capas unidireccional: la capa de transporte (Express + Middlewares + Controllers) delega exclusivamente en la capa de servicios de dominio (`PhraseService`), la cual interactúa con la persistencia (`PhraseRepository`), la memoria intermedia (`InMemoryEmbeddingCache` con desalojo LRU) y la inferencia externa (`EmbeddingProvider`), cumpliendo rigurosamente los principios de inversión de dependencias y separación de responsabilidades.

### Diagrama de Arquitectura y Flujo de Datos

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CAPA DE TRANSPORTE HTTP                                │
│                                                                                        │
│   Cliente HTTP (Frontend / Postman / Sonda Fly.io)                                     │
│         │                                                                              │
│         ▼                                                                              │
│   Middlewares Globales:                                                                │
│   ├── app.set('trust proxy', 1) ──► Desempaqueta X-Forwarded-For para Fly.io           │
│   ├── helmet()                  ──► Cabeceras de seguridad HTTP                        │
│   ├── cors({ origin: CORS_ORIGINS })                                                   │
│   ├── express.json({ limit: '10kb' })                                                  │
│   └── rateLimiters:                                                                    │
│       ├── readLimiter (100 req/min)      ──► GET /api/phrases                          │
│       └── inferenceLimiter (30 req/min)  ──► POST /api/phrases/validate, POST /phrases │
│                                                                                        │
│   Controladores & Validación de Esquemas:                                              │
│   ├── healthController     ──► GET /api/health (exento de rate limiter)                │
│   ├── phraseController.validate ──► Zod: { text: z.string().trim().min(1).max(280) }   │
│   ├── phraseController.create   ──► Zod: { text, confirmDuplicate?: boolean }          │
│   └── phraseController.list     ──► Zod: { page?, limit?, status? }                    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ DTOs saneados (camelCase)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              CAPA DE DOMINIO Y NEGOCIO                                 │
│                                                                                        │
│   PhraseService                                                                        │
│   ├── validatePhrase(text):                                                            │
│   │   1. Cortocircuito Exacto: PhraseRepository.findByExactText(LOWER(text))           │
│   │      └─► Si existe: score 1.0000, isDuplicate: true (0 llamadas de red)            │
│   │   2. Caché LRU: EmbeddingCache.get(text) ──► Si miss: EmbeddingProvider.generate │
│   │   3. Comparación Coseno: calculateCosineSimilarity() contra catálogo               │
│   │   4. Retorna { isDuplicate, similarityScore, threshold, similarPhrase }            │
│   ├── createPhrase(text, confirmDuplicate):                                            │
│   │   1. Evalúa duplicidad; si isDuplicate && !confirmDuplicate ──► Error 409         │
│   │   2. Si duplicado confirmado ──► reutiliza vector persistido/caché, guarda DUPLICATE│
│   │   3. Si único ──► guarda UNIQUE con metadatos nulos                                │
│   └── listPhrases(page, limit, status):                                                │
│       └── Paginación determinista (created_at DESC, id DESC)                           │
└───────────────────────┬───────────────────────────────┬────────────────────────────────┘
                        │                               │
                        ▼                               ▼
┌───────────────────────────────────┐       ┌────────────────────────────────────────────┐
│      CAPA DE PERSISTENCIA         │       │          PROVEEDORES Y MEMORIA             │
│                                   │       │                                            │
│   PhraseRepository (Drizzle ORM)  │       │   EmbeddingCache (Interfaz)                │
│   ├── findByExactText()           │       │   └── InMemoryEmbeddingCache (LRU 1000)    │
│   ├── getAllEmbeddings()          │       │                                            │
│   ├── findAll(page, limit, status)│       │   EmbeddingProvider (Interfaz)             │
│   ├── countAll(status)            │       │   ├── HuggingFaceEmbeddingProvider (Prod)  │
│   └── create()                    │       │   └── MockEmbeddingProvider (Tests)        │
└─────────────────┬─────────────────┘       └─────────────────────┬──────────────────────┘
                  │                                               │
                  ▼                                               ▼
      ┌───────────────────────┐                       ┌───────────────────────┐
      │   PostgreSQL 17       │                       │   Hugging Face API    │
      │ (tabla: phrases)      │                       │ (MiniLM 384 dims)     │
      └───────────────────────┘                       └───────────────────────┘
```

---

## Pila tecnológica y decisiones clave

- **Decisión 1: Unificación a 100% `camelCase` y Conversión Numérica en TypeScript con Drizzle ORM**
  - **Por qué:** Evita código espagueti de transformación manual entre `snake_case` y `camelCase`. Al mapear en `backend/src/db/schema.ts` las propiedades de TypeScript (`similarityScore`, `similarToId`, `validationStatus`, `createdAt`) hacia sus columnas SQL físicas (`similarity_score`, `similar_to_id`, etc.), Drizzle ejecuta el mapeo automáticamente en lectura y escritura. Adicionalmente, dado que los drivers de PostgreSQL (`node-postgres`) devuelven columnas `numeric` como `string` (ej. `"0.8542"`) para prevenir pérdidas de precisión en flotantes arbitrarios, `PhraseRepository` encapsula la conversión numérica determinista (`row.similarityScore !== null ? Number(row.similarityScore) : null`), garantizando que la entidad de dominio y los payloads JSON expongan siempre valores de tipo `number`.
  - **Alternativas consideradas:**
    - *Transformación manual con funciones utilitarias en controladores:* Descartada por complejidad innecesaria, riesgo de omitir campos y pérdida de inferencia estricta de tipos.
    - *Columnas camelCase en PostgreSQL con comillas dobles (`"similarityScore"`):* Descartada porque PostgreSQL trata identificadores sin comillas en minúsculas, requiriendo comillas obligatorias en cualquier script SQL manual y complicando migraciones.
  - **Requisitos cubiertos:** RNF-2 (serialización canónica en `camelCase` y valores numéricos), RNF-5 (tipado estático estricto).

- **Decisión 2: Caché Desacoplada en Memoria con Política LRU (`InMemoryEmbeddingCache`)**
  - **Por qué:** Cuando un usuario valida una frase en el frontend y luego confirma su guardado, el texto viaja dos veces en un intervalo de segundos. Guardar el vector resultante en memoria previene una segunda petición HTTP innecesaria a Hugging Face, recortando la latencia de ~1,000 ms a < 1 ms. La política LRU con capacidad máxima de 1,000 elementos previene fugas de memoria, mientras que la interfaz abstracta `EmbeddingCache` permite reemplazarla por Redis en el futuro sin modificar la lógica del servicio.
  - **Alternativas consideradas:**
    - *Pasar el vector embedding en el payload del frontend:* Descartada taxativamente por seguridad; un cliente malicioso podría falsificar el embedding o enviar vectores corruptos.
    - *Redis en esta fase:* Descartada por sobrecarga de infraestructura innecesaria para el MVP.
  - **Requisitos cubiertos:** CU-7, CA-11, RF-3, RF-6, RNF-1, RNF-6.

- **Decisión 3: Cortocircuito por Coincidencia Textual Exacta Case-Insensitive**
  - **Por qué:** Si un usuario ingresa una frase idéntica a una ya persistida, invocar la red neuronal de Hugging Face es un desperdicio de cuota y tiempo. Consultar `LOWER(text) = LOWER(?)` en base de datos es una operación de < 2 ms que permite responder inmediatamente con similitud `1.0000`. Al guardar como duplicado confirmado, se reutiliza el vector ya almacenado en base de datos con cero consumo de IA.
  - **Alternativas consideradas:**
    - *Evaluar igualdad exacta solo después de calcular el embedding:* Descartada porque gasta cuota de red de forma innecesaria.
  - **Requisitos cubiertos:** CU-6, CA-10, RF-2, RF-3, CE-2.

- **Decisión 4: Defensa en Profundidad: Rate Limiting Granular con `trust proxy` y Helmet**
  - **Por qué:** Las APIs que consumen servicios de IA de terceros son vulnerables a agotamiento de cuota por scraping o clientes en bucle. Implementar dos instancias de `express-rate-limit` (30 req/min para inferencia y 100 req/min para lectura) mitiga activamente ataques DoS. La configuración `app.set('trust proxy', config.TRUST_PROXY)` es indispensable en Fly.io para desempaquetar la IP real del cliente desde `X-Forwarded-For`, evitando que todos los usuarios compartan la misma cuota por culpa de la IP del proxy reverso.
  - **Alternativas consideradas:**
    - *Un único limitador global:* Descartado porque limitar lectura al mismo nivel de inferencia degradaría la experiencia de navegación del catálogo.
  - **Requisitos cubiertos:** CU-8, CA-12, CA-13, RF-1, RF-5, RNF-7, RNF-8, CE-8.

- **Decisión 5: Saneamiento y Validación Temprana en Esquemas Zod**
  - **Por qué:** Validar con `z.string().trim().min(1, 'Phrase cannot be empty').max(280)` asegura que peticiones maliciosas o vacías (como `{"text": "   "}`) sean rechazadas con HTTP `400 Bad Request` en el umbral del middleware de transporte, sin gastar ciclos de CPU en el servicio ni tocar la base de datos.
  - **Requisitos cubiertos:** CA-08, RF-4, CE-10.

- **Decisión 6: Paginación Determinista con Índice Compuesto `(created_at DESC, id DESC)`**
  - **Por qué:** Garantiza un orden 100% determinista sin saltos ni duplicaciones entre páginas. El soporte de un índice compuesto en PostgreSQL permite lecturas secuenciales directas del índice en disco sin incurrir en algoritmos de ordenamiento en memoria (`Sort`), manteniendo tiempos de respuesta inferiores a 10 ms.
  - **Requisitos cubiertos:** CA-06, RF-2, RNF-11.

- **Decisión 7: Sonda de Salud Ultraligera (`GET /api/health`)**
  - **Por qué:** Plataformas como Fly.io y orquestadores Docker requieren un endpoint de comprobación que responda `200 OK` en < 10 ms. Eximirlo de `inferenceLimiter` y no conectar a servicios pesados asegura que el chequeo de disponibilidad sea fiable y no dispare falsos positivos de reinicio.
  - **Requisitos cubiertos:** CU-9, CA-14, RF-4, RNF-10.

---

## Secuencia de implementación

La implementación se ejecutará en 7 etapas progresivas y testeables:

### Etapa 1: Dependencias, Scripts y Configuración de Entorno (`package.json`, `src/config/env.ts`)
1. Instalar dependencias de producción (`helmet`, `cors`, `express-rate-limit`) y desarrollo (`supertest`, `@types/cors`, `@types/supertest`) en `backend/package.json`, y registrar scripts `"dev": "tsx watch src/index.ts"` y `"start": "node dist/index.js"`.
2. Actualizar el esquema Zod de configuración en `src/config/env.ts` para incluir:
   - `PORT` (number, default 3000)
   - `SIMILARITY_THRESHOLD` (number, default 0.80)
   - `TRUST_PROXY` (number, default 1)
   - `EMBEDDING_CACHE_TTL_SECONDS` (number, default 3600)
   - `RATE_LIMIT_WINDOW_MS` (number, default 60000)
   - `RATE_LIMIT_INFERENCE_MAX` (number, default 30)
   - `RATE_LIMIT_READ_MAX` (number, default 100)
   - `CORS_ORIGINS` (string, default "http://localhost:5173,http://localhost:3000")

### Etapa 2: Mapeo CamelCase en Esquema Drizzle y Migración de Índice (`src/db/`)
1. Actualizar `src/db/schema.ts` para que las propiedades en TypeScript sean:
   - `similarityScore` mapeada a `similarity_score`
   - `similarToId` mapeada a `similar_to_id`
   - `validationStatus` mapeada a `validation_status`
   - `createdAt` mapeada a `created_at`
2. Añadir en `src/db/schema.ts` el índice compuesto `idx_phrases_created_at_id` sobre `(phrases.createdAt.desc(), phrases.id.desc())`.
3. Generar y aplicar la migración Drizzle correspondiente (`npm run db:generate`, `npm run db:migrate`).
4. Actualizar `tests/integration/database.integration.test.ts` para reflejar las propiedades TypeScript en `camelCase`.

### Etapa 3: Capa de Caché LRU de Embeddings (`src/cache/`)
1. Crear el contrato abstracto `src/cache/embeddingCache.interface.ts`:
   - `get(key: string): Promise<number[] | null> | number[] | null`
   - `set(key: string, embedding: number[], ttlSeconds?: number): Promise<void> | void`
   - `delete(key: string): Promise<void> | void`
   - `clear(): Promise<void> | void`
2. Implementar `src/cache/inMemoryEmbeddingCache.ts` utilizando una estructura `Map` con ordenamiento LRU y expiración por marcas temporales (TTL), acotada a un límite configurable de 1,000 entradas.
3. Crear suite de pruebas unitarias (`tests/unit/inMemoryEmbeddingCache.test.ts`) verificando: aciertos, fallos, expiración por TTL y desalojo LRU al sobrepasar la capacidad máxima.

### Etapa 4: Capa de Acceso a Datos `PhraseRepository` (`src/repositories/`)
1. Implementar `src/repositories/phraseRepository.ts` encapsulando queries con Drizzle ORM:
   - `create(data)`: inserta y retorna la frase mapeada en `camelCase`, convirtiendo explícitamente `similarityScore` a número (`row.similarityScore !== null ? Number(row.similarityScore) : null`).
   - `findAll({ page, limit, status })`: ejecuta consulta paginada utilizando un alias de tabla con `aliasedTable(phrases, 'similar_phrase')` para resolver limpiamente el `LEFT JOIN` auto-referencial sobre `similar_to_id`, retornando `{ id, text, validationStatus, similarityScore, similarToId, similarPhrase: { id, text } | null, createdAt }`, ordenada por `created_at DESC, id DESC`, excluyendo el vector `embedding` y casteando `similarityScore` a `number | null`.
   - `countAll(status)`: conteo total para cálculo de páginas.
   - `getAllEmbeddings()`: consulta de `id`, `text` y `embedding` de todo el catálogo para cálculo de similitud.
   - `findByExactText(normalizedText)`: consulta case-insensitive mediante `sql\`LOWER(${phrases.text}) = LOWER(${normalizedText})\``, retornando explícitamente `{ id, text, embedding }` para permitir que `PhraseService.createPhrase` reutilice el vector directamente al confirmar un duplicado exacto sin ejecutar una segunda consulta a la base de datos.
2. Definir interfaz explícita `PhraseRepositoryInterface` para facilitar mocking e inversión de dependencias en pruebas unitarias y de integración.

### Etapa 5: Capa de Servicio `PhraseService` (`src/services/`)
1. Crear clases de error de dominio en `src/errors/`:
   - `DuplicatePhraseError` (almacena `similarityScore`, `threshold`, `similarPhrase`).
2. Implementar `src/services/phraseService.ts`:
   - Constructor con inyección de dependencias (`EmbeddingProvider`, `PhraseRepository`, `EmbeddingCache`, `threshold`).
   - `validatePhrase(text)`: cortocircuito exacto -> consulta caché -> inferencia HF -> similitud coseno contra catálogo -> retorno del score y frase más cercana.
   - `createPhrase(text, confirmDuplicate)`: validación previa -> guardado de `UNIQUE` o `CONFIRMED_DUPLICATE` (reutilizando vector si fue coincidencia exacta o de caché) -> lanzamiento de `DuplicatePhraseError` si `!confirmDuplicate`.
   - `listPhrases(page, limit, status)`: cálculo de offsets y metadatos de paginación (`page, limit, total, totalPages`).
3. Pruebas unitarias de `PhraseService` con `MockEmbeddingProvider` y `InMemoryEmbeddingCache`.

### Etapa 6: Middlewares de Transporte, Seguridad y Errores (`src/middlewares/`)
1. `src/middlewares/rateLimiter.ts`: instancias de `express-rate-limit` para inferencia y lectura con retorno de error estandarizado (`429 Too Many Requests`).
2. `src/middlewares/contentTypeValidator.ts`: verificación de `Content-Type: application/json` en métodos `POST` (`415 Unsupported Media Type`).
3. `src/middlewares/errorHandler.ts`: middleware global que transforma `ZodError` (400), `DuplicatePhraseError` (409), `ExternalAIProviderError` (503), fallos de DB (500) y errores inesperados al formato canónico `{ success: false, error }`, ofuscando trazas en producción.

### Etapa 7: Controladores, Rutas y Servidor Express con Patrón Fábrica (`src/controllers/`, `src/routes/`, `src/app.ts`)
1. Implementar esquemas Zod en `src/controllers/phrase.schemas.ts`.
2. Implementar controladores `src/controllers/phraseController.ts` y `src/controllers/healthController.ts`.
3. Declarar rutas en `src/routes/phraseRoutes.ts`.
4. Implementar el patrón fábrica en `src/app.ts` exportando `createApp(options?: AppOptions)`:
   - Permite inyectar instancias personalizadas o simuladas de `embeddingProvider`, `embeddingCache`, `phraseRepository` y `similarityThreshold`.
   - Permite configurar o deshabilitar condicionalmente los rate limiters (`disableRateLimit?: boolean`) para evitar falsos positivos o bloqueos durante suites automatizadas de tests con `supertest`.
   - `src/index.ts` invoca `createApp()` con las instancias por defecto de producción y arranca el servidor HTTP en el puerto configurado.
5. Suite completa de integración con Vitest y `supertest` (`tests/integration/phrases.api.integration.test.ts`), utilizando `createApp(...)` con `MockEmbeddingProvider` y `InMemoryEmbeddingCache`, cubriendo:
   - Validación y persistencia de frases únicas y duplicados confirmados.
   - Bloqueo 409 ante duplicados no confirmados.
   - Rechazo 400 ante inputs vacíos tras trim.
   - Rechazo 415 ante content-type incompatible.
   - Paginación determinista y filtros en `GET /api/phrases`.
   - Exclusión de `embedding` en respuestas JSON y serialización numérica de `similarityScore`.
   - Retorno 200 en `GET /api/health`.

---

## Comprobación de la Constitución

A continuación se audita el diseño contra cada principio de [`specs/constitution.md`](file:///c:/Workspaces/nanoxxi93/semantic-phrase-validator/specs/constitution.md):

| Principio Constitucional | Estado | Evidencia en este Plan |
|---|---|---|
| **1.1 Separación Estricta por Capas** | CUMPLE | Rutas y controladores (`src/controllers/`) solo parsean HTTP; la lógica de negocio vive en `PhraseService` (`src/services/`); el acceso a base de datos se aísla en `PhraseRepository` (`src/repositories/`); los proveedores externos en `src/providers/` y utilidades puras en `src/utils/`. |
| **1.2 Inversión de Dependencias en IA** | CUMPLE | `PhraseService` recibe la interfaz abstracta `EmbeddingProvider`. Las suites de integración utilizan `MockEmbeddingProvider` determinista; cero llamadas de red externas en tests. |
| **2.1 Validación de Contratos con Zod** | CUMPLE | Toda entrada (`req.body`, `req.query`) se valida estrictamente con esquemas Zod antes de alcanzar la capa de servicios. Textos vacíos tras `.trim()` fallan de inmediato con `400 Bad Request`. |
| **2.2 Estructura JSON Estandarizada** | CUMPLE | Todas las respuestas exitosas retornan `{ success: true, data: ... }` y los errores `{ success: false, error: { code, message, details } }`. |
| **2.3 Códigos HTTP Obligatorios** | CUMPLE | Se respetan los códigos: `200` (validación, salud, listado), `201` (creación), `400` (payload inválido), `409` (duplicado no confirmado), `415` (media type no soportado), `429` (rate limit), `500` (fallos internos/base de datos) y `503` (indisponibilidad de IA). |
| **3.1 Variables de Entorno Estrictas** | CUMPLE | Cero secretos en código; todas las variables sensibles se validan en el arranque mediante Zod en `src/config/env.ts`. |
| **3.2 Minimización de Datos y Privacidad** | CUMPLE | La API excluye la columna vectorial `embedding` de los listados públicos para minimizar tráfico de red y proteger la privacidad. |
| **4.1 TDD y Cobertura Automatizada** | CUMPLE | Pruebas de integración automatizadas con `supertest` y Vitest cubriendo todos los criterios de aceptación sin consumo de red. |
| **4.2 Convención Lingüística y Nomenclatura** | CUMPLE | Todo el código fuente, clases, variables y métodos en inglés; especificaciones y documentación en español. Commits semánticos convencionales. |
| **4.3 Calidad de Código en Producción** | CUMPLE | Compilación TypeScript `"strict": true` sin ningún tipo `any`. Cero `console.log` en código productivo (regla auditada por `check_constitution.py`). |

---

## Suposiciones y preguntas abiertas

### Suposiciones:
1. **Infraestructura Fly.io y Proxy Inverso:** Se asume que Fly.io inyecta un solo salto de proxy reverso (`trust proxy = 1`), lo cual permite a Express extraer la IP pública original del cliente desde el encabezado estándar `X-Forwarded-For`.
2. **Volumen de Catálogo para el MVP:** Se asume que el volumen inicial de frases es inferior a 10,000 registros, por lo que la lectura de vectores con `PhraseRepository.getAllEmbeddings()` y la comparación coseno en memoria del backend se ejecuta en menos de 30 ms sin requerir todavía la extensión `pgvector`.
3. **Persistencia de Caché LRU:** Se asume que la memoria RAM del contenedor backend es suficiente para retener hasta 1,000 vectores (aproximadamente 3 MB de memoria heap), lo que no representa ningún riesgo de desbordamiento en entornos de 256MB o 512MB de RAM en Fly.io.

### Preguntas Abiertas:
- *Ninguna pregunta abierta pendiente.* Todas las decisiones funcionales, de seguridad y de contratos fueron clarificadas y aprobadas durante las etapas de `specify` y `clarify`.
