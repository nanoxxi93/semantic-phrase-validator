# Semantic Phrase Validator - Backend API

Servicio backend de inferencia semántica, validación de similitud conceptual y persistencia relacional para **Semantic Phrase Validator**, desarrollado con Node.js, Express y TypeScript bajo arquitectura desacoplada por capas (Clean Architecture / Hexagonal).

---

## 🏛️ Arquitectura y Responsabilidades

El backend está diseñado conforme a los estándares innegociables de la constitución del proyecto (`specs/constitution.md`):

```text
src/
├── app.ts                  # Composition Root: Ensamblaje central de middlewares y dependencias
├── index.ts                # Punto de entrada y arranque del servidor HTTP
├── config/                 # Validación de variables de entorno con esquemas Zod (env.ts)
├── controllers/            # Capa de Transporte HTTP: Parseo y validación de entrada (phraseController.ts)
├── services/               # Capa de Dominio: Orquestación, similitud coseno y evaluación de umbral (phraseService.ts)
├── repositories/           # Capa de Acceso a Datos: Consultas tipadas con Drizzle ORM (phraseRepository.ts)
├── providers/              # Capa de Integración Externa: Abstracción de Hugging Face (HuggingFaceEmbeddingProvider.ts)
├── cache/                  # Capa de Caché: Almacenamiento LRU en memoria RAM (inMemoryEmbeddingCache.ts)
├── middlewares/            # Hardening: Rate limiting por IP real, Content-Type y manejador canónico de errores
├── utils/                  # Funciones matemáticas puras: Cálculo de similitud coseno vectorial (cosineSimilarity.ts)
└── db/                     # Esquemas relacionales Drizzle (schema.ts) y migraciones SQL reproducibles
```

---

## ⚙️ Variables de Entorno

El backend valida estrictamente sus variables al arrancar mediante esquemas Zod en `src/config/env.ts`. Se configuran en el archivo `.env` tomando como base `.env.example`:

| Variable | Tipo | Valor por Defecto | Descripción |
|---|:---:|:---:|---|
| `DATABASE_URL` | String | *(Obligatoria)* | Cadena de conexión relacional de PostgreSQL (ej. `postgresql://postgres:postgrespassword@localhost:5432/semantic_phrases`). |
| `HF_TOKEN` | String | *(Obligatoria)* | Token de acceso de Hugging Face con permisos de lectura/inferencia y saldo habilitado en cuenta. |
| `HF_MODEL` | String | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Modelo de Feature Extraction multilingüe que genera vectores densos de 384 dimensiones. |
| `PORT` | Número | `3000` | Puerto HTTP donde el servidor Express escucha peticiones. |
| `NODE_ENV` | Enum | `development` | Entorno de ejecución (`development`, `test`, `production`). |
| `SIMILARITY_THRESHOLD` | Float | `0.80` | Umbral numérico (0.00 a 1.00) a partir del cual dos frases se catalogan como duplicado semántico. |
| `TRUST_PROXY` | Número | `1` | Configuración de saltos de proxies inversos (`trust proxy`) para obtener la IP real del cliente. |
| `EMBEDDING_CACHE_TTL_SECONDS` | Número | `3600` | Tiempo de vida (TTL) en segundos de los vectores almacenados en la caché LRU en memoria. |
| `RATE_LIMIT_WINDOW_MS` | Número | `60000` | Ventana temporal en milisegundos para el conteo de peticiones de rate limiting (1 minuto). |
| `RATE_LIMIT_INFERENCE_MAX` | Número | `30` | Límite máximo de peticiones por ventana para endpoints de inferencia (`/validate` y `POST /phrases`). |
| `RATE_LIMIT_READ_MAX` | Número | `100` | Límite máximo de peticiones por ventana para endpoints de lectura (`GET /phrases`). |
| `CORS_ORIGINS` | String | `http://localhost:5173,http://localhost:3000` | Lista blanca separada por comas de orígenes HTTP autorizados para interactuar con la API. |

---

## 🗄️ Persistencia y Base de Datos

Existen dos vías **mutuamente excluyentes** para inicializar la base de datos en PostgreSQL 17:

### Ruta A: Mediante Drizzle ORM (Recomendada)
Aplica las migraciones versionadas y gestionadas por el ORM registrando el historial en `__drizzle_migrations`:
```bash
npm run db:migrate
```

### Ruta B: Mediante Script SQL Directo
Aplica el DDL consolidado e idempotente disponible en `../scripts/schema.sql` (útil si se utiliza psql o GUI como DBeaver):
```bash
# Directamente desde el cliente psql:
psql -h localhost -U postgres -d semantic_phrases -f ../scripts/schema.sql

# O inyectando al contenedor Docker:
docker exec -i semantic_phrases_postgres psql -U postgres -d semantic_phrases < ../scripts/schema.sql
```

> **Importante:** Si inicializas con la **Ruta B**, no es necesario ejecutar la **Ruta A** (y viceversa).

---

## 📡 Catálogo de la API REST

Todas las respuestas del servidor siguen una estructura JSON predecible y estandarizada:
- **Éxito:** `{ "success": true, "data": { ... } }`
- **Error:** `{ "success": false, "error": { "code": "STRING", "message": "Descripción", "details": null | [ ... ] } }`

### 1. Pre-validación Semántica
- **Ruta:** `POST /api/phrases/validate`
- **Cabeceras obligatorias:** `Content-Type: application/json`
- **Descripción:** Genera el vector de 384 dimensiones de la oración, evalúa la similitud coseno contra el catálogo almacenado e informa el resultado **sin persistir** en la base de datos.
- **Cuerpo de la petición (JSON):**
  ```json
  {
    "text": "Debo pagar la factura de la luz mañana"
  }
  ```
- **Respuestas:**
  - `200 OK` (Frase única):
    ```json
    {
      "success": true,
      "data": {
        "isDuplicate": false,
        "similarityScore": 0.4512,
        "threshold": 0.8,
        "similarPhrase": {
          "id": "e4b3c2a1-...",
          "text": "Compré manzanas en el mercado"
        }
      }
    }
    ```
  - `200 OK` (Duplicado semántico detectado):
    ```json
    {
      "success": true,
      "data": {
        "isDuplicate": true,
        "similarityScore": 0.8390,
        "threshold": 0.8,
        "similarPhrase": {
          "id": "f1a2b3c4-...",
          "text": "Tengo que pagar el recibo de electricidad mañana"
        }
      }
    }
    ```
  - `400 Bad Request` (`VALIDATION_ERROR`): Texto vacío o mayor a 280 caracteres.
  - `415 Unsupported Media Type` (`UNSUPPORTED_MEDIA_TYPE`): Falta o cabecera `Content-Type` inválida.
  - `429 Too Many Requests` (`RATE_LIMIT_EXCEEDED`): Más de 30 peticiones por minuto.
  - `503 Service Unavailable` (`AI_SERVICE_UNAVAILABLE`): Fallo o indisponibilidad en la API de Hugging Face.

### 2. Creación y Persistencia de Frase
- **Ruta:** `POST /api/phrases`
- **Cabeceras obligatorias:** `Content-Type: application/json`
- **Descripción:** Evalúa la frase y la persiste en PostgreSQL. Si se detecta un duplicado semántico y `confirmDuplicate` es `false` (o no se envía), la petición se rechaza con código `409 Conflict`. Para guardar forzadamente un duplicado, se debe remitir `confirmDuplicate: true`.
- **Cuerpo de la petición (JSON):**
  ```json
  {
    "text": "Tengo que pagar el recibo de electricidad mañana",
    "confirmDuplicate": false
  }
  ```
- **Respuestas:**
  - `201 Created` (Persistida con éxito como única o duplicado confirmado):
    ```json
    {
      "success": true,
      "data": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "text": "Tengo que pagar el recibo de electricidad mañana",
        "similarityScore": 0.8390,
        "similarToId": "f1a2b3c4-...",
        "validationStatus": "CONFIRMED_DUPLICATE",
        "createdAt": "2026-10-22T10:00:00.000Z"
      }
    }
    ```
  - `409 Conflict` (`DUPLICATE_PHRASE`): Detectada colisión semántica ≥ 0.80 sin confirmación del usuario.
    ```json
    {
      "success": false,
      "error": {
        "code": "DUPLICATE_PHRASE",
        "message": "Potential semantic duplicate detected",
        "details": {
          "similarityScore": 0.8390,
          "threshold": 0.8,
          "similarPhrase": {
            "id": "f1a2b3c4-...",
            "text": "Debo pagar la factura de la luz mañana"
          }
        }
      }
    }
    ```

### 3. Consulta Paginada del Catálogo
- **Ruta:** `GET /api/phrases?page=1&limit=10&status=UNIQUE`
- **Parámetros de consulta (Query params):**
  - `page`: Número de página entero positivo (predeterminado: `1`).
  - `limit`: Cantidad de elementos por página, máximo 100 (predeterminado: `10`).
  - `status`: Filtro opcional (`UNIQUE` o `CONFIRMED_DUPLICATE`).
- **Optimización de red:** Omite deliberadamente la columna vectorial `embedding` (`JSONB`), reduciendo el consumo de ancho de banda al transferir únicamente texto y metadatos analíticos.
- **Respuesta `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "3fa85f64-...",
          "text": "Debo pagar la factura de la luz mañana",
          "similarityScore": null,
          "similarToId": null,
          "validationStatus": "UNIQUE",
          "createdAt": "2026-10-22T10:00:00.000Z",
          "similarPhrase": null
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total": 1,
        "totalPages": 1
      }
    }
  }
  ```

### 4. Sonda de Salud (Health Check)
- **Ruta:** `GET /api/health`
- **Descripción:** Endpoint ultraligero sin acceso a base de datos ni límites de tasa, utilizado para mitigar arranques en frío (cold start) y verificar la operatividad del contenedor.
- **Respuesta `200 OK`:** `{ "status": "ok" }`

---

## 🛡️ Políticas de Seguridad y Hardening

1. **Defensa contra Denegación de Servicio (DoS):**
   - Límite de carga útil JSON fijado estrictamente en **10 KB** (`express.json({ limit: '10kb' })`). Peticiones mayores retornan `413 Payload Too Large`.
2. **Rate Limiting Defensivo:**
   - Inferencia protegida: máximo 30 peticiones/minuto por IP real.
   - Lecturas protegidas: máximo 100 peticiones/minuto por IP real.
3. **Validación Estricta de Medios:**
   - Middleware `contentTypeValidator` rechaza payloads sin `Content-Type: application/json` con `415 Unsupported Media Type`.
4. **Cabeceras HTTP Defensivas:**
   - Integración de `helmet()` configurando directivas de protección CSP, HSTS, X-Content-Type-Options y anti-clickjacking.

---

## 💻 Comandos de Desarrollo y Testing

Ejecutar desde el subdirectorio `backend/`:

```bash
# Iniciar en modo desarrollo con recarga en caliente (watch)
npm run dev

# Validar tipos estáticos con TypeScript en modo estricto
npm run typecheck

# Compilar proyecto a JavaScript en dist/
npm run build

# Ejecutar tests unitarios (matemáticas vectoriales, caché y servicios con mocks)
npm run test:unit

# Ejecutar tests de integración (Supertest + DB + Rate Limiter)
npm run test:integration

# Ejecutar la suite completa de tests de backend
npm run test:all

# Ejecutar script de verificación de inferencia en vivo con Hugging Face
npm run test:hf
```
