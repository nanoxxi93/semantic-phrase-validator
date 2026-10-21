# Constitución del Proyecto

Este archivo captura los principios, restricciones y estándares no negociables que rigen el proyecto **{{PROJECT_NAME}}**. Sirve como barandilla para el desarrollo asistido por IA (Spec-Driven Development) y es la única fuente de la verdad para estas reglas. Las decisiones técnicas puntuales viven en `tech-stack.md` y la motivación en `mission.md`.

## Estándares Tecnológicos
- **Plataforma Única:** {{DEFINIR_PLATAFORMA}}
- **Lenguaje y UI:** {{DEFINIR_LENGUAJE_Y_UI}}
- **Arquitectura:** {{DEFINIR_ARQUITECTURA}}
- **Sin Backend Propio / Backend Serverless:** {{DEFINIR_REGLA_BACKEND}}

## Privacidad y Restricciones de Dominio
- **Minimización de Datos Extrema:** {{DEFINIR_REGLAS_PRIVACIDAD}}
- **Comportamiento Pasivo:** {{DEFINIR_COMPORTAMIENTO_SISTEMA}}
- **Aislamiento Seguro:** {{DEFINIR_ALMACENAMIENTO_CREDENCIALES}}

## Principios de Experiencia de Usuario (UX)
- **Nunca Estorbar:** {{DEFINIR_REGLA_UX}}
- **Fluidez:** {{DEFINIR_REGLA_PERFORMANCE}}
- **Fallar en Silencio y Honestidad:** {{DEFINIR_MANEJO_ERRORES}}

## Estándares de Codificación
- **Test-Driven Development (TDD):** Sin un test que falle primero, no se escribe código de producto.
- **Aislamiento del Motor/Librería Principal:** {{DEFINIR_ENCAPSULAMIENTO_CORE}}
- **Compatibilidad y Versionado:** Commits semánticos (`feat:`, `fix:`, `docs:`). Todo el código está en español para la documentación e inglés para variables y funciones.

## Gobernanza y Manejo de Riesgos
- **Consentimiento de Riesgo:** {{DEFINIR_REGLAS_CONSENTIMIENTO}}
- **Control Antiveto:** {{DEFINIR_REGLAS_TELEMETRIA_O_KILLSWITCH}}
