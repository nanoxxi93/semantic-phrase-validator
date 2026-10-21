# Tech Stack

> **Estado:** Fase Inicial

## 1. Restricciones de plataforma que definen la arquitectura

### Plataforma Principal
{{JUSTIFICACION_DE_LA_PLATAFORMA}}

### Alternativas descartadas
{{POR_QUE_SE_DESCARTARON}}

## 2. Decisiones de Ingeniería Core

| Opción | Estado | Motivo |
|---|---|---|
| {{OPCION_A}} | ❌ Descartada | {{MOTIVO}} |
| {{OPCION_B}} | ✅ **Elegida** | {{MOTIVO}} |

### Configuración obligatoria

Las reglas innegociables de minimización de datos, privacidad y comportamiento pasivo están descritas en [`constitution.md`](constitution.md). Aquí solo se detalla el motor/herramienta elegido.

### Sin backend

Regla estricta definida en [`constitution.md`](constitution.md). Solo se usa {{HERRAMIENTA_REMOTO}} para configuraciones remotas.

## 3. Arquitectura general

```text
┌──────────────────────── Entorno ────────────────────────┐
│                                                         │
│                    {{DIAGRAMA_AQUI}}                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Estrategia de conexión / Flujo de datos
{{DESCRIPCION_FLUJO}}

## 4. Tecnologías Elegidas

| Área | Elección | Justificación |
|---|---|---|
| Lenguaje | **{{LENGUAJE}}** | {{JUSTIFICACION}} |
| UI | **{{FRAMEWORK_UI}}** | {{JUSTIFICACION}} |
| Arquitectura | **{{PATRON}}** | {{JUSTIFICACION}} |
| Inyección de dependencias | **{{LIBRERIA_DI}}** | {{JUSTIFICACION}} |
| Persistencia | **{{DB_LOCAL}}** | {{JUSTIFICACION}} |

### Estructura de Módulos (Propuesta)
```text
app/                      # Application, configuración
core/model                # Entidades de dominio
core/data                 # Repositorio
feature/xyz               # Funcionalidades aisladas
```

## 5. Calidad y entrega

| Área | Herramienta |
|---|---|
| Tests unitarios | {{TEST_FRAMEWORK}} |
| Tests de UI | {{UI_TEST_FRAMEWORK}} |
| Lint / formato | {{LINTER}} |
| CI/CD | {{CI_CD}} |

## 6. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| {{RIESGO_1}} | Alto | {{MITIGACION_1}} |
