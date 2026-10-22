# Lista de Tareas: 003-phrase-validator-ui

## Fase 1: Configuración del Workspace Frontend y Tooling Base
- [ ] 1.1 Inicializar el subdirectorio `frontend/` mediante `npm create vite@latest frontend -- --template vue-ts` y configurar `workspaces: ["backend", "frontend"]` en el `package.json` raíz junto a los scripts `dev:frontend` y `test:frontend` (RNF-1).
- [ ] 1.2 Instalar y configurar Tailwind CSS v3 (`tailwindcss`, `postcss`, `autoprefixer`) en `frontend/` con las familias tipográficas *Inter* y *JetBrains Mono* configuradas en `tailwind.config.js` y las directivas `@tailwind` en `src/assets/main.css` (RNF-2).
- [ ] 1.3 Configurar Vitest, `@vue/test-utils` y `happy-dom` en `frontend/vite.config.ts`, y asegurar compilación estricta con TypeScript (`"strict": true`, cero `any`) en `frontend/tsconfig.json` (RNF-5, CA-14).

## Fase 2: Tipos de Dominio, Configuración de Entorno y Capa de Transporte de Red
- [ ] 2.1 Definir contratos de tipos en `frontend/src/types/`: `ValidationStatus`, `SimilarPhraseSummary`, `PhraseListItem` en `phrase.ts`; `ApiResponse<T>`, `ApiErrorResponse`, `PhraseValidationResult`, `PaginatedPhrases` en `api.ts`; y `UiState` (`'IDLE' | 'VALIDATING' | 'SAVING' | 'UNIQUE_APPROVED' | 'DUPLICATE_WARNING' | 'ERROR'`), `ErrorState` en `ui.ts` (RNF-5).
- [ ] 2.2 Implementar `frontend/src/config/env.ts` para resolver `import.meta.env.VITE_API_BASE_URL` con fallback a `http://localhost:3000/api` en desarrollo local (RF-4, RNF-6).
- [ ] 2.3 Implementar el cliente HTTP centralizado en `frontend/src/services/api.ts` con la clase de error personalizada `ApiClientError`, parseo defensivo de respuestas JSON `{ success, data }` y mapeo de errores HTTP (`400`, `409 DUPLICATE_PHRASE`, `429 RATE_LIMIT_EXCEEDED`, `503 AI_SERVICE_UNAVAILABLE`, `NETWORK_ERROR`) (RF-4, RNF-6, CE-4, CE-5, CE-8).
- [ ] 2.4 Implementar `frontend/src/services/phraseService.ts` exponiendo `validatePhrase`, `createPhrase`, `listPhrases` y `checkHealth`, junto con su suite de pruebas unitarias en Vitest con mocks de `fetch` (RF-3, RF-4).

## Fase 3: Composables Reactivos (Máquinas de Estado y Catálogo)
- [ ] 3.1 Implementar el composable `usePhraseValidation` en `frontend/src/composables/usePhraseValidation.ts`:
  - Estado reactivo: `phraseText`, `charCount` (reactivo sobre 280), `isValidText` (sanitizado con `trim`), `uiState`, `validationResult`, `errorState` (RF-1, RF-2, CE-1, CE-2).
  - Acciones: `validatePhrase()`, `savePhrase()`, `confirmDuplicateSave()`, `cancelDuplicate()` y `reset()` (CU-1, CU-2, CU-3, RF-2).
  - Bloqueo en solo lectura del `textarea` durante `DUPLICATE_WARNING` y descarte automático a `IDLE` de los banners `UNIQUE_APPROVED` o `ERROR` ante modificaciones en el input (CE-9, CE-10).
- [ ] 3.2 Implementar el composable `usePhraseCatalog` en `frontend/src/composables/usePhraseCatalog.ts`:
  - Estado reactivo: `phrases`, `pagination` (page, limit=10, total, totalPages), `activeFilter` (`'ALL' | 'UNIQUE' | 'CONFIRMED_DUPLICATE'`), `isLoading` (RF-5).
  - Acciones: `fetchCatalog()`, `setFilter(filter)` (reseteando a página 1), `changePage(page)` y `onPhraseCreated(createdPhrase)` (RF-5, RF-6).
  - Reajuste automático de visualización: si al crear una frase el filtro activo la ocultaría o `page > 1`, conmuta a `'ALL'` y página 1 para visibilidad inmediata en el tope (CU-4, RF-5).
- [ ] 3.3 Escribir pruebas unitarias exhaustivas con Vitest para `usePhraseValidation` y `usePhraseCatalog` cubriendo el 100% de las transiciones de estado, sanitización, bloqueos y manejo de errores (CA-02, CA-03, CA-04, CA-05, CA-06, CA-07, CA-08, CA-09).

## Fase 4: Componentes UI del Formulario y Banners de Validación
- [ ] 4.1 Implementar `frontend/src/components/AppHeader.vue` mostrando el título, descripción e indicador de umbral fijo de 80.0% conforme a la maqueta (CA-11).
- [ ] 4.2 Implementar `frontend/src/components/ValidationResultCard.vue` para el estado `UNIQUE_APPROVED` con badge verde, puntaje porcentual formateado y cita de la frase más cercana o mensaje de catálogo inicial (CA-02, CE-7).
- [ ] 4.3 Implementar `frontend/src/components/DuplicateAlertCard.vue` para el estado `DUPLICATE_WARNING` con borde y fondo ámbar, puntaje porcentual de afinidad, cita destacada de `similarPhrase` y botones activos de «Confirmar y guardar de todos modos» y «Cancelar» (CU-3, CA-03, CA-06, CA-07).
- [ ] 4.4 Implementar `frontend/src/components/ErrorAlertBanner.vue` para el estado `ERROR` mostrando el código de error (`RATE_LIMIT_EXCEEDED`, `AI_SERVICE_UNAVAILABLE`, etc.), mensaje accesible y preservación de texto con reintento (CA-15, CE-4, CE-5, CE-8).
- [ ] 4.5 Implementar `frontend/src/components/PhraseForm.vue` integrando el textarea con `maxlength="280"`, contador dinámico de caracteres con alerta visual ámbar, renderizado dinámico de cards de estado, y botones de acción («Validar similitud» y «Guardar frase») con loaders `animate-spin` y deshabilitación durante advertencias o procesos en curso (CU-1, CU-2, RF-1, CE-2, CE-3).
- [ ] 4.6 Escribir pruebas de componentes con `@vue/test-utils` para `PhraseForm`, `DuplicateAlertCard` y banners de validación (CA-02, CA-03, CA-05).

## Fase 5: Componentes UI del Catálogo Histórico y Paginación
- [ ] 5.1 Implementar `frontend/src/components/PhraseFilterBar.vue` con pestañas interactivas («Todas», «Únicas», «Duplicados Confirmados») con indicadores circulares de color y conteos actualizados (CU-4, RF-5).
- [ ] 5.2 Implementar `frontend/src/components/PhraseCard.vue` para representar cada frase con su texto entrecomillado, badge de estado (`Única` en verde, `Duplicado Confirmado` en ámbar con puntaje de similitud), bloque trazable a `similarPhrase` y fecha formateada relativa/absoluta (CA-12).
- [ ] 5.3 Implementar `frontend/src/components/PaginationBar.vue` con leyenda informativa («Página X de Y · Total: Z frases»), botones «Anterior» y «Siguiente» con bloqueo en los extremos y emit de cambio de página (CA-13).
- [ ] 5.4 Implementar `frontend/src/components/PhraseList.vue` renderizando la lista de tarjetas o un estado vacío accesible y amigable si no hay frases registradas (CE-7).
- [ ] 5.5 Implementar `frontend/src/components/PhraseCatalog.vue` integrando la barra de filtros, listado de frases y controles de paginación conectados a `usePhraseCatalog` (RF-5).
- [ ] 5.6 Escribir pruebas de componentes con `@vue/test-utils` para el catálogo, filtros y paginación (CA-08, CA-09, CA-12, CA-13).

## Fase 6: Ensamble en App.vue, Sonda Silenciosa y Estilizado Fiel a Maqueta
- [ ] 6.1 Ensamblar en `frontend/src/App.vue` los componentes `<AppHeader />`, `<PhraseForm />` y `<PhraseCatalog />`, conectando el evento `phrase-saved` para sincronizar reactivamente el catálogo (RF-6).
- [ ] 6.2 Integrar en el ciclo de vida `onMounted` de `App.vue` la invocación en segundo plano de `phraseService.checkHealth()` para mitigar el arranque en frío (cold start) del backend, sin renderizar elementos visuales en la interfaz (RF-3, CA-10).
- [ ] 6.3 Ajustar tipografías (*Inter* y *JetBrains Mono*) e importación de Google Fonts en `frontend/index.html` y refinar estilos Tailwind en `src/assets/main.css` garantizando paridad estética 1:1 con `maqueta_ui_semantic_phrase_validator.html` (RNF-2, RNF-3).

## Fase 7: Verificación Integral, Calidad y Cumplimiento Constitucional
- [ ] 7.1 Ejecutar suite completa de tests de frontend (`npm --prefix frontend run test` o `npm run test:frontend`) verificando 100% de éxito en tests unitarios y de componentes (RNF-5).
- [ ] 7.2 Ejecutar verificación de tipos de TypeScript con `vue-tsc --noEmit` comprobando compilación estricta sin errores ni tipos `any` (RNF-5).
- [ ] 7.3 Ejecutar auditoría constitucional automatizada (`python scripts/check_constitution.py`) verificando cero infracciones en `frontend/src/` (cero `console.log`, cero estilos inline, cero secretos) (RNF-1, RNF-2).
- [ ] 7.4 Ejecutar validador de especificaciones SDD (`python scripts/validate_sdd.py`) verificando integridad estructural completa de los 4 artefactos en `specs/2026-10-21-003-phrase-validator-ui/`.
