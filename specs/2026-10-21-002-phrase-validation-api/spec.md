# 002-phrase-validation-api: API REST y Lógica de Negocio de Validación Semántica

## Resumen
La API REST de validación de frases provee los puntos de acceso HTTP necesarios para validar la novedad conceptual de oraciones cortas en tiempo real, persistir frases únicas o duplicados intencionales con trazabilidad vectorial y consultar el catálogo histórico paginado con sus metadatos de validación semántica serializados en camelCase. Esta capa orquesta el flujo de negocio blindando la infraestructura mediante mecanismos rigurosos contra abusos (rate limiting por IP real tras proxies como Fly.io, cabeceras de seguridad y validación temprana en esquemas Zod), endpoint de chequeo de salud para orquestadores, cortocircuito por coincidencia textual exacta, caché en memoria con política de desalojo LRU y persistencia relacional en PostgreSQL optimizada para ordenamiento determinista.

## Casos de usuario
- **CU-1**: Como cliente web o usuario, quiero pre-validar una oración corta (`POST /api/phrases/validate`) antes de guardarla para conocer el porcentaje de similitud frente a la frase más afín del catálogo y determinar si se considera duplicado según el umbral configurado.
- **CU-2**: Como usuario, quiero intentar guardar una nueva frase (`POST /api/phrases`) y recibir una advertencia bloqueante (`409 Conflict`) si el sistema detecta que es un duplicado potencial no confirmado previamente, para evitar registrar redundancias por descuido o error.
- **CU-3**: Como usuario consciente, quiero confirmar el guardado intencional de una frase detectada como duplicada (`POST /api/phrases` con `confirmDuplicate: true`), persistiendo la frase con estado `CONFIRMED_DUPLICATE` y vinculándola a la frase más cercana para conservar la trazabilidad histórica de la decisión.
- **CU-4**: Como usuario, quiero guardar directamente una frase conceptualmente única (`POST /api/phrases`), almacenándose con estado `UNIQUE` y metadatos nulos (`similar_to_id = NULL`, `similarity_score = NULL`) cuando la similitud no supere el umbral o cuando el catálogo esté inicialmente vacío.
- **CU-5**: Como cliente web, quiero consultar el catálogo de frases guardadas (`GET /api/phrases`) con paginación formal determinista y filtros de estado para explorar el historial de validaciones sin sobrecargar la red con vectores pesados.
- **CU-6**: Como usuario y sistema, quiero que al validar una frase con texto idéntico a una ya existente, la detección sea instantánea con score `1.0000` y cero consumo de cuota externa de IA.
- **CU-7**: Como usuario y sistema, quiero que al pasar de la fase de validación a la fase de guardado con el mismo texto, no se duplique la llamada a Hugging Face gracias a una caché intermedia de embeddings.
- **CU-8**: Como operador de la plataforma, quiero que la API esté protegida contra ráfagas abusivas de peticiones y consumo descontrolado de cuota de IA mediante limitadores de tasa por IP real (reconociendo proxies reversos de Fly.io) y cabeceras de seguridad.
- **CU-9**: Como infraestructura y orquestador (Fly.io / Docker Compose), quiero disponer de una sonda ultraligera de salud (`GET /api/health`) para verificar la disponibilidad del contenedor sin consumir cuota de rate limits ni dependencias de I/O.

## Criterios de aceptación
- [x] **CA-01 (Pre-validación informativa sin duplicados)**: Dado un texto válido cuya mayor similitud con el catálogo persistido no alcanza el `SIMILARITY_THRESHOLD` (ej. 0.4200 < 0.8000), cuando se solicita `POST /api/phrases/validate`, el sistema responde con HTTP `200 OK`, `isDuplicate: false`, `similarityScore` con el valor exacto de la frase más afín encontrada (redondeado a 4 decimales), `threshold` configurado y `similarPhrase` con el `{ id, text }` de dicha frase. Si el catálogo está totalmente vacío, retorna `isDuplicate: false`, `similarityScore: null` y `similarPhrase: null`.
- [x] **CA-02 (Pre-validación con duplicado semántico)**: Dado un texto cuya similitud coseno máxima con alguna frase persistida es mayor o igual a `SIMILARITY_THRESHOLD` (ej. `0.8000`), cuando se solicita `POST /api/phrases/validate`, responde con HTTP `200 OK`, `isDuplicate: true`, `similarityScore` redondeado a 4 decimales, `threshold` configurado y `similarPhrase` con el `{ id, text }` de la frase causante.
- [x] **CA-03 (Persistencia de frase única)**: Dado un texto sin duplicados semánticos en el catálogo, cuando se solicita `POST /api/phrases`, el sistema persiste el registro en PostgreSQL con `validation_status = 'UNIQUE'`, `similar_to_id = NULL`, `similarity_score = NULL` y responde con HTTP `201 Created` y los datos creados serializados en `camelCase` (omitiendo el vector `embedding`).
- [x] **CA-04 (Bloqueo y advertencia ante duplicado no confirmado)**: Dado un texto que supera el umbral de similitud frente a una frase existente y se envía `POST /api/phrases` con `confirmDuplicate: false` o sin el campo, el sistema no persiste el registro, responde con HTTP `409 Conflict`, código de error `DUPLICATE_PHRASE_DETECTED` y los detalles del duplicado (`similarityScore`, `threshold`, `similarPhrase`).
- [x] **CA-05 (Persistencia forzada de duplicado confirmado)**: Dado un texto que supera el umbral de similitud y se envía `POST /api/phrases` con `confirmDuplicate: true`, el sistema persiste el registro con `validation_status = 'CONFIRMED_DUPLICATE'`, `similar_to_id` apuntando a la frase más cercana y `similarity_score` correspondiente, retornando HTTP `201 Created`.
- [x] **CA-06 (Listado paginado y exclusión de vectores)**: Cuando se solicita `GET /api/phrases`, el sistema responde con HTTP `200 OK` conteniendo un listado ordenado deterministamente por `created_at DESC, id DESC`, con metadatos de paginación (`page`, `limit`, `total`, `totalPages`), donde cada elemento incluye `id`, `text`, `validationStatus`, `similarityScore`, `similarToId`, `similarPhrase` y `createdAt`, omitiendo taxativamente el array `embedding`.
- [x] **CA-07 (Filtrado de catálogo por estado)**: Cuando se solicita `GET /api/phrases?status=UNIQUE` o `GET /api/phrases?status=CONFIRMED_DUPLICATE`, el sistema retorna únicamente las frases que coinciden con dicho estado de validación y actualiza acordemente los metadatos de paginación.
- [x] **CA-08 (Validación estricta y temprana en esquemas Zod)**: Dada una petición a cualquier endpoint con cuerpo o parámetros inválidos (ej. texto vacío, texto compuesto exclusivamente por espacios en blanco tras `.trim()`, texto > 280 caracteres, `page < 1`, `limit < 1` o `limit > 100`, tipos de datos incorrectos), el middleware de validación rechaza la petición en la entrada con HTTP `400 Bad Request` y formato estructurado, impidiendo que peticiones vacías alcancen la capa de servicios.
- [x] **CA-09 (Manejo de indisponibilidad de IA)**: Si el proveedor de inferencia falla tras sus reintentos, el sistema retorna HTTP `503 Service Unavailable` con código `AI_SERVICE_UNAVAILABLE` y mensaje descriptivo, sin exponer tokens ni trazas internas.
- [x] **CA-10 (Cortocircuito por coincidencia textual exacta)**: Dado un texto normalizado que coincide exactamente (insensible a mayúsculas/minúsculas y espacios colapsados) con una frase persistida, el sistema omite completamente la llamada al proveedor de inferencia externa; `POST /api/phrases/validate` retorna inmediatamente `isDuplicate: true`, `similarityScore: 1.0000` y la frase coincidente; y `POST /api/phrases` (con `confirmDuplicate: true`) reutiliza directamente el vector `embedding` persistido de la frase idéntica para guardar el registro.
- [x] **CA-11 (Reutilización de embedding en caché entre validación y guardado)**: Dado un texto validado exitosamente en `POST /api/phrases/validate` que requirió inferencia, cuando el cliente envía seguidamente `POST /api/phrases` con el mismo texto dentro de la ventana de vida de la caché (TTL de 1 hora), el servicio reutiliza el vector almacenado en memoria sin realizar una nueva llamada de red a Hugging Face.
- [x] **CA-12 (Protección contra abuso mediante Rate Limiting y Trust Proxy)**: Cuando una dirección IP de cliente real (resuelta confiando en el proxy reverso mediante `trust proxy`) sobrepasa el límite de peticiones por minuto (30 req/min en inferencia `POST /validate` y `POST /phrases`; 100 req/min en lectura `GET /phrases`), el servidor interrumpe la ejecución respondiendo con HTTP `429 Too Many Requests`, código `RATE_LIMIT_EXCEEDED`, cabecera estándar `Retry-After` y formato JSON canónico sin tocar la base de datos ni consumir cuota de IA.
- [x] **CA-13 (Hardening HTTP y Cabeceras de Seguridad)**: Toda respuesta del servidor incluye cabeceras de seguridad generadas por `helmet` (ocultamiento de `X-Powered-By`, prevención de sniffing MIME `X-Content-Type-Options: nosniff`, prevención de Clickjacking `X-Frame-Options: SAMEORIGIN`) y control estricto de orígenes CORS autorizado según variable de entorno.
- [x] **CA-14 (Sonda de Salud Ultraligera)**: Cuando se solicita `GET /api/health`, el servidor responde inmediatamente con HTTP `200 OK` y `{ success: true, data: { status: "healthy", timestamp: string } }` sin pasar por limitadores de inferencia ni ejecutar consultas externas, apto para sondas de Docker y Fly.io.
- [x] **CA-15 (Manejo Resiliente de Fallos en Base de Datos)**: Si la conexión a PostgreSQL falla o se agota el pool de conexiones, el middleware global intercepta el error y responde con HTTP `500 Internal Server Error`, código `DATABASE_ERROR` y mensaje seguro, sin filtrar credenciales ni cadenas de conexión.

## Requisitos funcionales
- **RF-1 (Configuración de Entorno Estricta con Zod)**:
  El sistema debe validar todas las variables de entorno requeridas en el arranque (`src/config/env.ts`):
  - `DATABASE_URL`: Cadena de conexión válida a PostgreSQL.
  - `HF_TOKEN`: Cadena de texto no vacía con el token de Hugging Face.
  - `HF_MODEL`: Identificador del modelo (default: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`).
  - `SIMILARITY_THRESHOLD`: Número flotante en el rango `(0.0, 1.0]` (default: `0.80`).
  - `PORT`: Número entero positivo para el puerto del servidor (default: `3000`).
  - `TRUST_PROXY`: Número entero o booleano para configurar la confianza en el proxy inverso (default: `1`, optimizado para Fly.io).
  - `EMBEDDING_CACHE_TTL_SECONDS`: Número entero positivo para la expiración de embeddings en caché (default: `3600`, equivalente a 1 hora).
  - `RATE_LIMIT_WINDOW_MS`: Ventana de tiempo para el limitador de tasa en milisegundos (default: `60000`, equivalente a 1 minuto).
  - `RATE_LIMIT_INFERENCE_MAX`: Límite máximo de peticiones por ventana para endpoints de inferencia/escritura (default: `30`).
  - `RATE_LIMIT_READ_MAX`: Límite máximo de peticiones por ventana para endpoints de consulta (default: `100`).
  - `CORS_ORIGINS`: Lista de orígenes autorizados separados por coma (default: `http://localhost:5173,http://localhost:3000`).
  Si alguna variable es inválida o no está presente, la aplicación debe interrumpir su arranque con un mensaje claro descriptivo.

- **RF-2 (Capa de Acceso a Datos `PhraseRepository`)**:
  Debe encapsular las operaciones con Drizzle ORM sobre la tabla `phrases` utilizando propiedades en `camelCase` en TypeScript (mapeadas directamente en el esquema Drizzle a las columnas SQL) para que todo el dominio, repositorio y transporte operen 100% en `camelCase` de forma nativa sin conversiones manuales:
  - `create(phraseData)`: Inserta un nuevo registro con su texto, embedding (`JSONB`), score, id referencial y estado de validación, retornando la entidad persistida en `camelCase`.
  - `findAll(options)`: Consulta frases con soporte de paginación (`page`, `limit`), ordenamiento determinista por `created_at DESC, id DESC`, filtro opcional por `validation_status`, excluyendo la columna `embedding` del resultado e incluyendo información básica de la frase asociada si `similar_to_id` no es nulo.
  - `countAll(filter)`: Retorna el número total de frases registradas para el cálculo de páginas.
  - `getAllEmbeddings()`: Retorna exclusivamente `{ id, text, embedding }` de todas las frases registradas para el proceso de comparación vectorial en memoria.
  - `findByExactText(normalizedText: string)`: Realiza una búsqueda insensible a mayúsculas/minúsculas (`LOWER(text) = LOWER(?)`) para identificar rápidamente coincidencias literales exactas.

- **RF-3 (Servicio de Dominio `PhraseService`)**:
  Debe orquestar el flujo de validación y persistencia utilizando inyección de dependencias (`EmbeddingProvider`, `PhraseRepository`, `EmbeddingCache` y `SIMILARITY_THRESHOLD`):
  - `validatePhrase(text: string)`:
    1. Normaliza el texto (`trim()` y colapso de secuencias de espacios en blanco `\s+` a un solo espacio).
    2. **Paso de Cortocircuito Exacto**: Consulta `PhraseRepository.findByExactText(normalizedText)`. Si existe una frase idéntica, retorna inmediatamente `isDuplicate: true`, `similarityScore: 1.0000`, `threshold: SIMILARITY_THRESHOLD` y `similarPhrase: { id, text }`, sin consultar la caché ni invocar al proveedor de IA.
    3. **Paso de Obtención de Embedding**: Consulta `EmbeddingCache.get(normalizedText)`. Si hay acierto de caché (*cache hit*), reutiliza el vector. Si hay fallo de caché (*cache miss*), genera el embedding con `EmbeddingProvider`, almacenándolo en `EmbeddingCache.set(normalizedText, embedding, ttl)`.
    4. Consulta los embeddings persistidos en el catálogo mediante `PhraseRepository.getAllEmbeddings()`.
    5. Si el catálogo está vacío, retorna `isDuplicate: false`, `similarityScore: null`, `similarPhrase: null`.
    6. Si hay frases en el catálogo, calcula la similitud coseno contra cada una usando `calculateCosineSimilarity`.
    7. Identifica la frase con el puntaje más alto. Retorna `similarPhrase: { id, text }` y `similarityScore` de dicha frase más afín. Evalúa `isDuplicate = similarityScore >= SIMILARITY_THRESHOLD`. De este modo, la UI siempre recibe la frase más afín encontrada junto con su puntaje de afinidad.
  - `createPhrase(text: string, confirmDuplicate: boolean)`:
    1. Normaliza el texto entrante.
    2. Ejecuta la validación semántica interna contra el catálogo.
    3. Si resulta en duplicado (`isDuplicate: true`) y `confirmDuplicate` es `false` o no fue provisto, interrumpe el flujo emitiendo un error estructurado de duplicado semántico (`DuplicatePhraseError`).
    4. Si resulta en duplicado y `confirmDuplicate` es `true`:
       - Si fue coincidencia exacta de texto, extrae y reutiliza el vector `embedding` directamente de la frase idéntica encontrada, con `similarity_score = 1.0000`.
       - Si fue duplicado semántico por umbral, obtiene el embedding (desde `EmbeddingCache` o proveedor) y persiste con `validation_status = 'CONFIRMED_DUPLICATE'`, `similar_to_id` y `similarity_score`.
    5. Si no es duplicado, obtiene el embedding (desde `EmbeddingCache` o proveedor) y persiste con `validation_status = 'UNIQUE'`, `similar_to_id = NULL` y `similarity_score = NULL`.
  - `listPhrases(page: number, limit: number, status?: ValidationStatus)`:
    Calcula offsets, consulta el repositorio ordenando por `created_at DESC, id DESC` y retorna los registros paginados serializados en `camelCase` junto con los metadatos de paginación.

- **RF-4 (Endpoints HTTP Express y Validación Zod)**:
  - `GET /api/health`:
    - Endpoint público exento de limitadores de inferencia.
    - Responde `200 OK` con `{ success: true, data: { status: 'healthy', timestamp: new Date().toISOString() } }`.
  - `POST /api/phrases/validate`:
    - Valida body con Zod aplicando saneamiento temprano: `{ text: z.string().trim().min(1, 'Phrase cannot be empty').max(280) }`.
    - Responde `200 OK` con `{ success: true, data: { isDuplicate, similarityScore, threshold, similarPhrase } }`.
  - `POST /api/phrases`:
    - Valida body con Zod aplicando saneamiento temprano: `{ text: z.string().trim().min(1, 'Phrase cannot be empty').max(280), confirmDuplicate: z.boolean().optional().default(false) }`.
    - Si detecta duplicado no confirmado, responde `409 Conflict` con `{ success: false, error: { code: 'DUPLICATE_PHRASE_DETECTED', message: 'Potential semantic duplicate detected', details: { similarityScore, threshold, similarPhrase } } }`.
    - Si es exitoso, responde `201 Created` con `{ success: true, data: { id, text, validationStatus, similarityScore, similarToId, createdAt } }`.
  - `GET /api/phrases`:
    - Valida query con Zod: `{ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(10), status: z.enum(['UNIQUE', 'CONFIRMED_DUPLICATE']).optional() }`.
    - Responde `200 OK` con `{ success: true, data: { items: [...], pagination: { page, limit, total, totalPages } } }`.

- **RF-5 (Manejo Centralizado de Errores y Middlewares de Transporte y Seguridad)**:
  - **Configuración de Proxy Inverso (`trust proxy`)**: Configura en la aplicación Express `app.set('trust proxy', config.TRUST_PROXY)` para desempaquetar correctamente `X-Forwarded-For` en Fly.io y evitar que todas las peticiones compartan la IP interna del proxy.
  - **Middleware Rate Limiter**: Configura dos limitadores basados en `express-rate-limit`:
    - `inferenceLimiter`: Aplica exclusivamente a `/api/phrases/validate` y `POST /api/phrases` limitando a `RATE_LIMIT_INFERENCE_MAX` req/min por IP real.
    - `readLimiter`: Aplica a rutas de consulta (`GET /api/phrases`) limitando a `RATE_LIMIT_READ_MAX` req/min por IP real.
    - La ruta `/api/health` queda totalmente exenta de `inferenceLimiter`.
  - **Middleware Helmet**: Inyecta cabeceras de seguridad HTTP estándar para prevenir ataques web comunes.
  - **Middleware CORS**: Restringe orígenes a la lista blanca de `CORS_ORIGINS`, permitiendo métodos `GET, POST, OPTIONS` y cabeceras `Content-Type`.
  - **Middleware de Content-Type**: Verifica en peticiones `POST` que el encabezado sea estrictamente `Content-Type: application/json`; rechaza tipos incompatibles con HTTP `415 Unsupported Media Type`.
  - **Middleware JSON**: Parser con límite restrictivo de tamaño (`express.json({ limit: '10kb' })`) para neutralizar ataques de denegación de servicio por memoria.
  - **Middleware Global de Errores**: Captura centralizada que mapea errores (`ZodError`, `DuplicatePhraseError`, `ExternalAIProviderError`, `EmptyTextError`, `RateLimitExceeded`, `DatabaseError`) al formato canónico `{ success: false, error }`, ofuscando trazas de depuración y consultas de base de datos en entornos de producción.

- **RF-6 (Contrato e Implementación de Caché LRU `EmbeddingCache` con `lru-cache`)**:
  - Interfaz abstracta `EmbeddingCache`:
    - `get(key: string): Promise<number[] | null> | number[] | null`
    - `set(key: string, embedding: number[], ttlSeconds?: number): Promise<void> | void`
    - `delete(key: string): Promise<void> | void`
    - `clear(): Promise<void> | void`
  - Implementación en memoria (`InMemoryEmbeddingCache`):
    - Utiliza la librería estándar de la industria [`lru-cache`](https://www.npmjs.com/package/lru-cache) para gestión hiperoptimizada de estructuras LRU en el motor V8.
    - Almacena vectores en memoria asociados a la clave normalizada (`normalizedText.toLowerCase()`).
    - Aplica expiración por TTL (configurable vía `EMBEDDING_CACHE_TTL_SECONDS`, default 1 hora = 3600s).
    - Implementa política de expulsión estricta **LRU (*Least Recently Used*)** con capacidad máxima de 1,000 entradas (`max: 1000`).
    - Su diseño mediante interfaz abstracta permite sustituirla a futuro por un cliente distribuido (ej. Redis) sin modificar la capa de servicios.

- **RF-7 (Arquitectura Modular de Rutas y Ensamblaje de Dependencias)**:
  - Cada archivo de rutas (ej. `src/routes/phraseRoutes.ts`) es autónomo y encapsula el ensamblaje de su cadena de dependencias (`Repository` -> `Service` -> `Controller` -> `Router`).
  - Utiliza la instancia única compartida (singleton) del cliente/pool de base de datos exportada desde `src/db/index.ts`, evitando recrear conexiones por ruta.
  - Exporta el `Router` como exportación por defecto (`export default router`), permitiendo que `src/app.ts` permanezca conciso y desacoplado ante la incorporación de nuevos módulos (`app.use('/api/phrases', phraseRoutes)`).
  - Los controladores y servicios continúan recibiendo sus dependencias mediante inyección en el constructor para permitir su testeo unitario aislado con mocks sin tocar los archivos de rutas.

## Requisitos no funcionales
- **RNF-1 (Latencia de Endpoints)**: El tiempo de respuesta de `POST /api/phrases/validate` y `POST /api/phrases` no debe exceder 1.5 segundos en condiciones normales de inferencia, debe ser inferior a 50 ms cuando se activa el cortocircuito exacto o el acierto de caché de embeddings, y `GET /api/phrases` y `GET /api/health` deben responder en menos de 100 ms y 10 ms respectivamente, cumpliendo con `specs/mission.md`.
- **RNF-2 (Formato Estandarizado y Nomenclatura CamelCase)**: Toda respuesta HTTP debe cumplir obligatoriamente la convención de `specs/constitution.md` (Sección 2.2), asegurando `{ success: true, data: ... }` para éxitos y `{ success: false, error: { code, message, details } }` para fallos, con todos los identificadores de propiedad serializados en `camelCase`.
- **RNF-3 (Seguridad y Manejo de Secretos)**: Las credenciales (`HF_TOKEN`, `DATABASE_URL`) deben permanecer estrictamente aisladas en variables de entorno, sin filtrarse en respuestas de error, trazas de depuración ni payloads, conforme a `specs/constitution.md` (Sección 3.1).
- **RNF-4 (Aislamiento de Tests y Dependencias de Red)**: Las suites de integración con `supertest` deben inyectar una instancia de `MockEmbeddingProvider` y una instancia limpia de `InMemoryEmbeddingCache`, deshabilitando o aislando los rate limiters para evitar falsos positivos en suites de test veloces, cumpliendo con `specs/constitution.md` (Sección 1.2 y 4.1).
- **RNF-5 (Tipado Estricto sin `any`)**: Todo el código de controladores, servicios, repositorios, cachés, middlewares y esquemas Zod debe compilar con TypeScript `"strict": true` sin recurrir a tipos `any`, alineado a `specs/constitution.md` (Sección 4.3).
- **RNF-6 (Eficiencia de Cuota y Red)**: El sistema debe minimizar el consumo de la API externa de inferencia mediante la combinación obligatoria del cortocircuito de coincidencia textual exacta y la caché de embeddings con TTL de 1 hora.
- **RNF-7 (Protección Activa contra Abuso y Agotamiento de Cuota - Anti-Abuse con Trust Proxy)**: La API debe mitigar activamente ataques de denegación de servicio (DoS) y consumo desmedido de inferencia mediante limitación de tasa por IP real del cliente (resolviendo adecuadamente los encabezados de Fly.io con `trust proxy`), garantizando que un cliente malicioso o un bucle cliente no agote la cuota de Hugging Face ni afecte globalmente a otros usuarios.
- **RNF-8 (Hardening de Capa de Transporte HTTP)**: Se debe implementar `helmet` para aplicar cabeceras de protección defensiva en profundidad y configurar políticas restrictivas de CORS para aceptar únicamente peticiones de los dominios frontend explícitamente autorizados.
- **RNF-9 (Ofuscación y Sanitización de Errores)**: El sistema nunca debe filtrar información de infraestructura (trazas de error completas, detalles de conexión PostgreSQL, drivers o mensajes directos de Hugging Face con URLs internas) en las respuestas de error al cliente en producción.
- **RNF-10 (Disponibilidad y Sondas para Contenedores)**: La aplicación debe proveer un endpoint ultraligero de health check (`/api/health`) que responda en menos de 10 ms sin consumo de base de datos ni red externa, garantizando chequeos fiables para Docker y Fly.io sin disparar falsos positivos de indisponibilidad.
- **RNF-11 (Determinismo y Optimización en Paginación)**: La paginación en base de datos debe ser determinista ordenando por `created_at DESC, id DESC`, soportada por un índice compuesto en la base de datos para garantizar lecturas directas en tiempo inferior a 10 ms sin ordenamientos costosos en memoria.

## Casos extremos
- **CE-1 (Validación y guardado con catálogo inicialmente vacío)**: Cuando no existe ninguna frase en la base de datos, `validate` retorna `isDuplicate: false`, `similarityScore: null` y `similarPhrase: null`. `create` persiste con `validation_status = 'UNIQUE'`, `similar_to_id = NULL` y `similarity_score = NULL` sin fallar ni disparar divisiones inválidas.
- **CE-2 (Texto idéntico al 100% case-insensitive / Cortocircuito exacto)**: Si un usuario introduce una frase cuyo texto normalizado coincide exactamente con una existente, el sistema activa el cortocircuito exacto: no contacta a Hugging Face ni a la caché, devuelve score `1.0000`, emite `409 Conflict` si `confirmDuplicate` no es `true`, y si el usuario confirma (`confirmDuplicate: true`), reutiliza el vector ya almacenado en base de datos para persistir el nuevo registro con cero llamadas de IA.
- **CE-3 (Múltiples frases superan el umbral simultáneamente)**: Si la frase candidata supera el umbral frente a dos o más frases del catálogo (ej. similar a frase A con 0.85 y a frase B con 0.92), el sistema debe asociar el duplicado a la frase de máxima afinidad (frase B con score 0.9200).
- **CE-4 (Paginación fuera de rango)**: Si se solicita una página superior a las existentes (ej. `page=999` cuando solo hay 2 páginas), el endpoint `GET /api/phrases` no debe fallar; debe retornar `items: []` y los metadatos correspondientes (`page: 999, total, totalPages`).
- **CE-5 (Indisponibilidad o timeout de Hugging Face en endpoints)**: Si el servicio de Hugging Face está saturado, en arranque en frío tras los reintentos, o excede el tiempo límite, los endpoints deben capturar la excepción y responder inmediatamente con HTTP `503 Service Unavailable` (`AI_SERVICE_UNAVAILABLE`), evitando que el servidor Express quede colgado o se reinicie.
- **CE-6 (Payload malicioso o de tamaño desmedido)**: Si se envían cadenas de texto con caracteres de escape, intentos de inyección o cuerpos mayores a 10kb, el middleware de Express y la validación Zod rechazan la petición inmediatamente con HTTP `400 Bad Request` o `413 Payload Too Large`.
- **CE-7 (Expiración o fallo de acierto en caché de embeddings)**: Si la entrada en caché expira (después de 1 hora) o se reinicia el servidor entre el momento de validación y la confirmación de guardado, el sistema ejecuta de forma transparente un *fallback* generando el embedding mediante el proveedor sin provocar errores al usuario final.
- **CE-8 (Ráfaga masiva o abuso tras proxy inverso de Fly.io)**: Si una IP real sobrepasa el límite por ráfagas concurrentes, el servidor (gracias a `app.set('trust proxy', 1)`) bloquea exclusivamente a dicha IP con HTTP `429 Too Many Requests` y `RATE_LIMIT_EXCEEDED`, evitando el bloqueo accidental colectivo de todos los usuarios de la plataforma por compartir la IP interna del proxy de Fly.io.
- **CE-9 (Headers anómalos o Content-Type incompatible)**: Peticiones `POST` con encabezado `Content-Type` diferente a `application/json` (ej. `text/plain`, `multipart/form-data` o ausente) son rechazadas de inmediato con HTTP `415 Unsupported Media Type` antes de que el body parser procese la solicitud.
- **CE-10 (Texto compuesto únicamente por espacios en blanco o caracteres invisibles)**: Si una petición contiene `"   "` o secuencias vacías, el esquema Zod aplica `.trim().min(1)` y la rechaza inmediatamente en el controlador con HTTP `400 Bad Request` sin permitir que alcance la capa de servicios ni consuma recursos computacionales innecesarios.
- **CE-11 (Fallo de conexión o indisponibilidad de PostgreSQL)**: Si la base de datos se torna inaccesible o agota el pool de conexiones durante una operación, el middleware global intercepta la excepción técnica y responde con HTTP `500 Internal Server Error`, código `DATABASE_ERROR` y mensaje estandarizado, previniendo fugas de cadenas de conexión o nombres de tablas en el log del cliente.

## Changelog de la Especificación
- **2026-10-21 (Creación inicial)**: Especificación inicial para la funcionalidad `002-phrase-validation-api` (API REST y Lógica de Negocio), incorporando decisiones de persistencia confirmada (409 Conflict), paginación formal y exclusión de vectores en listados acordadas con el usuario.
- **2026-10-21 (Refinamiento: Cortocircuito y Caché de Embeddings)**: Incorporación de optimizaciones críticas de cuota y latencia:
  - Adición del cortocircuito de coincidencia textual exacta (case-insensitive) con score 1.0000 y reutilización de vector persistido (CU-6, CA-10, RF-2, RF-3, RNF-1, CE-2).
  - Adición del contrato `EmbeddingCache` y la implementación desacoplada en memoria `InMemoryEmbeddingCache` con TTL de 1 hora y capacidad máxima acotada para evitar doble inferencia entre validación y guardado (CU-7, CA-11, RF-1, RF-3, RF-6, RNF-6, CE-7).
- **2026-10-21 (Refinamiento: Hardening de Seguridad y Protección Anti-Abuso)**:
  - Adición de limitadores de tasa granulares por IP (`express-rate-limit`) diferenciando rutas pesadas de inferencia (30 req/min) de rutas de lectura (100 req/min) con retorno estándar HTTP `429 Too Many Requests` (CU-8, CA-12, RF-1, RF-5, RNF-7, CE-8).
  - Adición de cabeceras de seguridad HTTP con `helmet` y políticas restrictivas de CORS configurables por entorno (CA-13, RF-1, RF-5, RNF-8).
  - Validación de encabezado estricto `Content-Type: application/json` con HTTP `415 Unsupported Media Type` (RF-5, CE-9).
  - Sanitización y ofuscación obligatoria de trazas de infraestructura y base de datos en errores de producción (RF-5, RNF-9).
- **2026-10-21 (Refinamiento: Configuración de Fly.io, Saneamiento Zod y Health Check)**:
  - Configuración explícita de `trust proxy` en Express y validación de variable `TRUST_PROXY` para asegurar que el rate limiting opere sobre la IP del cliente real y no sobre el proxy de Fly.io (CA-12, RF-1, RF-5, RNF-7, CE-8).
  - Saneamiento y validación temprana con `z.string().trim().min(1).max(280)` en esquemas Zod de entrada, garantizando que textos con solo espacios en blanco sean rechazados con `400 Bad Request` en el transporte (CA-08, RF-4, CE-10).
  - Adición de endpoint ultraligero `GET /api/health` exento de limitadores de inferencia para comprobaciones de estado de Fly.io y Docker (CU-9, CA-14, RF-4, RF-5, RNF-10).
- **2026-10-21 (Clarificación y Blindaje SDD - Skill clarify)**:
  - Formalización del contrato de respuesta de pre-validación informativa: `POST /api/phrases/validate` siempre reporta el score máximo y la frase más cercana encontrada (incluso si está por debajo del umbral), reservando `null` únicamente para el estado inicial de catálogo vacío (CU-1, CA-01, RF-3).
  - Especificación de política de desalojo **LRU** en `InMemoryEmbeddingCache` al llegar al límite de 1,000 entradas (RF-6).
  - Convención explícita de serialización en `camelCase` para todas las entidades en la capa HTTP (RF-2, RF-3, RNF-2).
  - Adición de manejo resiliente y tipado ante caídas de PostgreSQL con código `DATABASE_ERROR` (CA-15, RF-5, CE-11).
  - Ordenamiento determinista con índice compuesto `(created_at DESC, id DESC)` para optimización de paginación en base de datos (CA-06, RF-2, RF-3, RNF-11).
- **2026-10-21 (Refactorización Modular y Adopción de lru-cache)**:
  - Adopción de la librería `lru-cache` de npm para la gestión en memoria de embeddings.
  - Ensamblaje modular de la cadena de dependencias en `phraseRoutes.ts` con exportación por defecto del `Router` y singleton compartido de base de datos (`db`), manteniendo `app.ts` desacoplado y conciso ante nuevos módulos.
