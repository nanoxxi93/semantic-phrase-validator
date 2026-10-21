# {{PROJECT_NAME}}

{{PROJECT_SHORT_DESCRIPTION}}

**Specs primero (SDD):** El proyecto usa **Spec-Driven Development**. Toda funcionalidad nueva nace en [`specs/`](./specs) con sus requerimientos, plan técnico, y desglose de tareas, pasando por un ciclo de auditoría antes de tocar código. La misión, constitución, pila técnica y hoja de ruta viven allí.
El ciclo completo se ejecuta usando las skills ubicadas en [`.claude/skills/`](./.claude/skills) en este orden estricto: `specify` → `clarify` → `plan` → `tasks` → `checklist` → `analyze` → `implement` → `close` → `publish`. Para entender el detalle del proceso, **lee siempre [`specs/README.md`](./specs/README.md) primero**.

**Memoria Local de la IA:** Para evitar errores repetitivos de entorno local (como usar CRLF en Windows, o ejecutar comandos bash incompatibles con PowerShell), cualquier IA que trabaje en este repo buscará y respetará el archivo **`.ai-context.md`**. Ese archivo NO se commitea, y la IA tiene la orden de **actualizarlo** ante cualquier tropiezo con el sistema operativo local para "recordarlo" en chats futuros.

## Documentación Fundacional

- **Requisitos y Planificación**: Ver [`specs/README.md`](./specs/README.md).
- **Misión y UX**: [`specs/mission.md`](./specs/mission.md).
- **Constitución (Reglas de Oro)**: [`specs/constitution.md`](./specs/constitution.md).
- **Tech Stack y Arquitectura**: [`specs/tech-stack.md`](./specs/tech-stack.md).
- **Hoja de Ruta**: [`specs/roadmap.md`](./specs/roadmap.md).
- **Intentos Fallidos**: Ver [`specs/intentos-fallidos.md`](./specs/intentos-fallidos.md) antes de proponer soluciones o librerías.
- **Cambios e Historial**: Registrados en [`CHANGELOG.md`](./CHANGELOG.md).
