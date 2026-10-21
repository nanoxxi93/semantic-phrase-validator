# Misión del producto

> **Nombre del producto:** Semantic Phrase Validator  
> **Estado:** Fase 0 (Constitución y Planificación Inicial)

## Pitch
Semantic Phrase Validator es una aplicación web Fullstack AI orientada al registro y gestión de oraciones cortas que previene activamente la redundancia conceptual. Mediante modelos de embeddings de última generación de Hugging Face y cálculo de similitud coseno en tiempo de interacción, detecta paráfrasis y similitudes semánticas profundas antes de guardar, permitiendo al usuario tomar decisiones conscientes sobre duplicados potenciales y asegurando una base de datos limpia y enriquecida con metadatos analíticos.

## Problema
- **Falsos negativos en validaciones tradicionales:** Las validaciones habituales basadas en igualdad exacta (`===`) o expresiones regulares fallan completamente al comparar frases con idéntico significado pero diferente formulación sintáctica o léxica (ejemplo: *"Debo pagar el recibo de la luz"* vs *"Cancelar la factura eléctrica pendiente"*).
- **Contaminación de repositorios de conocimiento:** En listas de ideas, copys, notas rápidas o requerimientos, la duplicación conceptual fragmenta la información y exige esfuerzos manuales repetitivos de limpieza y consolidación posterior.
- **Falta de asistencia proactiva:** La mayoría de interfaces imponen validaciones rígidas que bloquean sin explicar o, por el contrario, permiten la inserción descontrolada sin advertir al usuario sobre la existencia de contenido equivalente.

## Qué informa/hace la app (y qué no)

### Lo que SÍ hace:
- Proporciona una interfaz simple y reactiva para introducir oraciones cortas y consultar el histórico de frases guardadas.
- Ofrece un flujo de validación semántica interactivo antes de consolidar el almacenamiento de una nueva frase.
- Genera representaciones vectoriales densas (embeddings de 384 dimensiones) consumiendo la API de Hugging Face Inference.
- Compara matemáticamente mediante similitud coseno el vector candidato frente a todos los vectores previamente persistidos.
- Alerta visualmente al usuario cuando la similitud supera un umbral configurable (ej. 0.80), indicando la frase más parecida encontrada y su porcentaje/score exacto de afinidad semántica.
- Otorga al usuario control total: permite cancelar la operación para editar la frase o confirmar el guardado intencional como duplicado.
- Persiste en PostgreSQL la frase junto a su vector en formato `JSONB` y metadatos completos de validación (`similarity_score`, `similar_to_id`, `validation_status`: `UNIQUE` | `CONFIRMED_DUPLICATE` y fecha de creación).
- Refleja inmediatamente en la interfaz el listado actualizado mostrando los metadatos de validación correspondientes.

### Lo que NO hace:
- No es un procesador de texto largo, analizador de artículos extensos ni gestor documental (está optimizado estrictamente para oraciones o frases cortas).
- No realiza reescritura generativa automática ni altera el texto del usuario sin su consentimiento explícito.
- No bloquea de manera arbitraria o irreversible al usuario; el usuario siempre tiene la última palabra para confirmar o descartar.
- No ejecuta reentrenamientos locales de modelos neuronales (utiliza inferencia sobre un modelo preentrenado multilingüe).

## Usuarios objetivo

| Persona | Descripción | Necesidad principal |
|---|---|---|
| **Creadores de Contenido y Copywriters** | Profesionales que generan copys breves, slogans o títulos. | Evitar redundancia temática y verificar rápidamente si una idea o ángulo conceptual ya fue registrado. |
| **Product Managers y Analistas** | Responsables de registrar requerimientos, hipótesis o tareas rápidas en listas de trabajo. | Mantener un backlog conciso libre de tareas duplicadas redactadas con distinta jerga. |
| **Estudiantes e Investigadores** | Usuarios que recopilan citas clave, definiciones o conclusiones conceptuales. | Identificar relaciones semánticas entre anotaciones y mantener fichas de síntesis depuradas. |

## Propuesta de valor
1. **Detección Semántica Inteligente:** Análisis multilingüe profundo basado en inteligencia artificial capaz de entender sinonimia, contexto y paráfrasis, superando las limitaciones de la concordancia textual clásica.
2. **Control Centrado en el Usuario:** Validación no intrusiva con ciclo de retroalimentación inmediata; el sistema sugiere y previene, pero el usuario decide confirmar o cancelar el guardado.
3. **Persistencia Enriquecida y Trazabilidad:** Almacenamiento no solo del texto, sino de su huella vectorial, su estado de unicidad/duplicidad y la trazabilidad hacia la frase causante del duplicado con su score respectivo.

## Funcionalidades clave (visión)

### Núcleo (MVP)
- **Formulario de captura:** Input de texto optimizado para oraciones cortas con validación de longitud.
- **Validación Semántica Pre-Save:** Botón de validación que consulta el servicio de inferencia de embeddings y calcula la similitud coseno contra el catálogo persistido.
- **Modal / Alerta de Duplicado Potencial:** Indicador claro que destaca el score obtenido, la frase original con mayor similitud y botones de acción rápida ("Confirmar Guardado" / "Cancelar").
- **Persistencia en PostgreSQL:** Modelo de datos en Drizzle ORM con campos para frase, embedding (`JSONB`), score, id de referencia, estado (`UNIQUE` | `CONFIRMED_DUPLICATE`) y timestamp.
- **Listado Histórico Reactivo:** Vista de frases guardadas con badges visuales de estado y metadatos de validación.

### Complementarias
- **Configuración dinámica de umbral:** Parámetro `SIMILARITY_THRESHOLD` ajustable por variable de entorno para calibrar la sensibilidad del detector.
- **Filtrado por estado de validación:** Filtros rápidos en la UI para inspeccionar frases únicas frente a duplicados confirmados.

## Qué NO es este producto (fuera de alcance)
- Autenticación y gestión de múltiples usuarios.
- Edición o eliminación de frases previamente registradas (el catálogo funciona como registro histórico inmutable de validaciones).
- Procesamiento de textos largos o carga masiva de archivos (documentos, CSV o PDF).

## Principios de diseño
- **Claridad y Transparencia:** Cada advertencia semántica debe mostrar el porcentaje de similitud exacto y la frase coincidente para que el usuario entienda el criterio de la IA.
- **Autonomía:** La IA asiste y recomienda, nunca actúa como un filtro destructivo o bloqueante irreversible.
- **Respuesta Rápida y Fluida:** Los procesos de extracción y cálculo de similitud deben brindar retroalimentación visual inmediata (loaders y feedback reactivo).

## Métricas de éxito

| Métrica | Objetivo MVP |
|---|---|
| **Efectividad en Detección de Paráfrasis** | > 90% de paráfrasis obvias detectadas por encima del umbral de 0.80. |
| **Tiempo de Respuesta de Validación** | < 1.5 segundos en la llamada al endpoint de validación semántica. |
| **Precisión de Metadatos Persistidos** | 100% de registros con estados de validación, scores y relaciones íntegras. |
| **Tasa de Aceptación/Usabilidad** | El usuario puede completar el flujo de validación y decisión en menos de 2 clics. |

## Diferenciadores frente a la competencia
- **Semántica Real vs. Búsqueda Sintáctica:** Supera las aplicaciones estándar tipo to-do list o notas que solo admiten filtros literales de texto.
- **Auditoría de Duplicados:** Almacena el historial del porqué se consideró duplicada una frase, permitiendo análisis analíticos posteriores sobre los datos.
- **Arquitectura Liviana y Eficiente:** Implementación con embeddings normalizados y similitud coseno directa sin sobrecostes innecesarios de bases de datos vectoriales sobredimensionadas para volúmenes medianos.
