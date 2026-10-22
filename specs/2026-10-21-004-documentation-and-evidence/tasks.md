# Lista de Tareas: 004-documentation-and-evidence

## Fase 1: Tooling de Monorepo, Scripts DX y Diagnóstico Preventivo de IA
- [ ] 1.1 Configurar script `"typecheck": "vue-tsc -b --noEmit"` en `frontend/package.json` para permitir la verificación estática ágil del frontend sin emitir assets (RF-3, RNF-3).
- [ ] 1.2 Incorporar scripts unificados en el `package.json` de la raíz: `"db:migrate"`, `"test:hf"`, `"test:monorepo"` (secuencia unit + integration + frontend) y `"typecheck"` (backend + frontend) (RF-3, CU-1, CU-4).
- [ ] 1.3 Refactorizar `backend/src/scripts/testHuggingFace.ts` para interceptar preventivamente tokens placeholder (`hf_dummy...`) o capturar errores de autenticación/saldo (401, 402, 403), emitiendo una guía amigable con URL hacia settings de Hugging Face y salida limpia (RF-6, CE-6).

## Fase 2: Script SQL Consolidado e Idempotente para Despliegues Directos
- [ ] 2.1 Crear el archivo `scripts/schema.sql` con la definición DDL consolidada: extensión `pgcrypto`, tabla `phrases` con UUIDs, columnas `text`, `embedding` (`jsonb`), `similarity_score`, `similar_to_id`, `validation_status` y `created_at` bajo cláusulas `CREATE TABLE IF NOT EXISTS` (CU-3, RF-2, CE-3).
- [ ] 2.2 Agregar la clave foránea reflexiva de forma idempotente mediante bloque condicional `DO $$ BEGIN IF NOT EXISTS (...) THEN ALTER TABLE ... END IF; END $$;` con política `ON DELETE SET NULL` (RF-2, CE-3).
- [ ] 2.3 Crear condicionalmente el índice compuesto descendente `CREATE INDEX IF NOT EXISTS "idx_phrases_created_at_id" ON "phrases" ("created_at" DESC, "id" DESC)` (RF-2, CE-3).
- [ ] 2.4 Verificar la idempotencia del script ejecutándolo contra PostgreSQL tanto en cliente local como vía `docker exec -i semantic_phrases_postgres psql -U postgres -d semantic_phrases < scripts/schema.sql` (RF-2, CE-8).

## Fase 3: Documentación Especializada de Subpaquetes (Backend y Frontend)
- [ ] 3.1 Redactar `backend/README.md` detallando: responsabilidades del servicio, las 12 variables de entorno Zod, catálogo formal de endpoints REST (`validate`, `POST`, `GET`, `health`) con tablas de códigos HTTP, schemas Zod, políticas de seguridad (Rate Limiting, Content-Type, límite 10 KB), comandos de desarrollo/testing y ejecución de `test:hf` (RF-1, RF-4, CU-2, RNF-1).
- [ ] 3.2 Redactar `frontend/README.md` detallando: responsabilidades de la SPA, configuración de `VITE_API_BASE_URL` y sincronización con el puerto backend, arquitectura de composables y componentes, diagrama/tabla de la máquina de estados de validación semántica (7 estados) y comandos de desarrollo (`npm run dev`), build, typecheck y tests con Vue Test Utils (RF-1, CU-3, RNF-3).

## Fase 4: Portal Unificado Monorepo y Evidencia Experimental de IA (`README.md` Raíz)
- [ ] 4.1 Redactar la sección introductoria y enlaces de navegación rápida en el `README.md` de la raíz, detallando el valor diferencial del motor de similitud semántica y conectando con `backend/README.md` y `frontend/README.md` (RF-1, CU-1).
- [ ] 4.2 Documentar la guía de inicio rápido paso a paso: clonado, instalación monorepo, configuración de variables de entorno mediante copia de `.env.example`, levantamiento de PostgreSQL con Docker y arranque concurrente con `npm run dev` (CU-1, CE-1).
- [ ] 4.3 Documentar la tabla consolidada de las 13 variables de entorno del ecosistema con tipos, defaults y sincronización de puertos (`PORT` ↔ `VITE_API_BASE_URL`) (CU-1, CE-5).
- [ ] 4.4 Documentar el diagrama de arquitectura general por capas en arte ASCII, justificando el cálculo en memoria backend vs extensiones vectoriales externas, la proyección SQL sin vectores en catálogo y la caché LRU (RF-1, CU-1).
- [ ] 4.5 Documentar la sección de Evidencia Experimental de Hugging Face: modelo multilingüe de 384 dimensiones, código del proveedor e informe con las métricas numéricas verificadas (idéntica ~0.9993, paráfrasis ~0.8390 y no relacionada ~0.1014), junto con las instrucciones para reproducir en vivo con `npm run test:hf` (RF-5, CU-2).
- [ ] 4.6 Redactar la sección de pruebas automatizadas documentando los comandos monorepo (`npm run test:monorepo`), tests unitarios, tests de integración y validación estática (`npm run typecheck`) (CU-4, CE-2).
- [ ] 4.7 Redactar la guía de solución de problemas (Troubleshooting): resolución de conflictos de puertos (5432/3000), ajuste de CORS si Vite conmuta al puerto 5174, remapeo de `VITE_API_BASE_URL` y soporte sin Docker (CE-1, CE-5, CE-7).

## Fase 5: Verificación Integral, Auditoría de Calidad y Cierre de Especificación
- [ ] 5.1 Ejecutar `npm run typecheck` en el monorepo verificando cero errores de compilación estricta en TypeScript tanto en backend como en frontend (RNF-3).
- [ ] 5.2 Ejecutar `npm run test:monorepo` verificando que los 101 tests automatizados de la solución pasen limpiamente (backend unitario + backend integración + frontend) (CU-4, RNF-4).
- [ ] 5.3 Ejecutar `python scripts/check_constitution.py` verificando cero violaciones constitucionales en los 3 READMEs y el script SQL (RNF-1, RNF-2, RNF-3).
- [ ] 5.4 Ejecutar `python scripts/validate_sdd.py` asegurando que los 4 artefactos de la especificación `004-documentation-and-evidence` cumplan la validación de estructura SDD.
- [ ] 5.5 Actualizar `specs/roadmap.md` y `CHANGELOG.md` marcando la Fase 4 como completada y consolidando el hito de entrega del sistema.
