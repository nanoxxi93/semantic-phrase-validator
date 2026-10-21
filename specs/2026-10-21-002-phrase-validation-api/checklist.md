# Lista de Comprobación y QA: 002-phrase-validation-api

## Entornos de Prueba Requeridos
- [ ] Contenedor PostgreSQL 17 (`postgres:17-alpine`) ejecutándose mediante Docker Compose (`docker compose up -d`).
- [ ] Entorno CLI / Node.js (Node.js v24+ y TypeScript en `backend/`).
- [ ] Suite de pruebas automatizadas con Vitest y `supertest` (`npm test` en `backend/`).
- [ ] Cliente HTTP / Postman / curl para verificación manual de endpoints y cabeceras de seguridad.

---

## Casos de Prueba (Criterios de Aceptación)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| **CA-01** | CLI / Supertest | 1. Enviar `POST /api/phrases/validate` con `{ "text": "Frase nueva sin duplicados" }` cuando el catálogo está vacío.<br>2. Probar posteriormente cuando existen frases en catálogo pero la similitud es < 0.80. | En catálogo vacío: retorna `200 OK`, `isDuplicate: false`, `similarityScore: null` y `similarPhrase: null`.<br>Con catálogo no vacío: retorna `200 OK`, `isDuplicate: false`, `similarityScore` numérico de la frase más afín encontrada y `similarPhrase: { id, text }`. | [ ] | |
| **CA-02** | CLI / Supertest | 1. Insertar una frase en la base de datos (ej. "Cancelar recibo de luz pendiente").<br>2. Enviar `POST /api/phrases/validate` con una paráfrasis clara (ej. "Pagar la factura eléctrica"). | Retorna `200 OK`, `isDuplicate: true`, `similarityScore` redondeado a 4 decimales (>= 0.8000), `threshold: 0.8000` y `similarPhrase` con el `{ id, text }` de la frase persistida. | [ ] | |
| **CA-03** | CLI / Supertest | 1. Enviar `POST /api/phrases` con una frase conceptualmente única `{ "text": "Idea completamente original" }`. | Retorna `201 Created` con `{ id, text, validationStatus: 'UNIQUE', similarityScore: null, similarToId: null, createdAt }` serializado en camelCase y omitiendo estrictamente el array `embedding`. | [ ] | |
| **CA-04** | CLI / Supertest | 1. Enviar `POST /api/phrases` con un texto que supera el umbral de similitud frente a una frase existente, omitiendo `confirmDuplicate` o enviando `confirmDuplicate: false`. | Retorna `409 Conflict` con código `DUPLICATE_PHRASE_DETECTED`, mensaje descriptivo y detalles del duplicado (`similarityScore`, `threshold`, `similarPhrase`). No se persiste el registro en PostgreSQL. | [ ] | |
| **CA-05** | CLI / Supertest | 1. Enviar `POST /api/phrases` con una frase duplicada pero enviando `{ "text": "...", "confirmDuplicate": true }`. | Retorna `201 Created` con `validationStatus: 'CONFIRMED_DUPLICATE'`, `similarToId` enlazado a la frase coincidente y `similarityScore` correspondiente en formato numérico. | [ ] | |
| **CA-06** | CLI / Supertest | 1. Registrar 15 frases en la base de datos.<br>2. Enviar `GET /api/phrases?page=1&limit=10`. | Retorna `200 OK` con `items` conteniendo 10 elementos ordenados por `created_at DESC, id DESC`, metadatos de paginación (`page: 1, limit: 10, total: 15, totalPages: 2`) y ninguna entidad incluye el vector `embedding`. | [ ] | |
| **CA-07** | CLI / Supertest | 1. Consultar `GET /api/phrases?status=UNIQUE`.<br>2. Consultar `GET /api/phrases?status=CONFIRMED_DUPLICATE`. | Retorna únicamente los registros que coinciden con el estado especificado y actualiza coherentemente el total de páginas. | [ ] | |
| **CA-08** | CLI / Supertest | 1. Enviar `POST /api/phrases/validate` con `{ "text": "" }`, `{ "text": "    " }` (espacios en blanco) o texto mayor a 280 caracteres.<br>2. Enviar `GET /api/phrases?page=0` o `limit=500`. | El middleware Zod rechaza la solicitud de inmediato con `400 Bad Request` y desglose de errores, sin permitir ejecución en la capa de servicios. | [ ] | |
| **CA-09** | CLI / Supertest | 1. Simular falla o indisponibilidad en `EmbeddingProvider` (ej. Hugging Face 503 tras reintentos agotados).<br>2. Enviar `POST /api/phrases/validate`. | El servidor responde con HTTP `503 Service Unavailable`, código `AI_SERVICE_UNAVAILABLE` y mensaje seguro, sin filtrar tokens ni credenciales en la respuesta. | [ ] | |
| **CA-10** | CLI / Supertest | 1. Registrar la frase "Comprar pan fresco".<br>2. Enviar `POST /api/phrases/validate` con `"  comprar   PAN fresco  "` (mismo texto normalizado case-insensitive).<br>3. Enviar `POST /api/phrases` con `confirmDuplicate: true`. | `POST /validate` responde instantáneamente con `similarityScore: 1.0000`, `isDuplicate: true` y 0 llamadas al proveedor de IA.<br>`POST /phrases` guarda el duplicado reutilizando el vector ya existente en base de datos. | [ ] | |
| **CA-11** | CLI / Supertest | 1. Enviar `POST /api/phrases/validate` con un texto que requiera inferencia.<br>2. Inmediatamente enviar `POST /api/phrases` con el mismo texto.<br>3. Verificar llamadas al proveedor de IA. | El guardado recupera el vector directamente de `InMemoryEmbeddingCache`, realizando un total de 1 sola llamada de inferencia para todo el flujo. | [ ] | |
| **CA-12** | CLI / Supertest | 1. Configurar `trust proxy = 1` y enviar ráfagas de peticiones desde una misma IP simulando `X-Forwarded-For`.<br>2. Superar el límite de 30 req/min en `POST /validate`. | A partir de la petición 31, el servidor bloquea con HTTP `429 Too Many Requests`, cabecera `Retry-After: <segundos>` y código `RATE_LIMIT_EXCEEDED` sin tocar DB ni IA. | [ ] | |
| **CA-13** | Postman / curl | 1. Enviar una petición a cualquier endpoint del API.<br>2. Inspeccionar los encabezados HTTP de la respuesta. | Se verifica la presencia de cabeceras de seguridad inyectadas por `helmet` (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, ausencia de `X-Powered-By`) y cabeceras CORS de orígenes autorizados. | [ ] | |
| **CA-14** | CLI / Supertest | 1. Enviar `GET /api/health`. | Responde inmediatamente en < 10 ms con HTTP `200 OK` y `{ success: true, data: { status: "healthy", timestamp: "..." } }`, exento de rate limits. | [ ] | |
| **CA-15** | CLI / Supertest | 1. Simular caída de conexión con PostgreSQL o error de pool.<br>2. Enviar una petición a `GET /api/phrases`. | Retorna HTTP `500 Internal Server Error` con código `DATABASE_ERROR` y mensaje genérico seguro sin filtrar cadenas de conexión ni nombres de esquemas. | [ ] | |

---

## Pruebas de Casos Extremos (Edge Cases)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| **CE-1** | CLI / Supertest | 1. Ejecutar validación y guardado cuando la tabla `phrases` está vacía. | Ambas operaciones operan de forma segura: `isDuplicate: false`, y el primer registro se guarda con `validation_status = 'UNIQUE'`, `similar_to_id = NULL` y `similarity_score = NULL`. | [ ] | |
| **CE-2** | CLI / Supertest | 1. Registrar una frase.<br>2. Intentar guardar exactamente la misma frase sin confirmación. | Responde con `409 Conflict` activando el cortocircuito exacto con score `1.0000` sin consumir cuota de Hugging Face. | [ ] | |
| **CE-3** | CLI / Supertest | 1. Persistir frase A y frase B en catálogo.<br>2. Enviar una frase que supere el umbral frente a ambas (ej. similar a A con 0.83 y a B con 0.91). | El sistema asocia el duplicado exclusivamente a la frase de máxima afinidad (frase B con score 0.9100). | [ ] | |
| **CE-4** | CLI / Supertest | 1. Enviar `GET /api/phrases?page=999`. | Responde `200 OK` con `items: []`, `page: 999`, `total: X`, `totalPages: Y` sin disparar errores internos de base de datos. | [ ] | |
| **CE-5** | CLI / Supertest | 1. Simular timeout prolongado de la red de Hugging Face (> 5000 ms). | Se captura la excepción y se mapea a HTTP `503 Service Unavailable` con código `AI_SERVICE_UNAVAILABLE`. | [ ] | |
| **CE-6** | CLI / Supertest | 1. Enviar una petición `POST` con cuerpo JSON mayor a 10 KB (ej. cadena de 15,000 caracteres repetitivos). | El middleware de Express rechaza la solicitud de inmediato con HTTP `413 Payload Too Large` sin colapsar la memoria del proceso. | [ ] | |
| **CE-7** | CLI / Supertest | 1. Validar una frase.<br>2. Forzar limpieza o expiración de la entrada en `InMemoryEmbeddingCache`.<br>3. Confirmar guardado de la frase. | El servicio ejecuta un fallback transparente calculando el embedding mediante el proveedor sin interrumpir el flujo del usuario. | [ ] | |
| **CE-8** | CLI / Supertest | 1. Simular ráfaga de peticiones desde dos IPs distintas a través de `X-Forwarded-For`.<br>2. Sobrepasar el límite en una sola de las IPs. | El servidor bloquea con `429 Too Many Requests` únicamente a la IP abusadora; la IP legítima sigue recibiendo respuestas exitosas `200 OK`. | [ ] | |
| **CE-9** | CLI / Supertest | 1. Enviar `POST /api/phrases/validate` con encabezado `Content-Type: text/plain` o `multipart/form-data`. | El servidor rechaza la petición con HTTP `415 Unsupported Media Type` antes de procesar el body. | [ ] | |
| **CE-10** | CLI / Supertest | 1. Enviar `POST /api/phrases` con body `{"text": "    "}`. | Es interceptado en el schema Zod y rechazado con `400 Bad Request` con mensaje `'Phrase cannot be empty'`. | [ ] | |
| **CE-11** | CLI / Supertest | 1. Forzar error de conexión en `PhraseRepository` simulando corte de socket PostgreSQL. | El middleware de error retorna `500 Internal Server Error` estructurado con código `DATABASE_ERROR` y mensaje sanitizado. | [ ] | |
