# Lista de Tareas: 005-cloudflare-workers-ai-embeddings

## Fase 1: Motor Matemático Dinámico y Contrato del Proveedor
- [x] 1.1 Actualizar la clase de error `InvalidVectorDimensionError` en `backend/src/errors/InvalidVectorDimensionError.ts` para aceptar longitudes arbitrarias dispares (`expectedOrDimA: number, receivedOrDimB: number`).
  *(No hay dependencias. Desbloquea la generalización matemática)*
- [x] 1.2 Generalizar `calculateCosineSimilarity` en `backend/src/utils/cosineSimilarity.ts`:
  - Remover constante rígida `REQUIRED_DIMENSION = 384`.
  - Exigir `vecA.length === vecB.length` y `vecA.length > 0`; de lo contrario lanzar `InvalidVectorDimensionError`.
  - Computar producto punto y normas euclidianas sobre $N$ dimensiones con protección de magnitud nula ($0.0000$), clamp $[0.0, 1.0]$ y redondeo simétrico a 4 decimales (CA-05).
  *(Depende de 1.1)*
- [x] 1.3 Actualizar tests unitarios en `backend/tests/unit/cosineSimilarity.test.ts` cubriendo vectores de 1024 dimensiones, disparidad dimensional (ej. 1024 vs 384, 0 vs 1024) y vectores nulos (CE-7).
  *(Depende de 1.2)*
- [x] 1.4 Extender la interfaz abstracta `EmbeddingProvider` en `backend/src/providers/embeddingProvider.interface.ts` agregando la propiedad `readonly modelIdentifier: string`.
  *(No hay dependencias)*
- [x] 1.5 Actualizar `HuggingFaceEmbeddingProvider` en `backend/src/providers/huggingFaceEmbeddingProvider.ts` para exponer `readonly modelIdentifier = this.model`.
  *(Depende de 1.4)*
- [x] 1.6 Actualizar `MockEmbeddingProvider` en `backend/src/providers/mockEmbeddingProvider.ts` para soportar dimensiones configurables (por defecto 384, configurable a 1024) y propiedad `modelIdentifier` (CA-11).
  *(Depende de 1.4)*

## Fase 2: Implementación de `CloudflareEmbeddingProvider`
- [x] 2.1 Implementar `CloudflareEmbeddingProvider` en `backend/src/providers/cloudflareEmbeddingProvider.ts`:
  - Constructor con `accountId: string`, `apiToken: string`, `model = '@cf/baai/bge-m3'` y cliente `fetch` inyectable (RF-2).
  - Exponer propiedad `readonly modelIdentifier: string`.
  - Normalización de texto (`trim()` y colapso de secuencias de espacios); lanzar `EmptyTextError` si la longitud es 0 (CE-5).
  - Llamada HTTP `POST https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/run` con cabecera `Authorization: Bearer {apiToken}`, soporte para `cf-aig-gateway-id` y timeout de 8000 ms con `AbortSignal` (CE-6).
  - Desempaquetado tolerante: admitir matriz bidimensional `result.data: [[...]]` o array unidimensional plano `result.data: [...]` (CA-04).
  - Validación de exactamente 1024 elementos numéricos finitos; de lo contrario lanzar `InvalidEmbeddingResponseError` (CA-03, CE-8).
  - Política de reintentos progresivos: hasta 2 reintentos con backoff ante HTTP 429, 500 y 503 (CA-09, CE-3).
  - Captura y transformación de errores en `ExternalAIProviderError` sin exponer tokens ni Account ID (CA-08, CE-4).
  *(Depende de la Fase 1)*
- [x] 2.2 Crear la suite de pruebas unitarias en `backend/tests/unit/cloudflareEmbeddingProvider.test.ts` con mock de `fetch`:
  - Generación exitosa de vector de 1024 floats desempaquetando formatos 1D y 2D.
  - Validación de normalización y rechazo de texto vacío con `EmptyTextError`.
  - Reintentos exitosos ante errores transitorios 429 y 503 con backoff.
  - Rechazo de respuestas malformadas o dimensionalidad distinta a 1024 con `InvalidEmbeddingResponseError`.
  - Mapeo de errores de red o autenticación a `ExternalAIProviderError` sin fugas de credenciales.
  *(Depende de 2.1)*

## Fase 3: Persistencia en PostgreSQL y Migraciones con Drizzle
- [x] 3.1 Actualizar el esquema Drizzle en `backend/src/db/schema.ts`:
  - Agregar columna `embeddingModel: varchar('embedding_model', { length: 150 }).notNull()`.
  - Reemplazar índice `idx_phrases_created_at_id` por índice compuesto `idx_phrases_model_created_at_id` en `(table.embeddingModel, table.createdAt.desc(), table.id.desc())` (CA-06, RF-5).
  *(Depende de la Fase 1. Desbloquea las migraciones)*
- [x] 3.2 Generar migración SQL con Drizzle Kit (`npm --prefix backend run db:generate`) y asegurar cláusula `DEFAULT 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'` para backfill de registros existentes (CA-06).
  *(Depende de 3.1)*
- [x] 3.3 Actualizar script SQL consolidado e idempotente en `scripts/schema.sql` reflejando la nueva columna e índice compuesto.
  *(Depende de 3.2)*
- [x] 3.4 Actualizar `PhraseRepositoryInterface` y `PhraseRepository` en `backend/src/repositories/`:
  - Modificar `findEmbeddings(embeddingModel: string)` para filtrar por `where(eq(phrases.embeddingModel, embeddingModel))`.
  - Modificar `findAll(options)` para filtrar por `where(eq(phrases.embeddingModel, activeModel))`.
  - Incluir `embeddingModel` en la inserción de nuevas frases (`create`).
  *(Depende de 3.1)*
- [x] 3.5 Actualizar y verificar pruebas de integración del repositorio en `backend/tests/integration/phraseRepository.integration.test.ts`.
  *(Depende de 3.4)*

## Fase 4: Configuración con Zod y Lógica de Negocio en Servicios
- [x] 4.1 Actualizar `backend/src/config/env.ts` con esquema Zod:
  - Añadir `EMBEDDING_PROVIDER: z.enum(['huggingface', 'cloudflare']).default('huggingface')`.
  - Añadir `CLOUDFLARE_ACCOUNT_ID: z.string().optional()`.
  - Añadir `CLOUDFLARE_API_TOKEN: z.string().optional()`.
  - Añadir `CLOUDFLARE_MODEL: z.string().default('@cf/baai/bge-m3')`.
  - Añadir `CLOUDFLARE_GATEWAY_ID: z.string().optional()`.
  - Añadir validación condicional con `.superRefine()`: exigir `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN` si `EMBEDDING_PROVIDER === 'cloudflare'`, y `HF_TOKEN` si `EMBEDDING_PROVIDER === 'huggingface'` (CA-02, RF-3).
  *(No hay dependencias externas)*
- [x] 4.2 Actualizar `PhraseService` en `backend/src/services/phraseService.ts`:
  - Clave de caché compuesta en `InMemoryEmbeddingCache`: `${provider.modelIdentifier}:${normalizedText}` (RNF-4).
  - Al validar (`validatePhrase`), admitir parámetro opcional `model` y resolver proveedor dinámicamente.
  - Al persistir (`createPhrase`), admitir parámetro opcional `model` y almacenar `embeddingModel: provider.modelIdentifier`.
  - Supresión de fallback entre proveedores: ante fallo del proveedor de IA, propagar `ExternalAIProviderError` directamente sin conmutar a Hugging Face (CA-08, CE-2).
  *(Depende de 1.4, 2.1, 3.4 y 4.1)*
- [x] 4.3 Actualizar `backend/src/app.ts` (Composition Root):
  - Factoría de dependencias: registrar proveedores disponibles en `Map<string, EmbeddingProvider>` y pasar a `PhraseService` (CA-01).
  *(Depende de 2.1 y 4.1)*
- [x] 4.4 Actualizar pruebas unitarias de `PhraseService` en `backend/tests/unit/phraseService.test.ts` incluyendo resolución dinámica de modelos.
  *(Depende de 4.2)*

## Fase 5: Exposición en Controladores, Rutas y Pruebas de Integración E2E
- [x] 5.1 Actualizar `PhraseController` en `backend/src/controllers/phraseController.ts`:
  - `validate`: extraer `model` y delegar a `PhraseService.validatePhrase(text, model)`.
  - `create`: extraer `model` y delegar a `PhraseService.createPhrase(text, confirmDuplicate, model)`.
  - `list`: asegurar que la consulta de catálogo filtre por el modelo solicitado o el predeterminado del servidor (CA-07).
  *(Depende de 4.2)*
- [x] 5.2 Actualizar y extender la suite de pruebas de integración HTTP en `backend/tests/integration/phrases.api.integration.test.ts`:
  - Probar flujo completo de validación y guardado usando `MockEmbeddingProvider` con 1024 dimensiones y modelo `@cf/baai/bge-m3` (CA-11).
  - Verificar que `GET /api/phrases` filtra frases por modelo (CA-07, CA-13).
  - Verificar que el error del proveedor de IA responde con código HTTP 503 (`ExternalAIProviderError`) y sin fallback encubierto (CA-08, CE-2).
  *(Depende de 4.3 y 5.1)*

## Fase 6: Herramientas CLI, Documentación y Auditoría
- [x] 6.1 Implementar el script de diagnóstico interactivo `backend/src/scripts/testCloudflareAI.ts`:
  - Conectar con Cloudflare Workers AI usando variables de entorno.
  - Medir latencia y forma de tensor (1024d) para la frase base *"Debo pagar el recibo de la luz mañana"*.
  - Calcular similitudes con frase idéntica, paráfrasis y frase no relacionada.
  - Imprimir reporte y recomendación de umbral para BGE-M3 (CA-10, RF-6).
  *(Depende de 2.1 y 1.2)*
- [x] 6.2 Registrar script en `package.json` de raíz y `backend/package.json`: `"test:cf": "npm --prefix backend run test:cf"`.
  *(Depende de 6.1)*
- [x] 6.3 Actualizar `specs/tech-stack.md` y `specs/constitution.md` documentando la compatibilidad multi-proveedor y dimensionalidad dinámica.
  *(Depende de las Fases 1 a 5)*
- [x] 6.4 Ejecutar suite completa de calidad y auditoría backend:
  - `npm run test:cf` (verificación de inferencia real en caliente con Cloudflare Workers AI).
  - `npm run test:unit` y `npm run test:frontend` (87 tests unitarios pasando al 100%).
  - `npm run typecheck` (0 errores de TypeScript en monorepo).
  - `npm run check:constitution` (0 infracciones).
  *(Depende de todas las tareas anteriores)*

## Fase 7: Backend Endpoint `GET /api/model` y Validación de Esquemas
- [x] 7.1 Implementar `ModelController` en `backend/src/controllers/modelController.ts` y cablear en `backend/src/app.ts` bajo la ruta `GET /api/model`:
  - Retorna `{ success: true, data: { provider, modelIdentifier, dimension, threshold } }` (CA-12, RF-7).
- [x] 7.2 Actualizar esquemas en `backend/src/controllers/phrase.schemas.ts`:
  - Definir `ALLOWED_MODELS` con los 2 modelos autorizados.
  - Validar `model: z.enum(ALLOWED_MODELS).optional()` en `validatePhraseSchema`, `createPhraseSchema` y `listPhrasesQuerySchema`, rechazando modelos no autorizados con HTTP 400 (CA-18, RF-8).
- [x] 7.3 Actualizar `PhraseController` y `PhraseService` para aceptar el parámetro `model` en todas las operaciones.
- [x] 7.4 Añadir pruebas para `GET /api/model`, `GET /api/phrases?model=...`, y rechazo de modelos no autorizados con HTTP 400 en `backend/tests/integration/phrases.api.integration.test.ts`.

## Fase 8: Constantes, Tipos y Capa de Servicios en Frontend
- [x] 8.1 Crear `frontend/src/constants/models.ts`:
  - Definir lista constante `AVAILABLE_MODELS` con Cloudflare BGE-M3 (1024d) y Hugging Face MiniLM-L12-v2 (384d) (RF-9).
- [x] 8.2 Actualizar `frontend/src/types/phrase.ts` agregando `embeddingModel: string` en `PhraseListItem` (RF-9).
- [x] 8.3 Actualizar `frontend/src/types/api.ts` agregando `ActiveModelInfo` (RF-9).
- [x] 8.4 Actualizar `frontend/src/services/phraseService.ts`:
  - Añadir método `getActiveModel(): Promise<ActiveModelInfo>` (CA-12).
  - Enviar parámetro `model` en `validatePhrase(text, model)` y `createPhrase(text, confirmDuplicate, model)`.
  - Extender `listPhrases(page, limit, status, model)` para admitir filtro opcional de modelo (CA-13).
- [x] 8.5 Actualizar composables `usePhraseValidation.ts` y `usePhraseCatalog.ts` para propagar el modelo seleccionado.

## Fase 9: Componentes UI de Frontend y Experiencia Multi-Modelo
- [x] 9.1 Actualizar `AppHeader.vue`:
  - Reemplazar texto estático de Hugging Face por selector `<select>` con los 2 modelos soportados (CA-14, RF-10).
  - Mostrar badge "(Activo en Servidor)" al lado de la opción configurada en backend.
  - Mostrar dinámicamente el porcentaje de umbral recibido del backend (`(threshold * 100).toFixed(1)%`).
- [x] 9.2 Actualizar `App.vue` y `PhraseForm.vue`:
  - Sincronizar el modelo seleccionado en el encabezado con el formulario de validación y guardado.
- [x] 9.3 Actualizar `PhraseCatalog.vue`:
  - Refrescar automáticamente el catálogo con el modelo seleccionado (CA-15).
- [x] 9.4 Actualizar `PhraseCard.vue`:
  - Mostrar un badge estético con el `shortLabel` del modelo correspondiente al `embeddingModel` de la frase (CA-16, RF-10).
- [x] 9.5 Actualizar `ValidationResultCard.vue` y `DuplicateAlertCard.vue`:
  - Mostrar badge del modelo utilizado para la inferencia y el umbral aplicado (CA-17, RF-10).

## Fase 10: Pruebas Automatizadas de Frontend, Verificación Integral y Cierre
- [x] 10.1 Crear/actualizar pruebas unitarias en `frontend/tests/`:
  - Pruebas para `AppHeader.vue` (selector de modelos y badge de umbral).
  - Pruebas para `PhraseCatalog.vue` (recarga reactiva con modelo seleccionado sin banner).
  - Pruebas para `PhraseForm.vue` y `usePhraseValidation.ts` (propagación del modelo seleccionado).
  - Pruebas para `PhraseCard.vue` (renderizado de badges por modelo).
- [x] 10.2 Ejecutar suite completa de verificación:
  - `npm run test:monorepo` (100% pruebas de backend y frontend pasando).
  - `npm run typecheck` (0 errores de tipos TypeScript).
  - `npm run check:constitution` (0 infracciones constitucionales).
  - `npm run validate:sdd` (0 discrepancias de trazabilidad).
