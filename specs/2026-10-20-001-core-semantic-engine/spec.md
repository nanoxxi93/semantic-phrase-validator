# 001-core-semantic-engine: Motor Semántico y Persistencia Base

## Resumen
El motor semántico y capa de persistencia base permite transformar oraciones cortas en representaciones vectoriales densas de 384 dimensiones mediante Hugging Face, calcular su similitud semántica con precisión matemática mediante similitud coseno y persistir las frases junto con sus vectores y metadatos de validación en una base de datos relacional PostgreSQL. Esta capacidad establece el fundamento sobre el cual opera la detección de paráfrasis y redundancia conceptual en el sistema.

## Casos de usuario
- **CU-1**: Como sistema de validación de frases, quiero generar vectores de embeddings de 384 dimensiones para oraciones de texto plano mediante un proveedor de IA para capturar el significado semántico multilingüe de las frases registradas.
- **CU-2**: Como motor de comparación semántica, quiero calcular la similitud coseno matemática entre dos vectores de embeddings normalizados para cuantificar de manera determinista la afinidad conceptual entre dos oraciones en una escala de 0.0000 a 1.0000.
- **CU-3**: Como capa de datos del validador de frases, quiero persistir oraciones cortas con sus vectores generados (`JSONB`) y sus metadatos de validación (`similarity_score`, `similar_to_id`, `validation_status`) en PostgreSQL para mantener un historial inmutable y auditable de las validaciones semánticas, admitiendo valores nulos cuando no existan frases previas o no se identifique frase similar.
- **CU-4**: Como desarrollador y suite de pruebas, quiero disponer de una abstracción de proveedor de embeddings intercambiable (`EmbeddingProvider`) con una implementación simulada determinista (`MockEmbeddingProvider`) para ejecutar pruebas unitarias y de integración veloces, predecibles y sin consumo de red ni cuota de Hugging Face.

## Criterios de aceptación
- [ ] **CA-01 (Similitud idéntica)**: Dados dos vectores idénticos no nulos de 384 dimensiones, cuando se calcula la similitud coseno entre ambos, entonces el sistema retorna exactamente `1.0000`.
- [ ] **CA-02 (Similitud ortogonal/nula)**: Dados dos vectores ortogonales de igual dimensión (384), cuando se calcula la similitud coseno entre ambos, entonces el sistema retorna `0.0000`.
- [ ] **CA-03 (Generación de embedding válido y normalización)**: Dado un texto válido no vacío de hasta 280 caracteres, cuando se solicita su embedding al proveedor (`EmbeddingProvider.generateEmbedding`), entonces el texto es normalizado (colapsando secuencias de espacios en blanco y saltos de línea a un único espacio) y retorna una promesa que resuelve a un vector numérico plano (`number[]`) de longitud exacta 384 con componentes de coma flotante.
- [ ] **CA-04 (Persistencia con metadatos y consistencia nula)**: Dada una frase válida con su vector de 384 dimensiones y metadatos de validación, cuando se guarda en PostgreSQL, entonces se almacena íntegramente en la tabla `phrases`. Si la frase tiene una frase similar asociada, se guarda con `similar_to_id` y `similarity_score` en el rango `[0.0000, 1.0000]`. Si no existe frase previa de comparación (catálogo vacío) o `similar_to_id` es nulo, `similarity_score` debe persistirse también como `NULL`, con `validation_status = 'UNIQUE'`.
- [ ] **CA-05 (Alineación y redondeo de coma flotante)**: Dados dos vectores cualesquiera con valores de coma flotante, cuando se calcula la similitud coseno, entonces el resultado se acota numéricamente al rango `[0.0000, 1.0000]` y se redondea exactamente a 4 posiciones decimales, previniendo desviaciones numéricas como `1.0000000000000002` o valores negativos por imprecisión flotante.
- [ ] **CA-06 (Integridad referencial y ciclo de vida)**: Dada una frase registrada con `similar_to_id` apuntando a otra frase existente, cuando la frase de referencia es eliminada de la base de datos, entonces el campo `similar_to_id` pasa automáticamente a `NULL` (`ON DELETE SET NULL`) sin causar errores de integridad ni borrado en cascada.
- [ ] **CA-07 (Desacoplamiento de testing mediante Mock)**: Dado un entorno de pruebas automatizadas, cuando se invoca `MockEmbeddingProvider.generateEmbedding`, entonces devuelve un vector determinista de 384 dimensiones derivado del hash del texto o un fixture inyectado sin realizar conexiones HTTP ni llamadas a APIs externas.

## Requisitos funcionales
- **RF-1 (Esquema de Datos Relacional `phrases` en PostgreSQL)**:
  El sistema debe gestionar la tabla `phrases` con los siguientes campos y restricciones:
  - `id`: Identificador único universal (UUID), clave primaria (Primary Key), generado automáticamente mediante `gen_random_uuid()`.
  - `text`: Cadena de texto de hasta 280 caracteres (`VARCHAR(280)`), no nula (`NOT NULL`), que almacena la oración normalizada registrada.
  - `embedding`: Vector numérico almacenado como `JSONB`, no nulo (`NOT NULL`), compuesto por un array de exactamente 384 números de punto flotante.
  - `similarity_score`: Valor numérico con precisión decimal (`NUMERIC(5,4)`), anulable (`NULLABLE DEFAULT NULL`), que representa el puntaje de afinidad semántica obtenido durante la validación (en el rango de `0.0000` a `1.0000`). Si no existe frase de comparación previa (`similar_to_id IS NULL`), este campo debe permanecer en `NULL`.
  - `similar_to_id`: Identificador UUID opcional (`NULLABLE`), con clave foránea auto-referencial a `phrases.id` con comportamiento `ON DELETE SET NULL`, indicando la frase con la que guardó mayor similitud semántica.
  - `validation_status`: Cadena de texto (`VARCHAR(30)`), no nula (`NOT NULL`), restringida a los valores de dominio `'UNIQUE'` o `'CONFIRMED_DUPLICATE'`.
  - `created_at`: Marca temporal con zona horaria (`TIMESTAMPTZ`), no nula (`NOT NULL`), con valor por defecto `NOW()`.

- **RF-2 (Cálculo Matemático de Similitud Coseno)**:
  El sistema debe proveer una función matemática pura (`calculateCosineSimilarity`) para el cálculo de similitud coseno:
  - Recibe dos vectores numéricos `vecA: number[]` y `vecB: number[]`.
  - Exige que ambos vectores compartan exactamente la misma dimensión no nula (384 elementos).
  - Calcula el producto punto dividido entre el producto de las normas euclidianas de ambos vectores.
  - Retorna un puntaje numérico acotado en el intervalo `[0.0000, 1.0000]`, redondeado simétricamente a 4 decimales (`Math.round((val + Number.EPSILON) * 10000) / 10000`).

- **RF-3 (Contrato del Proveedor de Embeddings `EmbeddingProvider`)**:
  El sistema debe definir un contrato de abstracción para la generación de vectores:
  - Método: `generateEmbedding(text: string): Promise<number[]>`.
  - Normalización de entrada: Aplica `text.trim().replace(/\s+/g, ' ')`, eliminando espacios en los extremos y colapsando secuencias de espacios intermedios, tabulaciones y saltos de línea a un solo espacio antes del envío.
  - Validación de texto vacío: Si tras la normalización la longitud resultante es 0, lanza inmediatamente `EmptyTextError` antes de contactar cualquier servicio externo.
  - Devuelve una promesa que resuelve a un vector numérico plano de exactamente 384 dimensiones.

- **RF-4 (Implementación del Proveedor Hugging Face y Desempaquetado Tolerante)**:
  El proveedor `HuggingFaceEmbeddingProvider` debe implementar `EmbeddingProvider` utilizando el SDK `@huggingface/inference`:
  - Utiliza el modelo `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`.
  - Ejecuta la tarea de `featureExtraction` consumiendo el token configurado en variables de entorno.
  - Tolerancia estructural: Si la API responde con un tensor bidimensional (ej. `1 x 384` como `[[...]]`), extrae automáticamente el primer elemento `response[0]`, entregando siempre un array plano `number[]` de 384 números.
  - Resiliencia ante arranque en frío (Cold-start): Implementa reintento automático ante HTTP 503 (`Model is currently loading`), ejecutando hasta 2 reintentos con pausa progresiva basada en `estimated_time` o backoff de 3 a 5 segundos.

- **RF-5 (Implementación del Proveedor Mock Determinista con Fixtures)**:
  El proveedor `MockEmbeddingProvider` debe implementar `EmbeddingProvider` para pruebas y desarrollo aislado:
  - Genera vectores deterministas reproducibles de 384 números basados en un algoritmo de hash del texto entrante (mismo texto genera siempre el mismo vector; textos distintos generan vectores diferenciados).
  - Admite la inyección de fixtures configurables (mapeo directo texto -> vector específico) para calibrar casos de prueba unitaria e integración.
  - Opera 100% en memoria sin realizar conexiones de red.

- **RF-6 (Persistencia Transaccional de Frases)**:
  La capa de persistencia debe permitir insertar registros completos de frases con sus vectores `JSONB` y consultar frases existentes junto con sus embeddings para permitir validaciones futuras.

## Requisitos no funcionales
- **RNF-1 (Rendimiento del cálculo de similitud)**: La función de cálculo de similitud coseno entre dos vectores de 384 dimensiones debe completarse en menos de 0.1 milisegundos en CPU backend estándar.
- **RNF-2 (Seguridad y no exposición de secretos)**: La credencial de Hugging Face (`HF_TOKEN`) debe cargarse exclusivamente desde variables de entorno. Se prohíbe exponerla o imprimirla en logs, trazas de excepción o respuestas HTTP, en estricto cumplimiento de `specs/constitution.md` (Sección 3.1).
- **RNF-3 (Tipado estricto y ausencia de `any`)**: Todo el código TypeScript asociado a contratos, modelos, proveedores y utilidades matemáticas debe compilar bajo el modo `"strict": true` sin ningún tipo `any`, según `specs/constitution.md` (Sección 4.3).
- **RNF-4 (Aislamiento y determinismo de pruebas)**: Las suites de pruebas unitarias deben ejecutarse de forma 100% determinista utilizando `MockEmbeddingProvider`, sin realizar peticiones de red y completándose en menos de 3 segundos bajo Vitest, en conformidad con `specs/constitution.md` (Sección 1.2 y 4.1).
- **RNF-5 (Precisión numérica en base de datos)**: La columna `similarity_score` definida como `NUMERIC(5,4)` en PostgreSQL garantiza que los puntajes calculados conserven exactamente su precisión de 4 decimales sin sufrir distorsiones por redondeo de coma flotante del motor de base de datos.
- **RNF-6 (Pureza de utilidades y separación arquitectónica)**: La función de similitud coseno debe implementarse en `backend/src/utils/` como función pura sin estado ni dependencias externas, alineada con la separación de capas de `specs/constitution.md` (Sección 1.1).

## Casos extremos
- **CE-1 (Vectores con dimensiones dispares o vacíos)**: Si se intenta calcular la similitud coseno con vectores vacíos (`[]`) o con distinta longitud (ej. 384 vs 128), el sistema no debe calcular valores espurios; debe lanzar de forma inmediata un error tipado de validación de dominio (`InvalidVectorDimensionError`).
- **CE-2 (Vectores de magnitud cero / vectores nulos)**: Si alguno de los vectores de entrada contiene únicamente ceros (`[0, 0, ..., 0]`), la norma euclidiana resulta en `0`, lo que produciría una división matemática indeterminada (`0/0 = NaN`). El sistema debe detectar proactivamente esta condición y retornar de forma segura y determinista `0.0000`, evitando propagar valores `NaN` o `Infinity`.
- **CE-3 (Texto de entrada vacío o solo espacios en blanco y caracteres de control)**: Si se pasa una cadena vacía `""`, compuesta exclusivamente por espacios `"   "` o secuencias de saltos de línea/tabulaciones (`"\n\t  "`), la normalización produce una longitud neta de 0 y el proveedor debe rechazar la operación inmediatamente lanzando un error de validación de entrada (`EmptyTextError`), previniendo llamadas de red infructuosas a Hugging Face.
- **CE-4 (Fallo, timeout o indisponibilidad de Hugging Face)**: Si la API de Hugging Face responde con errores de carga de modelo (`503 Model is currently loading`), el proveedor ejecuta automáticamente hasta 2 reintentos progresivos con espera. Si la falla persiste tras los reintentos, o si responde con exceso de cuota (`429 Too Many Requests`), credenciales inválidas (`401 Unauthorized`) o agotamiento de tiempo de espera (timeout > 5000 ms), el proveedor captura la falla y lanza un error de dominio estructurado (`ExternalAIProviderError`) sin exponer el token ni información sensible.
- **CE-5 (Respuesta con estructura inesperada de Hugging Face)**: Si la API de inferencia responde con éxito pero con un formato dimensional o tipo de dato no convertible a 384 números (ej. longitud distinta a 384 tras desempaquetar, array vacío o estructuras mayores a 2D), el proveedor debe lanzar un error `InvalidEmbeddingResponseError` señalando el incumplimiento del contrato dimensional.
- **CE-6 (Frase de referencia eliminada concurrentemente)**: Si la frase referenciada por `similar_to_id` es eliminada de la base de datos, la regla `ON DELETE SET NULL` debe asegurar que la referencia pase a `NULL` sin romper la integridad referencial ni desencadenar borrados indeseados.
- **CE-7 (Persistencia inicial con catálogo vacío)**: Al registrar la primera frase en el sistema (sin registros previos contra los cuales comparar), el sistema debe registrar obligatoriamente `similar_to_id = NULL`, `similarity_score = NULL` y `validation_status = 'UNIQUE'`, garantizando consistencia semántica total en el estado inicial.

## Changelog de la Especificación
- **2026-10-20 (Creación inicial)**: Creación inicial de la especificación para la funcionalidad `001-core-semantic-engine` (Motor Semántico y Persistencia Base).
- **2026-10-20 (Clarificación y Refinamiento)**: Refinamiento de especificación mediante la skill `clarify`:
  - Se formalizó la normalización de texto (`trim()` y colapso de `\s+` a un solo espacio) y rechazo temprano con `EmptyTextError` (RF-3, CA-03, CE-3).
  - Se modificó el contrato del esquema de datos: `similarity_score` pasa a ser `NUMERIC(5,4) NULLABLE DEFAULT NULL`, estableciendo que cuando `similar_to_id` sea `NULL`, `similarity_score` también sea `NULL` (RF-1, CA-04, CE-7).
  - Se definió el desempaquetado tolerante para respuestas anidadas `1 x 384` (`[[...]]`) de Hugging Face Feature Extraction (RF-4, CE-5).
  - Se especificó la estrategia determinista con hash y fixtures inyectables en `MockEmbeddingProvider` (RF-5, CA-07).
  - Se formalizó la política de reintentos automáticos (hasta 2 reintentos con backoff) ante arranque en frío / HTTP 503 en `HuggingFaceEmbeddingProvider` (RF-4, CE-4).
