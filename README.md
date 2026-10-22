# Semantic Phrase Validator

Aplicación web Fullstack AI tipo lista de oraciones cortas con detección proactiva de duplicados semánticos previos a la persistencia. La solución analiza el significado conceptual de cada frase mediante embeddings densos generados por Hugging Face y cálculo de similitud coseno frente a un umbral configurable (0.80), permitiendo al usuario pre-validar oraciones, recibir alertas visuales y confirmar o cancelar el guardado de duplicados.

El proyecto está construido como un **monorepo desacoplado** bajo la metodología **Spec-Driven Development (SDD)**, con una arquitectura limpia por capas (Clean Architecture / Hexagonal) y más de **100 tests automatizados**.

---

## 🧭 Navegación Rápida del Monorepo

Para documentación detallada y especializada por servicio, consulta los portales técnicos dedicados:

- 🖥️ **[Portal Frontend (SPA en Vue 3)](./frontend/README.md):** Arquitectura de componentes, Tailwind CSS, máquina de estados finita (`usePhraseValidation`), catálogo reactivo y pruebas de interfaz con Vue Test Utils.
- ⚙️ **[Portal Backend (REST API en Express)](./backend/README.md):** Catálogo formal de endpoints REST, esquemas de validación Zod, persistencia con Drizzle ORM, seguridad (Rate Limiting, límites de 10 KB) y scripts de Hugging Face.
- 📐 **[Especificaciones y Gobernanza SDD](./specs/README.md):** Metodología Spec-Driven Development, misión del producto, constitución innegociable, decisiones técnicas y hoja de ruta.

---

## 🛠️ Pila Tecnológica

| Capa | Tecnología | Justificación Técnica |
|---|---|---|
| **Frontend** | Vue 3 (`<script setup>`, TypeScript) + Vite | Reactividad atómica, excelente encapsulación de lógica en composables y compilación ultrarrápida. |
| **Estilos UI** | Tailwind CSS v3 | Construcción declarativa con clases utilitarias, microinteracciones y cero estilos CSS redundantes. |
| **Backend** | Node.js (v24+ / v20.19+) + Express + TypeScript | Runtime de alto rendimiento para I/O asíncrono, con tipado estático estricto (`"strict": true`, cero `any`). |
| **Validación de Datos** | Zod | Esquemas tipados seguros tanto para runtime (body/query parsing) como para inferencia estática de TypeScript. |
| **Base de Datos** | PostgreSQL 17 + Drizzle ORM | Schema-as-code tipado en TypeScript nativo, almacenamiento vectorial en `JSONB` y migraciones reproducibles. |
| **Motor de IA** | SDK `@huggingface/inference` | Feature Extraction serverless utilizando el modelo multilingüe `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`. |
| **Caché en Memoria** | `lru-cache` | Almacenamiento LRU de vectores para reducir latencias de inferencia de ~250ms a <2ms y optimizar saldo de API. |
| **Testing** | Vitest + `@vue/test-utils` + Supertest | Suite de testing ultrarrápida con 101 pruebas automatizadas cubriendo capas unitarias, integración y UI. |
| **Contenedores** | Docker Compose | Contenedor local reproducible de PostgreSQL 17 para desarrollo y tests de integración. |

---

## 📋 Prerrequisitos de Sistema

- **Node.js:** Versión LTS `>= 20.19.0` o `v24.x` instalada ([nodejs.org](https://nodejs.org/)).
- **npm:** Versión `>= 10.x`.
- **Docker y Docker Compose:** Para inicializar el contenedor local de PostgreSQL 17 ([docker.com](https://www.docker.com/)).
- **Credenciales de Hugging Face (Opcional para pruebas):** Para ejecutar inferencia real en caliente, se requiere una cuenta con saldo activo y token de acceso en [huggingface.co](https://huggingface.co/settings/tokens).
  > *Nota:* Para ejecutar la suite completa de 101 tests automatizados (`npm run test:monorepo`), **no se requiere conexión a internet ni saldo en Hugging Face**, ya que el sistema implementa una arquitectura basada en inversión de dependencias con un `MockEmbeddingProvider` determinista.

---

## 🚀 Guía de Instalación y Puesta en Marcha Rápida

Sigue estos 5 pasos para poner en marcha el proyecto completo en tu entorno local:

### 1. Clonar el repositorio e instalar dependencias
```bash
git clone <url-del-repositorio>
cd semantic-phrase-validator

# Instala las dependencias del monorepo, backend y frontend en un solo paso:
npm install
```

### 2. Configurar variables de entorno
Copia las plantillas de configuración en sus respectivos subdirectorios:

**En Linux / macOS / Git Bash:**
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**En Windows PowerShell:**
```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

> *Si dispones de un token de Hugging Face con saldo activo, configúralo en `backend/.env` en la variable `HF_TOKEN`. De lo contrario, puedes conservar el token por defecto para desarrollo con base de datos local y tests.*

### 3. Iniciar la Base de Datos con Docker Compose
Levanta el contenedor de PostgreSQL 17 en segundo plano:
```bash
docker compose up -d
```
*(El servicio expondrá PostgreSQL en `localhost:5432` con usuario `postgres`, contraseña `postgrespassword` y base de datos `semantic_phrases`).*

### 4. Inicializar el Esquema de Base de Datos
Tienes dos alternativas directas:

- **Opción A (Recomendada con Drizzle ORM):**
  ```bash
  npm run db:migrate
  ```
- **Opción B (Directa mediante inyección SQL sin dependencias de Node):**
  ```bash
  docker exec -i semantic_phrases_postgres psql -U postgres -d semantic_phrases < scripts/schema.sql
  ```

### 5. Iniciar la Aplicación en Modo Desarrollo
Ejecuta el comando concurrente desde la raíz del monorepo:
```bash
npm run dev
```

El sistema levantará ambos entornos en paralelo:
- 🌐 **Frontend (SPA):** [http://localhost:5173](http://localhost:5173)
- ⚙️ **Backend (API REST):** [http://localhost:3000](http://localhost:3000) (Sonda de salud en `http://localhost:3000/api/health`)

---

## 🔐 Variables de Entorno del Ecosistema

El sistema utiliza 13 variables de entorno tipadas y validadas con esquemas Zod:

### Backend (`backend/.env`)
| Variable | Tipo | Valor Predeterminado | Propósito |
|---|:---:|:---:|---|
| `DATABASE_URL` | String | `postgresql://postgres:postgrespassword@localhost:5432/semantic_phrases` | Cadena de conexión JDBC/PostgreSQL. |
| `HF_TOKEN` | String | `hf_dummy_token_for_dev` | Token de Hugging Face para llamadas en caliente de inferencia. |
| `HF_MODEL` | String | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Modelo de Feature Extraction multilingüe (vector de 384 dimensiones). |
| `PORT` | Número | `3000` | Puerto HTTP donde escucha el servidor Express. |
| `NODE_ENV` | Enum | `development` | Entorno de ejecución (`development`, `test`, `production`). |
| `SIMILARITY_THRESHOLD` | Float | `0.80` | Umbral para clasificar una frase como duplicado semántico (0.80 = 80%). |
| `TRUST_PROXY` | Número | `1` | Saltos de proxies inversos para detección de IP real del cliente. |
| `EMBEDDING_CACHE_TTL_SECONDS` | Número | `3600` | Tiempo de vida (TTL) de vectores en la caché LRU en memoria (1 hora). |
| `RATE_LIMIT_WINDOW_MS` | Número | `60000` | Ventana temporal de limitación de peticiones (1 minuto en ms). |
| `RATE_LIMIT_INFERENCE_MAX` | Número | `30` | Límite máximo de llamadas por minuto para endpoints de inferencia. |
| `RATE_LIMIT_READ_MAX` | Número | `100` | Límite máximo de llamadas por minuto para endpoints de consulta. |
| `CORS_ORIGINS` | String | `http://localhost:5173,http://localhost:3000` | Orígenes HTTP autorizados para interactuar con la API. |

### Frontend (`frontend/.env`)
| Variable | Tipo | Valor Predeterminado | Propósito |
|---|:---:|:---:|---|
| `VITE_API_BASE_URL` | String | `http://localhost:3000/api` | URL base de los endpoints REST del backend. |

> ⚠️ **Sincronización:** Si modificas `PORT=3001` en `backend/.env`, debes actualizar obligatoriamente `VITE_API_BASE_URL=http://localhost:3001/api` en `frontend/.env`.

---

## 🏗️ Arquitectura del Sistema y Decisiones de Ingeniería

El proyecto aplica una **Clean Architecture** unidireccional y desacoplada mediante inversión de dependencias:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                       FRONTEND                                         │
│                      (Vue 3 + Vite + Tailwind CSS - Cloudflare Pages)                  │
│                                                                                        │
│   ┌───────────────────────────┐         ┌──────────────────────────────────────────┐   │
│   │   Componentes Visuales    │ <=====> │        Composables / State Machine       │   │
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
│   │ Controladores (Rutas: POST /validate, POST /phrases, GET /phrases)             │   │
│   └────────────────────────────────────────┬───────────────────────────────────────┘   │
│                                            ▼                                           │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ Servicios (PhraseService - Reglas de Negocio, Umbral Semántico y Caché LRU)   │   │
│   └───────────────┬───────────────────────────────────────────────┬────────────────┘   │
│                   │                                               │                    │
│                   ▼                                               ▼                    │
│   ┌────────────────────────────────┐            ┌──────────────────────────────────┐   │
│   │ Repositorios (Drizzle ORM)     │            │ Proveedores (EmbeddingProvider)  │   │
│   └───────────────┬────────────────┘            └─────────────────┬────────────────┘   │
└───────────────────┼───────────────────────────────────────────────┼────────────────────┘
                    │                                               │
                    ▼                                               ▼
         ┌─────────────────────┐                     ┌──────────────────────────────┐
         │     PostgreSQL      │                     │     Hugging Face API         │
         │  (Docker / Neon)    │                     │  (Feature Extraction 384d)   │
         │ (schema: 'phrases') │                     │ (paraphrase-multilingual...) │
         └─────────────────────┘                     └──────────────────────────────┘
```

### Decisiones de Ingeniería Destacadas:
1. **Cálculo de Similitud Coseno en Memoria Backend vs. Bases Vectoriales Externas:**
   Para catálogos de hasta 10.000 oraciones cortas, el cálculo matemático lineal $O(N)$ en memoria de Node.js toma menos de **25 ms**, evitando la complejidad de infraestructura, latencias de red añadidas y costes de servicios vectoriales externos (Pinecone / Qdrant).
2. **Optimización Dual: Cortocircuito Léxico y Caché LRU de Embeddings:**
   - *Cortocircuito:* Si el usuario introduce una frase con texto idéntico a una existente (normalizada sin espacios superfluos ni diferencias de mayúsculas), el backend responde con score `1.0000` de forma instantánea (**0 llamadas a la IA y 0 coste de saldo**).
   - *Caché LRU:* Si una frase ya fue evaluada en la última hora, su vector de 384 dimensiones se recupera de la RAM, reduciendo el tiempo de respuesta de **~250 ms a <2 ms**.
3. **Proyección SQL Selectiva:**
   Al consultar el catálogo paginado (`GET /api/phrases`), el repositorio excluye deliberadamente el vector de 384 números en punto flotante (`JSONB`), transmitiendo exclusivamente el texto, fecha, score y estado, minimizando drásticamente la transferencia de datos.
4. **Protección DoS y Rate Limiting:**
   Se restringe el cuerpo de las peticiones a un máximo de **10 KB** con Express y se limita la inferencia a 30 peticiones por minuto por dirección IP real.

---

## 🤖 Evidencia Experimental de Integración con Hugging Face

El sistema utiliza el modelo de lenguaje multilingüe [`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2) a través del SDK oficial `@huggingface/inference`.

Para comprobar la inferencia real y el cálculo de similitud coseno en vivo contra los servidores de Hugging Face, ejecuta:

```bash
npm run test:hf
```

### Resultados Experimentales Obtenidos y Verificados en Caliente:

```text
=====================================================
Prueba de Integración y Validación Semántica con Hugging Face
Modelo: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
=====================================================

Resultados de Similitud Coseno:
-----------------------------------------------------
1. Coincidencia Idéntica:
   Frase A: "Debo pagar la factura de la luz mañana"
   Frase B: "debo pagar la factura de la luz mañana" (case-insensitive)
   Score: 0.9993 (100% idéntica -> Duplicado detectado)

2. Paráfrasis Conceptual (Sin vocabulario compartido):
   Frase A: "Debo pagar la factura de la luz mañana"
   Frase B: "Tengo que pagar el recibo de electricidad mañana"
   Score: 0.8390 (Alta similitud semántica > Umbral 0.80 -> Duplicado detectado)

3. Tema no relacionado:
   Frase A: "Debo pagar la factura de la luz mañana"
   Frase B: "La receta de pastel de chocolate lleva tres huevos"
   Score: 0.1014 (Sin relación semántica < Umbral 0.80 -> Frase única aprobada)
-----------------------------------------------------

[EXITO] Inferencia y validación semántica completadas con éxito.
```

---

## 🧪 Pruebas Automatizadas y Calidad de Código

El repositorio cuenta con **101 tests automatizados** distribuidos en todas las capas del software:

```bash
# 1. Ejecutar la totalidad de los 101 tests del monorepo en una sola pasada:
npm run test:monorepo

# 2. Ejecutar validación estática estricta de tipos (TypeScript sin emitir JS):
npm run typecheck

# 3. Comandos específicos por nivel de prueba:
npm run test:unit         # Tests unitarios del backend (Vectores, caché LRU, servicios)
npm run test:integration  # Tests de integración del backend (Supertest + DB + Rate Limiting)
npm run test:frontend     # Tests unitarios y de componentes de Vue 3 (Vitest + Happy-DOM)
```

### Validación Constitucional y de Especificaciones (SDD):
```bash
# Auditar cumplimiento de especificaciones formales (5 features auditadas):
npm run validate:sdd

# Auditar reglas constitucionales (Cero secretos, no console.log, formato LF):
npm run check:constitution
```

---

## 🔧 Solución de Problemas (Troubleshooting)

- **Conflicto con el puerto de PostgreSQL (5432 ocupado):**
  Si tu máquina anfitriona ya tiene una instancia local de PostgreSQL corriendo, modifica el puerto exterior en `docker-compose.yml`:
  ```yaml
  ports:
    - "5433:5432"
  ```
  Y actualiza la cadena de conexión en `backend/.env`: `DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5433/semantic_phrases`.
- **Vite conmuta al puerto 5174 y bloquea por CORS:**
  Si el puerto 5173 está en uso y Vite inicia en el 5174, agrega el nuevo puerto a la lista blanca en `backend/.env`:
  ```env
  CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:3000
  ```
  Y reinicia el backend para aplicar los cambios.
- **Despliegue sin contenedor Docker:**
  Puedes conectar el backend a cualquier base de datos PostgreSQL externa o administrada en la nube (ej. [Neon](https://neon.tech/), [Supabase](https://supabase.com/)) simplemente configurando su URL en la variable `DATABASE_URL` de `backend/.env` y ejecutando `npm run db:migrate`.
- **Aviso de saldo en `npm run test:hf`:**
  Si ejecutas el script de prueba en caliente de Hugging Face y recibes un aviso formativo sobre `HF_TOKEN`, puedes generar un token con permisos de lectura o inferencia en [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) y recargar saldo en [huggingface.co/settings/billing](https://huggingface.co/settings/billing). Recuerda que para ejecutar los tests automatizados (`npm run test:monorepo`) no requieres saldo.
