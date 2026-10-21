# Changelog

Registro de cambios de Semantic Phrase Validator. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); el proyecto usa [Versionado Semántico](https://semver.org/lang/es/) desde la primera versión publicada.

Mientras no haya versiones, todo va en **Sin publicar**, agrupado por fecha (la más reciente arriba).

Categorías: **Añadido** (algo nuevo) · **Cambiado** (algo existente se comporta distinto) · **Obsoleto** (se eliminará pronto) · **Eliminado** · **Corregido** (bugs) · **Seguridad**.

## [Sin publicar]

### 2026-10-20

#### Añadido
- Inicialización del proyecto y configuración de gobernanza base SDD (Fase 0).
- Definición de documentos fundacionales en `specs/`: misión del producto, stack tecnológico (Node.js v24+, Express, TypeScript, Vue 3, Drizzle ORM, PostgreSQL y Hugging Face Inference), constitución del software y roadmap de desarrollo.
- Reglas automatizadas de cumplimiento de la constitución (`specs/constitution.rules.json`) para escaneo de secretos y logs.
