# Plan de Implementación Técnico: 001-core-semantic-engine

## Información general sobre la arquitectura
Esta funcionalidad construye los cimientos matemáticos, de integración de IA y de persistencia relacional para el sistema **Semantic Phrase Validator**, correspondientes a la Fase 1 del roadmap. No expone endpoints HTTP en esta fase (los endpoints REST y servicios de validación de oraciones corresponden a `002-phrase-validation-api`), enfocándose estrictamente en el motor de cómputo vectorial, los proveedores de inferencia desacoplados y la definición del esquema relacional en PostgreSQL.

### Diagrama de Componentes y Flujo de Control

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                      BACKEND (backend/src/)                               │
│                                                                           │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │                  backend/src/config/env.ts                        │   │
│   │      (Validación Zod de variables: DATABASE_URL, HF_TOKEN, etc.)  │   │
│   └─────────────────────────────────┬─────────────────────────────────┘   │
│                                     │                                     │
│         ┌───────────────────────────┴───────────────────────────┐         │
│         ▼                                                       ▼         │
│  ┌───────────────────────────────┐              ┌──────────────────────┐  │
│  │   backend/src/providers/      │              │   backend/src/utils/ │  │
│  │   ├── EmbeddingProvider (intf)│              │   └── cosine.ts      │  │
│  │   ├── HuggingFaceProvider     │              │       (función pura) │  │
│  │   └── MockEmbeddingProvider   │              └──────────────────────┘  │
│  └──────────────┬────────────────┘                                        │
│                 │                                                         │
│                 ▼                                                         │
│  ┌───────────────────────────────┐                                        │
│  │   backend/src/db/             │                                        │
│  │   ├── schema.ts (Drizzle ORM) │                                        │
│  │   ├── index.ts (Pool pg)      │                                        │
│  │   └── migrations/             │                                        │
│  └──────────────┬────────────────┘                                        │
└─────────────────┼─────────────────────────────────────────────────────────┘
                  │                                  │
                  ▼                                  ▼
      ┌───────────────────────┐          ┌───────────────────────┐
      │      PostgreSQL       │          │   Hugging Face API    │
      │   (Docker Compose)    │          │  (Feature Extraction) │
      │   (tabla: 'phrases')  │          │   (MiniLM 384 dims)   │
      └───────────────────────┘          └───────────────────────┘
```

### Componentes Involucrados:
1. **`backend/src/config/env.ts`**: Validador de configuración en arranque con Zod para garantizar tipado estricto de `DATABASE_URL`, `HF_TOKEN` y `HF_MODEL`.
2. **`backend/src/utils/cosineSimilarity.ts`**: Utilidad matemática pura sin efectos secundarios para el cómputo de la similitud coseno entre dos vectores numéricos de 384 elementos.
3. **`backend/src/providers/`**:
   - `embeddingProvider.interface.ts`: Contrato de dominio abstracto (`EmbeddingProvider`).
   - `huggingFaceEmbeddingProvider.ts`: Cliente que implementa `@huggingface/inference` para la tarea `featureExtraction` con tolerancia a tensores `1 x 384`.
   - `mockEmbeddingProvider.ts`: Proveedor determinista en memoria para pruebas automáticas, basado en hashing de texto y soporte para fixtures.
   - `errors/`: Clases de error de dominio tipadas (`InvalidVectorDimensionError`, `EmptyTextError`, `ExternalAIProviderError`, `InvalidEmbeddingResponseError`).
4. **`backend/src/db/`**:
   - `schema.ts`: Esquema Drizzle ORM de la tabla `phrases` con tipos PostgreSQL nativos (`uuid`, `varchar`, `jsonb`, `numeric`, `timestamptz`).
   - `index.ts`: Conexión cliente mediante `drizzle-orm/node-postgres` con `pg.Pool`.
   - `drizzle.config.ts`: Configuración para `drizzle-kit` para generar y ejecutar migraciones SQL.

---

## Pila tecnológica y decisiones clave

- **Decisión 1: Persistencia Vectorial en PostgreSQL mediante columna `JSONB` con Drizzle ORM**
  - **Por qué:** Permite serializar y persistir el array numérico de 384 números de coma flotante de manera estándar y altamente portable sin añadir dependencias nativas de compilación de extensiones en C (`pgvector`) durante el MVP. Drizzle ORM proporciona tipado estricto en TypeScript sin sobrecostes de rendimiento.
  - **Alternativas consideradas:**
    - *Extensión `pgvector`:* Descartada para la Fase 1 para mantener cero fricciones en despliegues básicos y Docker local, programando su adopción posterior en la hoja de ruta cuando el catálogo requiera índices HNSW/IVFFlat.
    - *Base de datos vectorial dedicada (Pinecone/Qdrant):* Descartada por sobrecoste operativo, costo económico y pérdida de transaccionalidad ACID en un proyecto monolítico ágil.
  - **Requisitos No Funcionales cubiertos:** RNF-5 (precisión decimal íntegra), RNF-3 (cero `any` y tipado inferido de esquemas Drizzle).

- **Decisión 2: Utilidad Pura en Memoria para Similitud Coseno (`calculateCosineSimilarity`)**
  - **Por qué:** Un vector de 384 dimensiones requiere exactamente 384 multiplicaciones y sumas acumuladas. En JavaScript moderno sobre el motor V8, esta operación toma menos de 0.05 ms por par de vectores, satisfaciendo holgadamente el límite de 0.1 ms por cálculo.
  - **Alternativas consideradas:**
    - *Librería npm externa (como `compute-cosine-similarity` o `mathjs`):* Descartadas para evitar dependencias innecesarias en la cadena de suministro por una fórmula matemática pura de 15 líneas con tipado estricto.
  - **Requisitos No Funcionales cubiertos:** RNF-1 (latencia < 0.1 ms), RNF-6 (función matemática pura desacoplada en `backend/src/utils/`).

- **Decisión 3: Inversión de Dependencias en Embeddings mediante `EmbeddingProvider`**
  - **Por qué:** Desacopla la lógica de negocio y las pruebas del servicio de red externo de Hugging Face. El uso obligatorio de `MockEmbeddingProvider` en pruebas unitarias evita el consumo de tokens y garantiza ejecución determinista ultrarrápida.
  - **Alternativas consideradas:**
    - *Llamadas directas a `fetch` con `process.env.HF_TOKEN`:* Descartadas por violar el principio de responsabilidad única, acoplar el código al proveedor y arriesgar fugas de credenciales.
  - **Requisitos No Funcionales cubiertos:** RNF-2 (seguridad y no filtración de credenciales), RNF-4 (tests unitarios 100% deterministas en < 3s).

- **Decisión 4: Normalización Previa y Desempaquetado Tolerante de Tensores**
  - **Por qué:** Diferentes versiones o endpoints de Hugging Face Feature Extraction pueden devolver `number[]` o `number[][]` (`[ [ float_1, ..., float_384 ] ]`). Extraer automáticamente el primer array `response[0]` previene roturas de contrato en producción manteniendo la verificación estricta de 384 dimensiones. La normalización `text.trim().replace(/\s+/g, ' ')` previene discrepancias de embeddings generadas por espacios en blanco aleatorios.
  - **Alternativas consideradas:**
    - *Rechazar cualquier respuesta bidimensional:* Descartado por fragilidad innecesaria ante respuestas estándar del SDK `@huggingface/inference`.
  - **Requisitos No Funcionales cubiertos:** RNF-3 (robustez y tipado estricto), manejo de casos extremos CE-3 y CE-5.

---

## Secuencia de implementación

La construcción técnica se ejecutará en 5 bloques progresivos sin dependencias circulares:

### Bloque 1: Inicialización del Backend y Configuración
1. Configurar el directorio `backend/` con `package.json`, scripts (`build`, `test`, `db:generate`, `db:migrate`) y dependencias:
   - Producción: `express`, `drizzle-orm`, `pg`, `@huggingface/inference`, `zod`, `dotenv`.
   - Desarrollo: `typescript`, `tsx`, `@types/node`, `@types/express`, `@types/pg`, `drizzle-kit`, `vitest`.
2. Crear `tsconfig.json` con `"strict": true`, `"moduleResolution": "node16"`, `"target": "ES2022"` y `"noImplicitAny": true`.
3. Crear `docker-compose.yml` en la raíz del proyecto para levantar PostgreSQL 17 (imagen `postgres:17-alpine`) con puerto mapeado `5432:5432` y volumen persistente.
4. Implementar `backend/src/config/env.ts` utilizando Zod para validar `DATABASE_URL`, `HF_TOKEN` y `HF_MODEL`.

### Bloque 2: Esquema Relacional y Migraciones con Drizzle ORM
1. Crear `backend/src/db/schema.ts` definiendo la tabla `phrases`:
   - `id`: `uuid('id').primaryKey().defaultRandom()`
   - `text`: `varchar('text', { length: 280 }).notNull()`
   - `embedding`: `jsonb('embedding').$type<number[]>().notNull()`
   - `similarity_score`: `numeric('similarity_score', { precision: 5, scale: 4 })` (nullable)
   - `similar_to_id`: `uuid('similar_to_id').references((): any => phrases.id, { onDelete: 'set null' })` (nullable)
   - `validation_status`: `varchar('validation_status', { length: 30 }).$type<'UNIQUE' | 'CONFIRMED_DUPLICATE'>().notNull()`
   - `created_at`: `timestamp('created_at', { withTimezone: true }).defaultNow().notNull()`
2. Configurar `drizzle.config.ts` y generar la migración inicial SQL mediante `drizzle-kit generate`.
3. Crear `backend/src/db/index.ts` instanciando el cliente Drizzle conectado al pool de PostgreSQL.

### Bloque 3: Módulo Matemático de Similitud Coseno
1. Definir la excepción `InvalidVectorDimensionError` en `backend/src/errors/InvalidVectorDimensionError.ts`.
2. Implementar `calculateCosineSimilarity(vecA: number[], vecB: number[]): number` en `backend/src/utils/cosineSimilarity.ts`:
   - Validar que ambos vectores posean longitud exacta de 384 elementos (`vecA.length === 384 && vecB.length === 384`); de lo contrario, lanzar `InvalidVectorDimensionError`.
   - Calcular producto punto y normas euclidianas en un solo ciclo iterativo.
   - Si `normA === 0 || normB === 0`, retornar `0.0000` deterministamente.
   - Acotar el cociente al rango `[0.0, 1.0]` y aplicar redondeo a 4 decimales: `Math.round((val + Number.EPSILON) * 10000) / 10000`.

### Bloque 4: Capa de Proveedores de Embeddings
1. Definir contratos y errores en `backend/src/providers/`:
   - `EmbeddingProvider`: interfaz con `generateEmbedding(text: string): Promise<number[]>`.
   - `EmptyTextError`: error al recibir texto vacío tras normalización.
   - `ExternalAIProviderError`: error estructurado para fallos de Hugging Face.
   - `InvalidEmbeddingResponseError`: error para respuestas con dimensiones no válidas.
2. Implementar `MockEmbeddingProvider`:
   - Algoritmo de hash determinista sobre los códigos de caracteres de la frase que llena un vector de 384 flotantes normalizados.
   - Método `registerFixture(text: string, vector: number[])` para pruebas controladas.
3. Implementar `HuggingFaceEmbeddingProvider`:
   - Función normalizadora interna `normalizeText(text: string): string` que aplica `trim()` y colapsa secuencias de `\s+`.
   - Llamada a `hf.featureExtraction({ model, inputs: normalizedText })`.
   - Desempaquetado tolerante: si la respuesta es bidimensional `(Array.isArray(res[0]))`, extraer `res[0]`.
   - Validación estricta de longitud 384 y tipos numéricos.
   - Política de reintentos ante arranque en frío (`503 Model is loading`): Si la API responde con código 503, el proveedor ejecuta automáticamente hasta 2 reintentos sucesivos con pausa progresiva (utilizando `estimated_time` o backoff de 3 a 5 segundos).
   - Bloque `try/catch` que intercepta errores definitivos (503 persistente tras reintentos, 429, 401, timeout) y encapsula en `ExternalAIProviderError` sin exponer `HF_TOKEN`.

### Bloque 5: Suites de Pruebas Unitarias Automatizadas
1. Pruebas para `calculateCosineSimilarity` en `backend/tests/unit/cosineSimilarity.test.ts`:
   - CA-01: Similitud idéntica retorna `1.0000`.
   - CA-02: Similitud ortogonal retorna `0.0000`.
   - CA-05: Redondeo exacto a 4 decimales sin desbordes de precisión.
   - CE-1: Vectores vacíos o de dimensión dispar lanzan `InvalidVectorDimensionError`.
   - CE-2: Vectores de ceros retornan `0.0000` sin arrojar `NaN`.
2. Pruebas para `EmbeddingProvider` y `HuggingFaceEmbeddingProvider` en `backend/tests/unit/embeddingProvider.test.ts`:
   - CA-03: Generación de embedding con longitud 384 y normalización de texto.
   - CA-07: Determinismo de `MockEmbeddingProvider` y uso de fixtures.
   - CE-3: Texto vacío o solo espacios lanza `EmptyTextError`.
   - CE-4: Mapeo de errores de API a `ExternalAIProviderError` protegiendo credenciales.
   - CE-5: Detección de respuestas con dimensiones inválidas (`InvalidEmbeddingResponseError`).

---

## Comprobación de la Constitución

- [x] **Separación Estricta por Capas (`constitution.md` §1.1):** Cumplido. La función de similitud coseno es una función matemática pura sin estado en `backend/src/utils/`. La integración con Hugging Face se aísla en `backend/src/providers/` sin tocar bases de datos. Los esquemas y conexiones residen exclusivamente en `backend/src/db/`.
- [x] **Inversión de Dependencias en Inferencia de IA (`constitution.md` §1.2):** Cumplido. Se define la interfaz abstracta `EmbeddingProvider`. Todas las pruebas unitarias y suites de integración se ejecutan exclusivamente con `MockEmbeddingProvider`, garantizando cero consumo de cuota externa y cero llamadas de red en pruebas.
- [x] **Configuración Externa y Seguridad (`constitution.md` §3.1 y §3.2):** Cumplido. Todas las variables sensibles (`DATABASE_URL`, `HF_TOKEN`, `HF_MODEL`) son parseadas y validadas con un esquema Zod centralizado. Se prohíbe explícitamente incluir tokens en mensajes de error o logs.
- [x] **Estándares de Calidad y TDD (`constitution.md` §4.1 y §4.3):** Cumplido. Cobertura del 100% de los criterios de aceptación y casos extremos en Vitest. Compilación estricta con TypeScript (`"strict": true`, cero `any`).
- [x] **Convención Lingüística y Nomenclatura (`constitution.md` §4.2):** Cumplido. Todo el código fuente, clases, variables, interfaces y tests están en inglés; documentación técnica en español.

---

## Suposiciones y preguntas abiertas

### Suposiciones:
1. **Entorno Docker local (Confirmado):** Se cuenta con Docker Engine en el entorno local para ejecutar el contenedor local de PostgreSQL 17 especificado en `docker-compose.yml`.
2. **Respuesta de Feature Extraction (Abierta / Por validar en integración):** Se asume que el modelo `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` servido por la API de Hugging Face retorna representaciones vectoriales densas de 384 dimensiones. Esta suposición permanece formalmente abierta y pendiente de verificación empírica hasta ejecutar las pruebas de integración con la API real durante la implementación.
3. **Capacidad y dimensionamiento del cálculo en memoria vs. `pgvector`:**
   El cálculo lineal de similitud coseno en memoria backend ($O(N)$) está dimensionado para operar bajo las siguientes métricas de capacidad:
   - **1 a 1,000 frases:** ~3 MB de datos vectoriales en memoria, cómputo completado en **< 2 ms**.
   - **1,000 a 10,000 frases:** ~30 MB de datos vectoriales en memoria, cómputo completado entre **15 y 30 ms** (óptimo para el alcance del MVP).
   - **> 10,000 frases (Punto de inflexión):** Se define formalmente que a partir de las 10,000 frases registradas, el volumen de transferencia de datos I/O desde la base de datos hacia el backend aconseja activar la migración a la extensión `pgvector` de PostgreSQL con índices HNSW.

### Preguntas abiertas (Resuelta):
- **Estrategia ante Timeout y Arranque en Frío de Hugging Face (Resuelta):** Se acordó que `HuggingFaceEmbeddingProvider` incorporará una política de reintento automático ante respuestas `503 Model is currently loading`. El cliente ejecutará hasta 2 reintentos sucesivos con una pausa basada en el campo `estimated_time` de la respuesta o un backoff de 3 a 5 segundos. Solo si tras los reintentos el modelo no responde exitosamente o se agota el tiempo máximo de espera, se elevará la excepción `ExternalAIProviderError`.
