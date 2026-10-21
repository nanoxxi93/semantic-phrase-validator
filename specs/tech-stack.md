# Tech Stack

> **Estado:** Fase 0 (Constitución y Planificación Inicial)

## 1. Restricciones de plataforma que definen la arquitectura

### Estructura Monorepo
El proyecto se organiza como un monorepo cohesionado que aloja `/backend` y `/frontend`, permitiendo una gestión unificada de scripts, tipos de dominio compartidos y pipelines de integración continua, manteniendo a la vez un desacoplamiento estricto de despliegue y runtime.

### Plataforma y Ecosistema
- **Backend:** Runtime Node.js (v24+) con Express.js y TypeScript en modo estricto. Garantiza alto rendimiento en I/O asíncrono para llamadas a servicios externos de IA y acceso a bases de datos relacionales.
- **Frontend:** Single Page Application (SPA) desarrollada con Vue 3 (Composition API con sintaxis `<script setup>`), Vite como bundler ultrarrápido y Tailwind CSS para diseño visual declarativo y responsivo.
- **Validación de Contratos:** Zod en Backend para validación estricta de esquemas de entrada en endpoints y variables de entorno, asegurando tipado estático inferido en tiempo de compilación.

### Alternativas descartadas

| Alternativa descartada | Motivo del descarte |
|---|---|
| **Embeddings en el navegador (Transformers.js)** | Alto consumo de memoria y CPU en dispositivos cliente; descarga de cientos de megabytes de modelos en el navegador que degradan la experiencia de usuario y aumentan la latencia inicial. |
| **Bases de datos vectoriales especializadas (Pinecone / Qdrant / Milvus)** | Sobrecarga de complejidad de infraestructura y costo para el volumen del MVP; PostgreSQL con Drizzle ORM y cálculo de similitud coseno en memoria de backend ofrece simplicidad, consistencia transaccional y rendimiento óptimo para el alcance definido. |
| **Búsqueda por texto tradicional (PostgreSQL Full-Text Search / ILIKE)** | Solo compara lexemas y raíces léxicas, incapaz de entender paráfrasis o relaciones semánticas entre conceptos sin vocabulario compartido. |
| **Next.js / Nuxt Fullstack SSR** | Se priorizó un backend REST desacoplado con Express para aislar limpiamente los proveedores de IA y permitir despliegues independientes en infraestructuras especializadas (Edge SPA + Container API). |

## 2. Decisiones de Ingeniería Core

| Decisión | Opción Elegida | Justificación |
|---|---|---|
| **Estructura de Repositorio** | Monorepo (`/backend`, `/frontend`) | Facilidad de versionado conjunto, consistencia en contratos y simplicidad de desarrollo local. |
| **Servidor HTTP** | Express.js + TypeScript | Minimalismo, robustez probada, ecosistema maduro y control total sobre middlewares y ciclo de vida de peticiones. |
| **Validación de Datos** | Zod | Esquemas tipados seguros tanto para runtime (body parsing) como para compilación estática de TypeScript. |
| **Capa de Persistencia** | PostgreSQL + Drizzle ORM | Schema-as-code con TypeScript nativo, migraciones SQL reproducibles con `drizzle-kit`, alta velocidad sin sobrecostes de abstracción pesada. |
| **Almacenamiento Vectorial** | Columna `JSONB` en PostgreSQL | Almacena el vector de 384 dimensiones de coma flotante sin requerir extensiones complejas en la fase inicial, permitiendo portabilidad entre proveedores estándar. |
| **Proveedor de IA** | SDK `@huggingface/inference` | Inferencia Serverless gestionada para Feature Extraction con el modelo `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`. |
| **Inversión de Dependencias** | Interfaz `EmbeddingProvider` | Desacopla la lógica de negocio del SDK de Hugging Face, facilitando pruebas con mocks deterministas sin costo de red. |
| **Framework Frontend** | Vue 3 + `<script setup>` | Reactividad declarativa de alto rendimiento, código conciso y desacoplamiento limpio mediante composables. |
| **Estilizado UI** | Tailwind CSS | Clases utilitarias que aceleran la construcción de interfaces elegantes y consistentes sin hojas de estilo monolíticas. |
| **Testing** | Vitest | Ejecución ultrarrápida compatible con módulos ESM, ideal tanto para pruebas unitarias de matemáticas vectoriales como para integración con supertest. |

## 3. Arquitectura general

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                       FRONTEND                                         │
│                      (Vue 3 + Vite + Tailwind CSS - Cloudflare Pages)                  │
│                                                                                        │
│   ┌───────────────────────────┐         ┌──────────────────────────────────────────┐   │
│   │   Presentational Views    │ <=====> │        Composables / State Machine       │   │
│   │ (PhraseForm, AlertModal,  │         │ (usePhraseValidation, usePhraseCatalog)  │   │
│   │        PhraseList)        │         │                                          │   │
│   └───────────────────────────┘         └────────────────────┬─────────────────────┘   │
└──────────────────────────────────────────────────────────────┼─────────────────────────┘
                                                               │  HTTP REST (JSON)
                                                               ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                       BACKEND                                          │
│                         (Node.js + Express + TS - Fly.io)                              │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ Controllers (Routes: POST /validate, POST /phrases, GET /phrases)             │   │
│   └────────────────────────────────────────┬───────────────────────────────────────┘   │
│                                            ▼                                           │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ Services (PhraseService - Reglas de Negocio, Evaluación de Umbral Semántico)  │   │
│   └───────────────┬───────────────────────────────────────────────┬────────────────┘   │
│                   │                                               │                    │
│                   ▼                                               ▼                    │
│   ┌────────────────────────────────┐            ┌──────────────────────────────────┐   │
│   │ Repositories (Drizzle ORM)     │            │ Providers (IEmbeddingProvider)   │   │
│   └───────────────┬────────────────┘            └─────────────────┬────────────────┘   │
└───────────────────┼───────────────────────────────────────────────┼────────────────────┘
                    │                                               │
                    ▼                                               ▼
         ┌─────────────────────┐                     ┌──────────────────────────────┐
         │     PostgreSQL      │                     │     Hugging Face API         │
         │  (Neon / Supabase)  │                     │  (Feature Extraction 384d)   │
         │ (schema: 'phrases') │                     │ (paraphrase-multilingual...) │
         └─────────────────────┘                     └──────────────────────────────┘
```

### Estrategia de Conexión y Flujo de Datos

1. **Ingreso y Validación Semántica:**
   - El usuario introduce una frase y hace clic en "Validar".
   - El composable `usePhraseValidation` emite una petición `POST /api/phrases/validate` con `{ text: string }`.
   - El controlador valida el cuerpo con Zod y delega en `PhraseService`.
   - `PhraseService` llama a `EmbeddingProvider.generateEmbedding(text)` para obtener el vector de 384 dimensiones mediante Hugging Face.
   - `PhraseService` consulta a `PhraseRepository` para obtener los vectores existentes persistidos en la base de datos.
   - `PhraseService` ejecuta la función matemática pura de similitud coseno (`calculateCosineSimilarity`) contra cada vector almacenado y determina el puntaje máximo y la frase más cercana.
   - Si la similitud máxima supera `SIMILARITY_THRESHOLD` (ej. 0.80), retorna un resultado `isDuplicate: true`, la frase coincidente y el score. De lo contrario, `isDuplicate: false`.

2. **Decisión del Usuario y Persistencia:**
   - Si se detecta duplicado potencial, el frontend muestra el modal con el score y la frase causante. El usuario puede cancelar (regresa a edición) o confirmar guardado.
   - Al proceder con el guardado, se envía `POST /api/phrases` con los datos correspondientes.
   - `PhraseService` guarda en PostgreSQL mediante Drizzle ORM la entidad con:
     - `text`: texto original.
     - `embedding`: vector JSONB.
     - `similarity_score`: valor numérico obtenido o null.
     - `similar_to_id`: identificador de la frase relacionada o null.
     - `validation_status`: `'UNIQUE'` o `'CONFIRMED_DUPLICATE'`.
     - `created_at`: marca temporal.
   - El frontend recibe la frase creada y actualiza reactivamente el catálogo en `usePhraseCatalog`.

## 4. Tecnologías Elegidas

| Área | Elección | Justificación |
|---|---|---|
| **Estructura** | Monorepo (`/backend`, `/frontend`) | Centraliza la configuración y el ciclo de vida sin duplicar repositorios. |
| **Backend Runtime** | Node.js (v24+) | Ecosistema moderno con soporte nativo avanzado de TypeScript y APIs de red, excelente rendimiento en operaciones I/O y soporte ESM nativo. |
| **Backend Framework** | Express.js + TypeScript | Framework minimalista, flexible y ampliamente probado para APIs REST livianas. |
| **Validación de Esquemas** | Zod | Inferencia estática de tipos en TypeScript y validación estricta de payloads en runtime. |
| **ORM & Migraciones** | Drizzle ORM (`drizzle-orm`, `drizzle-kit`, `pg`) | Tipado SQL-like directo, migraciones predecibles en SQL puro y cero sobrecarga de instanciación. |
| **Base de Datos** | PostgreSQL 17 | Motor relacional estándar con soporte nativo de tipos `JSONB`, transacciones ACID y alta confiabilidad (alineado con la versión LTS soportada por Supabase y la compatibilidad de Neon). |
| **Modelo de Embeddings** | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Modelo de 384 dimensiones de Hugging Face optimizado para detectar paráfrasis en más de 50 idiomas con baja latencia. |
| **Cliente de Inferencia** | `@huggingface/inference` | SDK oficial para comunicarse con la API de inferencia de Hugging Face. |
| **Frontend Framework** | Vue 3 (Composition API, `<script setup>`) | Reactividad atómica, excelente separación de lógica en composables y curva de desarrollo ágil. |
| **Herramienta de Build** | Vite | Tiempos de arranque instantáneos en desarrollo y empaquetado optimizado en producción (Rollup). |
| **Diseño y Estilos** | Tailwind CSS | Construcción rápida de interfaces limpias mediante utility classes sin CSS redundante. |
| **Test Runner** | Vitest | Suite de testing ultrarrápida con soporte para mocks de TypeScript y pruebas de integración supertest. |
| **Infraestructura Local** | Docker Compose | Contenedor local reproducible de PostgreSQL para desarrollo y tests automatizados. |
| **Infraestructura Producción** | Fly.io (API) + Neon/Supabase (PostgreSQL) + Cloudflare Pages (Frontend) | Despliegue moderno, escalable, con capa gratuita generosa y alta disponibilidad. |

### Estructura de Módulos (Propuesta)

```text
semantic-phrase-validator/
├── backend/
│   ├── src/
│   │   ├── config/              # Variables de entorno y configuración Zod
│   │   ├── controllers/         # Controladores HTTP Express
│   │   ├── services/            # Lógica de negocio y evaluación de umbrales
│   │   ├── repositories/        # Consultas y persistencia con Drizzle
│   │   ├── providers/           # Cliente Hugging Face (implementa EmbeddingProvider)
│   │   ├── utils/               # Función pura de similitud coseno
│   │   ├── db/                  # Esquemas de tablas Drizzle y migraciones
│   │   ├── routes/              # Declaración de rutas de la API
│   │   └── app.ts / index.ts    # Arranque y configuración de Express
│   ├── tests/
│   │   ├── unit/                # Tests de similitud coseno, umbral y providers
│   │   └── integration/         # Tests de endpoints HTTP con mocks
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── assets/              # Estilos Tailwind y recursos estáticos
│   │   ├── components/          # Componentes presentacionales (Form, Modal, List)
│   │   ├── composables/         # Lógica reactiva (usePhraseValidation, usePhraseCatalog)
│   │   ├── services/            # Cliente HTTP (fetch/axios) contra la API backend
│   │   ├── types/               # Tipos TypeScript compartidos en UI
│   │   ├── App.vue              # Vista principal de la aplicación
│   │   └── main.ts              # Punto de entrada de Vue
│   ├── vite.config.ts
│   └── package.json
├── specs/                       # Gobernanza y especificaciones SDD
├── scripts/                     # Scripts de validación constitucional y SDD
├── docker-compose.yml           # PostgreSQL para desarrollo local
└── package.json                 # Monorepo scripts raíz
```

## 5. Calidad y entrega

| Área | Herramienta | Configuración |
|---|---|---|
| **Tests Unitarios & Integración** | Vitest | Configurado en `/backend` para pruebas unitarias de vectores y pruebas de integración con `supertest`. |
| **Validación Estática** | TypeScript (`tsc --noEmit`) | Modo estricto activado (`"strict": true`) sin excepciones `any`. |
| **Formato & Linters** | Prettier / ESLint | Estandarización de estilo de código y verificación de buenas prácticas. |
| **Auditoría Constitucional** | `python scripts/check_constitution.py` | Análisis de cumplimiento de reglas de no-secretos y no-console.log. |
| **Validación SDD** | `python scripts/validate_sdd.py` | Control de estructura y completitud de artefactos de especificación. |
| **CI/CD** | GitHub Actions | Flujo automatizado en Pull Requests para ejecutar validación SDD y tests. |

## 6. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Cold start o latencia de la API de Hugging Face** | Medio | Manejo explícito de timeouts en cliente HTTP; retorno de error `503 Service Unavailable` estructurado con mensaje amigable; diseño de interfaz con spinners reactivos que informan el estado de la inferencia. |
| **Agotamiento de cuota de Hugging Face en pruebas** | Alto | Inversión de dependencias mediante interfaz `EmbeddingProvider` y fixture mock determinista en todas las suites de tests automatizados. |
| **Cálculo de similitud coseno con catálogos grandes** | Bajo a Medio | Para el alcance del MVP, el cálculo lineal O(N) en memoria backend soporta eficientemente hasta 10,000 frases (< 30ms). A partir de 10,000 frases se establece formalmente el punto de inflexión para migrar a `pgvector` en PostgreSQL con índices HNSW. |
| **Inconsistencias de contratos entre Frontend y Backend** | Medio | Definición de esquemas Zod compartidos o sincronizados; tests de integración que validan los payloads de petición y respuesta. |
