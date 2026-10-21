# Lista de Tareas: 001-core-semantic-engine

## Fase 1: Configuración de Entorno e Infraestructura
- [x] 1.1 Configurar el espacio de trabajo `backend/` con `package.json`, scripts (`build`, `test`, `db:generate`, `db:migrate`) y dependencias de producción (`express`, `drizzle-orm`, `pg`, `@huggingface/inference`, `zod`, `dotenv`) y desarrollo (`typescript`, `tsx`, `@types/node`, `@types/express`, `@types/pg`, `drizzle-kit`, `vitest`).
  *(No hay dependencias. Desbloquea la configuración del backend)*
- [x] 1.2 Configurar `backend/tsconfig.json` en modo estricto (`"strict": true`, `"moduleResolution": "node16"`, `"target": "ES2022"`, `"noImplicitAny": true`).
  *(Depende de 1.1)*
- [x] 1.3 Crear `docker-compose.yml` en la raíz del proyecto para PostgreSQL 17 utilizando la imagen `postgres:17-alpine`, configurando volumen persistente y mapeo de puerto `5432:5432`.
  *(No hay dependencias. Desbloquea el entorno de base de datos local)*
- [x] 1.4 Implementar `backend/src/config/env.ts` utilizando Zod para validar de forma estricta en el arranque las variables de entorno `DATABASE_URL`, `HF_TOKEN` y `HF_MODEL`.
  *(Depende de 1.1 y 1.2)*

## Fase 2: Persistencia Relacional y Migraciones con Drizzle ORM
- [x] 2.1 Definir el esquema de la tabla `phrases` en `backend/src/db/schema.ts` con Drizzle ORM:
  - `id`: UUID clave primaria generada con `defaultRandom()`.
  - `text`: VARCHAR(280) no nulo.
  - `embedding`: JSONB no nulo tipado como `number[]`.
  - `similarity_score`: NUMERIC(5,4) anulable (`nullable`), por defecto `null`.
  - `similar_to_id`: UUID anulable con clave foránea auto-referencial `phrases.id` y regla `ON DELETE SET NULL` (CA-06).
  - `validation_status`: VARCHAR(30) no nulo restringido a `'UNIQUE' | 'CONFIRMED_DUPLICATE'`.
  - `created_at`: TIMESTAMPTZ no nulo con `defaultNow()`.
  *(Depende de la Fase 1. Desbloquea las migraciones SQL)*
- [x] 2.2 Configurar `backend/drizzle.config.ts` y generar la migración inicial SQL mediante `drizzle-kit generate`.
  *(Depende de 2.1)*
- [x] 2.3 Implementar el cliente de base de datos en `backend/src/db/index.ts` instanciando Drizzle con un pool de conexiones `pg.Pool`.
  *(Depende de 1.4 y 2.1)*

## Fase 3: Motor Matemático de Similitud Coseno
- [x] 3.1 Crear la clase de error de dominio `InvalidVectorDimensionError` en `backend/src/errors/InvalidVectorDimensionError.ts`.
  *(Depende de la Fase 1)*
- [x] 3.2 Implementar la función matemática pura `calculateCosineSimilarity(vecA: number[], vecB: number[]): number` en `backend/src/utils/cosineSimilarity.ts`:
  - Validar que ambos vectores contengan exactamente 384 elementos numéricos no vacíos; de lo contrario, lanzar `InvalidVectorDimensionError` (CE-1).
  - Computar el producto punto y las normas euclidianas en una sola iteración $O(N)$.
  - Detectar normas iguales a cero y retornar de forma segura `0.0000` para evitar divisiones indeterminadas `NaN` (CE-2).
  - Acotar el resultado al intervalo `[0.0000, 1.0000]` y redondear simétricamente a 4 decimales: `Math.round((val + Number.EPSILON) * 10000) / 10000` (CA-01, CA-02, CA-05).
  *(Función pura desacoplada, sin dependencias de I/O ni red)*

## Fase 4: Proveedores de Embeddings e Integración de IA
- [x] 4.1 Definir la interfaz abstracta `EmbeddingProvider` en `backend/src/providers/embeddingProvider.interface.ts` con la firma `generateEmbedding(text: string): Promise<number[]>`.
  *(Depende de la Fase 1)*
- [x] 4.2 Crear las clases de error de dominio en `backend/src/errors/`:
  - `EmptyTextError.ts`: Disparado al recibir texto vacío o solo espacios en blanco.
  - `ExternalAIProviderError.ts`: Disparado ante fallas HTTP de la API externa (protegiendo `HF_TOKEN`).
  - `InvalidEmbeddingResponseError.ts`: Disparado ante estructuras dimensionales no conformes.
  *(Depende de la Fase 1)*
- [x] 4.3 Implementar `MockEmbeddingProvider` en `backend/src/providers/mockEmbeddingProvider.ts`:
  - Algoritmo de hash determinista reproducible sobre los caracteres del texto para generar vectores de 384 flotantes.
  - Método `registerFixture(text: string, vector: number[])` para pruebas controladas deterministas sin red (CA-07).
  *(Depende de 4.1)*
- [x] 4.4 Implementar `HuggingFaceEmbeddingProvider` en `backend/src/providers/huggingFaceEmbeddingProvider.ts`:
  - Función de normalización de entrada que aplica `text.trim().replace(/\s+/g, ' ')`; si la longitud neta es 0, lanza `EmptyTextError` (CE-3).
  - Llamada a `@huggingface/inference` ejecutando la tarea `featureExtraction` con el modelo configurado.
  - Desempaquetado tolerante de tensores `1 x 384` (`response[0]`) y validación estricta de 384 números (CE-5, CA-03).
  - Política de reintentos progresivos: hasta 2 reintentos sucesivos con pausa progresiva ante HTTP 503 (`Model is currently loading`).
  - Bloque `try/catch` que encapsula fallos definitivos (503 persistente, 429, 401, timeout) en `ExternalAIProviderError` sin exponer credenciales en trazas ni mensajes (CE-4).
  *(Depende de 4.1 y 4.2)*

## Fase 5: Pruebas Unitarias Automatizadas (TDD / Vitest)
- [x] 5.1 Implementar la suite de pruebas unitarias para `calculateCosineSimilarity` en `backend/tests/unit/cosineSimilarity.test.ts`:
  - Vectores idénticos retornan exactamente `1.0000` (CA-01).
  - Vectores ortogonales retornan `0.0000` (CA-02).
  - Precisión de redondeo a 4 decimales sin artefactos de coma flotante (CA-05).
  - Error `InvalidVectorDimensionError` ante vectores vacíos o dimensiones desiguales (CE-1).
  - Retorno seguro de `0.0000` ante vectores de magnitud cero sin producir `NaN` (CE-2).
  *(Depende de la Fase 3)*
- [x] 5.2 Implementar la suite de pruebas unitarias para `EmbeddingProvider` en `backend/tests/unit/embeddingProvider.test.ts`:
  - Generación de embedding con longitud exacta 384 y normalización de espacios (CA-03).
  - Determinismo y reproducibilidad de `MockEmbeddingProvider` con y sin fixtures (CA-07).
  - Rechazo temprano con `EmptyTextError` ante texto vacío o solo espacios (CE-3).
  - Mapeo de errores y reintentos ante cold-start en `HuggingFaceEmbeddingProvider` comprobando no filtración de `HF_TOKEN` (CE-4).
  - Detección de respuestas no conformes con `InvalidEmbeddingResponseError` (CE-5).
  *(Depende de la Fase 4)*
- [x] 5.3 Configurar el script de ejecución en `backend/package.json` y verificar que la suite completa de Vitest corre de forma 100% determinista en < 3 segundos.
  *(Depende de 5.1 y 5.2)*

---

## Bloqueos y Dependencias Externas
- Ninguno actualmente.
