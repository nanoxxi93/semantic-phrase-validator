# Constitución del Proyecto

Este archivo captura los principios, restricciones y estándares no negociables que rigen el proyecto **Semantic Phrase Validator**. Sirve como barandilla fundamental para el desarrollo asistido por IA (Spec-Driven Development) y constituye la única fuente de verdad para estas directivas. Las especificaciones técnicas detalladas viven en `tech-stack.md` y la visión de producto en `mission.md`.

---

## 1. Estándares Arquitectónicos y Separación de Responsabilidades

### 1.1 Separación Estricta por Capas en Backend
El código del backend debe respetar una arquitectura en capas unidireccional y desacoplada sin atajos entre niveles:
- **`controllers/` (Capa de Transporte HTTP):** Responsable exclusivo de parsear peticiones HTTP, invocar esquemas de validación Zod, llamar a los servicios de dominio correspondientes y mapear los resultados a códigos de estado HTTP estándar. Los controladores jamás ejecutan consultas SQL directas ni contienen lógica de negocio o cálculos matemáticos.
- **`services/` (Capa de Dominio y Negocio):** Contiene la orquestación del flujo de validación semántica, la evaluación de umbrales (`SIMILARITY_THRESHOLD`) y las decisiones de duplicidad. No conoce detalles de Express (no recibe `req` ni `res`).
- **`repositories/` (Capa de Acceso a Datos):** Encapsula todas las operaciones de consulta y persistencia en PostgreSQL mediante Drizzle ORM. Es la única capa autorizada a importar esquemas de tablas Drizzle y ejecutar queries en base de datos.
- **`providers/` (Capa de Integración Externa):** Aloja los clientes de servicios externos (específicamente Hugging Face Inference API). No contiene lógica de negocio y debe responder a contratos abstractos.
- **`utils/` (Utilidades Puras):** Funciones deterministas puras sin efectos secundarios ni dependencias de I/O, en particular el cálculo matemático de similitud coseno entre vectores numéricos.

### 1.2 Inversión de Dependencias en Inferencia de IA
- El cliente de Hugging Face debe implementar obligatoriamente la interfaz abstracta `EmbeddingProvider` (ej. `generateEmbedding(text: string): Promise<number[]>`).
- La capa de servicios (`PhraseService`) debe recibir su instancia de `EmbeddingProvider` mediante inyección de dependencias (vía constructor o factoría).
- Queda terminantemente prohibido instanciar el SDK de Hugging Face o realizar llamadas directas a APIs de red dentro de los tests unitarios o suites automatizadas de integración. Los tests deben utilizar implementaciones mock deterministas (`MockEmbeddingProvider`).

### 1.3 Frontend Desacoplado y Arquitectura Basada en Composables
- **Composables Reactivos (`composables/`):** Toda la lógica de estado, ciclo de vida de validación semántica (máquina de estados: *idle*, *validating*, *duplicate_detected*, *saving*, *success*, *error*), temporizadores y llamadas a la API REST deben encapsularse dentro de Vue Composables (ej. `usePhraseValidation`, `usePhraseCatalog`).
- **Componentes UI Presentacionales (`components/`):** Los componentes Vue (`<script setup>`) deben mantenerse orientados a la presentación, recibiendo props e interactuando mediante eventos/emits o consumiendo composables limpios. No deben existir llamadas directas a `fetch` o `axios` incrustadas en templates o scripts de componentes.
- **Estilos con Tailwind CSS:** Toda la presentación gráfica debe implementarse mediante clases de utilidad de Tailwind CSS, evitando estilos CSS inline o bloques `<style>` personalizados no justificados.

---

## 2. Contratos, Validación y Manejo Estandarizado de Errores

### 2.1 Validación de Contratos con Zod
- Toda entrada HTTP (`req.body`, `req.query`, `req.params`) debe validarse de forma obligatoria mediante esquemas Zod antes de alcanzar la capa de servicios.
- Si la validación de Zod falla, el servidor debe responder de inmediato con `400 Bad Request` y un desglose detallado de los campos erróneos.

### 2.2 Estructura JSON Estandarizada
Todas las respuestas de la API REST deben mantener una estructura uniforme y predecible:

#### Respuesta Exitosa:
```json
{
  "success": true,
  "data": { ... }
}
```

#### Respuesta de Error:
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST | SERVICE_UNAVAILABLE | INTERNAL_ERROR",
    "message": "Descripción comprensible del error",
    "details": null
  }
}
```

### 2.3 Códigos HTTP Obligatorios:
- `200 OK`: Peticiones de consulta o validación procesadas exitosamente.
- `201 Created`: Frase persistida con éxito en PostgreSQL.
- `400 Bad Request`: Payload inválido, texto vacío o campos fuera de rango según schema Zod.
- `500 Internal Server Error`: Errores no controlados de base de datos o fallos internos.
- `503 Service Unavailable`: Errores al conectar con el servicio de inferencia de IA (Hugging Face) o indisponibilidad de la API externa, evitando caídas silenciosas.

---

## 3. Configuración Externa y Seguridad

### 3.1 Variables de Entorno Estrictas
- Se prohíbe taxativamente escribir credenciales, URLs de base de datos o claves de API dentro del código fuente.
- Todas las variables sensibles deben inyectarse mediante archivos `.env` (no versionados) y validarse al inicio del servidor mediante un esquema Zod de configuración (`src/config/env.ts`):
  - `DATABASE_URL`: Cadena de conexión PostgreSQL.
  - `HF_TOKEN`: Token de acceso para la API de inferencia de Hugging Face.
  - `HF_MODEL`: Identificador del modelo (ej. `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`).
  - `SIMILARITY_THRESHOLD`: Valor numérico flotante para el umbral de detección de duplicados (ej. `0.80`).
  - `PORT`: Puerto HTTP para el servidor backend (ej. `3000`).

### 3.2 Minimización de Datos y Privacidad
- La aplicación únicamente almacena el texto de la oración corta, su representación vectorial en coma flotante (`JSONB`) y los metadatos analíticos de validación (`similarity_score`, `similar_to_id`, `validation_status`, `created_at`).
- No se recopilan datos biométricos, direcciones IP ni datos de identificación personal (PII) innecesarios.

---

## 4. Estándares de Calidad y Codificación

### 4.1 Test-Driven Development (TDD) y Cobertura
- Ninguna funcionalidad de negocio o cálculo de similitud se considera terminada sin su correspondiente suite de tests automatizados en Vitest.
- La función de cálculo de similitud coseno (`calculateCosineSimilarity`) debe poseer pruebas unitarias exhaustivas con casos de vectores ortogonales (similitud 0), vectores idénticos (similitud 1), vectores opuestos (similitud -1) y vectores de longitud dispar o nula.
- Las rutas HTTP deben validarse mediante pruebas de integración con `supertest` inyectando un `MockEmbeddingProvider`.

### 4.2 Convención Lingüística y Nomenclatura
- **Código Fuente:** Nombres de variables, funciones, interfaces, clases y comentarios técnicos en inglés (ej. `calculateCosineSimilarity`, `PhraseRepository`, `isDuplicate`).
- **Documentación y Especificaciones:** Idioma español en toda la carpeta `specs/`, `README.md`, `CLAUDE.md` y `CHANGELOG.md`.
- **Commits Semánticos:** Estilo Conventional Commits obligatorio (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).

### 4.3 Limpieza y Calidad en Producción
- Se prohíbe el uso de `console.log` en código destinado a producción (debe utilizarse un logger estructurado o removerse antes de commit).
- Cero tolerancia a tipos `any` en TypeScript; el proyecto debe compilar con `"strict": true`.

---

## 5. Gobernanza y Auditoría Continua

- Ningún cambio de arquitectura o variación de stack tecnológico puede aplicarse sin actualizar previamente este archivo y `specs/tech-stack.md`.
- Las directivas automatizadas en `specs/constitution.rules.json` son ejecutadas por `scripts/check_constitution.py` en cada validación local y en pipelines de CI/CD.
