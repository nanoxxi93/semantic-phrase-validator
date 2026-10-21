# Semantic Phrase Validator

Aplicación web Fullstack AI tipo lista de frases cortas con detección inteligente de duplicados semánticos previos a la persistencia, empleando embeddings de Hugging Face y cálculo de similitud coseno contra un umbral configurable.

- **Spec-Driven Development (SDD)**: El proyecto sigue estrictamente el ciclo de SDD. Todo desarrollo pasa por las skills en `.claude/skills/` (`specify` → `clarify` → `plan` → `tasks` → `checklist` → `analyze` → `implement` → `close` → `publish`).
- **Base del Producto**: `specs/mission.md`, `specs/tech-stack.md`, `specs/roadmap.md`, `specs/constitution.md`. Siempre consúltalos.
- **Specs por funcionalidad**: `specs/AAAA-MM-DD-<nombre>/` generadas por las skills.
- Idioma de la documentación: español. Finales de línea: LF.

## Registros que se mantienen mientras se trabaja

### `CHANGELOG.md` — qué cambió
Agrega una entrada **en el mismo turno** en que termines un cambio que afecte al producto, la arquitectura, las specs o la configuración del repo:
- Dentro de `## [Sin publicar]`, bajo el encabezado de la fecha de hoy (`date +%F`); créalo arriba de los demás si no existe.
- En la categoría que corresponda (Añadido, Cambiado, Obsoleto, Eliminado, Corregido, Seguridad). Crea la categoría si no existe en esa fecha.
- Una línea por cambio, desde el punto de vista de quien lee el proyecto, no la lista de archivos tocados. Enlaza la spec si la hay.
- No registres ediciones menores sin efecto (typos, formato).

### `specs/intentos-fallidos.md` — qué no funcionó
Antes de proponer un enfoque, una librería o una solución a un bug, **busca en este archivo**. Si ya está registrado, no lo repitas salvo que se cumpla su condición de *Reconsiderar si*, y dilo explícitamente.

Agrega una entrada cuando:
- Algo que se probó falló: build, test, librería, configuración, experimento de la Fase 0, comportamiento de un dispositivo.
- Un enfoque se descartó tras analizarlo y es probable que alguien lo vuelva a proponer.

Cómo:
- Usa la plantilla del archivo, con el siguiente ID `IF-NNN`, y agrégala **arriba** de las demás y en el índice.
- Anota la causa, no solo el síntoma, e incluye mensajes de error textuales y versiones.
- Las entradas no se borran. Si algo cambia (p. ej. una nueva versión de la librería lo arregla), agrega una nota con fecha al final de la entrada.
- No registres errores triviales corregidos al momento (typos, imports faltantes).
