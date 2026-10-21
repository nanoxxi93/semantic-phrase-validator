# Lista de Comprobación y QA: 001-core-semantic-engine

## Entornos de Prueba Requeridos
- [ ] Contenedor PostgreSQL 17 (`postgres:17-alpine`) ejecutándose mediante Docker Compose (`docker compose up -d`).
- [ ] Entorno CLI / Node.js (Node.js v24+ y TypeScript en `backend/`).
- [ ] Suite de pruebas automatizadas con Vitest (`npm test` en `backend/`).

---

## Casos de Prueba (Criterios de Aceptación)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| **CA-01** | CLI / Vitest | 1. Invocar `calculateCosineSimilarity` pasando dos vectores numéricos idénticos no nulos de 384 elementos. | Retorna exactamente `1.0000`. | [ ] | Coincidencia idéntica absoluta. |
| **CA-02** | CLI / Vitest | 1. Invocar `calculateCosineSimilarity` con dos vectores ortogonales de 384 dimensiones (ej. base canónica $[1, 0, ...]$ y $[0, 1, ...]$). | Retorna exactamente `0.0000`. | [ ] | Ortogonalidad vectorial estricta. |
| **CA-03** | CLI / Vitest | 1. Proveer una frase con espacios redundantes (`"  hola    mundo  \n"`).<br>2. Invocar `generateEmbedding` en el proveedor.<br>3. Evaluar el resultado obtenido. | La frase es normalizada internamente (`"hola mundo"`) y la promesa resuelve a un array de exactamente 384 números de coma flotante. | [ ] | Normalización y contrato dimensional. |
| **CA-04** | CLI / PostgreSQL | 1. Levantar PostgreSQL 17 con Docker.<br>2. Ejecutar migración SQL inicial con Drizzle.<br>3. Insertar una frase con su embedding JSONB, `similarity_score` en rango decimal y `similar_to_id` asociado.<br>4. Consultar el registro insertado. | El registro se recupera íntegro desde PostgreSQL con todos sus metadatos almacenados de forma consistente. | [ ] | Persistencia y fidelidad relacional. |
| **CA-05** | CLI / Vitest | 1. Invocar `calculateCosineSimilarity` con vectores cuyos productos produzcan decimales infinitos o pequeñas desviaciones flotantes.<br>2. Inspeccionar el valor devuelto. | El resultado está acotado en `[0.0000, 1.0000]` y redondeado exactamente a 4 cifras decimales sin valores como `1.0000000000000002`. | [ ] | Control de precisión numérica. |
| **CA-06** | CLI / PostgreSQL | 1. Insertar una frase A en la base de datos.<br>2. Insertar una frase B con `similar_to_id = frase_A.id`.<br>3. Eliminar la frase A de la tabla `phrases`.<br>4. Consultar la frase B. | La frase B conserva su registro y su campo `similar_to_id` pasa automáticamente a `NULL` (`ON DELETE SET NULL`) sin violar restricciones de FK. | [ ] | Integridad referencial en ciclo de vida. |
| **CA-07** | CLI / Vitest | 1. Invocar `generateEmbedding` en `MockEmbeddingProvider` repetidas veces para el mismo texto sin red ni token.<br>2. Probar con un fixture inyectado. | Devuelve siempre el mismo vector determinista para el mismo texto y entrega el vector configurado si se utiliza fixture, con cero tráfico de red. | [ ] | Aislamiento determinista para testing. |

---

## Pruebas de Casos Extremos (Edge Cases)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| **CE-1** | CLI / Vitest | 1. Invocar `calculateCosineSimilarity` con un vector vacío `[]` o con dimensiones dispares (ej. 384 vs 128 elementos). | Lanza de inmediato un error de dominio tipado `InvalidVectorDimensionError` con mensaje descriptivo. | [ ] | Validación temprana de dimensiones. |
| **CE-2** | CLI / Vitest | 1. Invocar `calculateCosineSimilarity` pasando un vector de magnitud cero (todos los elementos en `0`). | Retorna de manera segura `0.0000` sin arrojar excepciones no controladas ni valores `NaN` o `Infinity`. | [ ] | Prevención de división por cero ($0/0$). |
| **CE-3** | CLI / Vitest | 1. Invocar `generateEmbedding` pasando texto vacío `""`, solo espacios `"    "` o caracteres de control (`"\n\t  "`). | Rechaza la operación de forma inmediata lanzando `EmptyTextError` sin intentar llamar a la API externa. | [ ] | Rechazo temprano de input inválido. |
| **CE-4** | CLI / Vitest | 1. Simular respuesta HTTP 503 (`Model is currently loading`) en `HuggingFaceEmbeddingProvider`.<br>2. Simular fallo persistente tras 2 reintentos o timeout (> 5000 ms). | Ejecuta hasta 2 reintentos automáticos con pausa; si persiste, lanza `ExternalAIProviderError` asegurando que `HF_TOKEN` no se imprima en el mensaje de error ni traza. | [ ] | Resiliencia ante cold-start y no exposición de secretos. |
| **CE-5** | CLI / Vitest | 1. Simular una respuesta exitosa de la API externa con una estructura anómala (ej. array de 100 elementos o datos no numéricos). | Lanza `InvalidEmbeddingResponseError` informando que la respuesta no cumple con el contrato dimensional de 384 números. | [ ] | Detección de payloads corruptos. |
| **CE-6** | CLI / PostgreSQL | 1. Intentar registrar una frase con un UUID inexistente en `similar_to_id`. | La base de datos rechaza la inserción por violación de clave foránea (`foreign key constraint violation`). | [ ] | Protección de integridad referencial. |
| **CE-7** | CLI / PostgreSQL | 1. Limpiar la tabla `phrases` (catálogo vacío).<br>2. Registrar la primera frase del catálogo sin frase de comparación previa.<br>3. Consultar la frase guardada. | El registro se persiste obligatoriamente con `similar_to_id = NULL`, `similarity_score = NULL` y `validation_status = 'UNIQUE'`. | [ ] | Estado consistente en catálogo inicial. |
