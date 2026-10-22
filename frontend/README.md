# Semantic Phrase Validator - Frontend SPA

Aplicación de Página Única (SPA) interactiva y reactiva para **Semantic Phrase Validator**, desarrollada con Vue 3 (Composition API, `<script setup>`), Vite, Tailwind CSS y TypeScript.

---

## 🏛️ Arquitectura y Principios de Diseño

El frontend implementa una separación de responsabilidades unidireccional y desacoplada, cumpliendo con la Sección 1.3 de la Constitución (`specs/constitution.md`):

```text
src/
├── main.ts                 # Punto de entrada de la aplicación Vue
├── App.vue                 # Contenedor raíz, precalentamiento y montaje de vistas
├── config/                 # Configuración de red y variables de entorno (env.ts)
├── types/                  # Contratos de tipos TypeScript compartidos (phrase.ts, api.ts, ui.ts)
├── services/               # Capa de Transporte HTTP: Cliente API fetch fuertemente tipado (api.ts, phraseService.ts)
├── composables/            # Capa de Lógica y Estado: Máquinas de estado finitas y sincronización reactiva
│   ├── usePhraseValidation.ts  # Máquina de estados de validación y control de duplicados
│   └── usePhraseCatalog.ts     # Paginación determinista, filtros reactivos y refresco
└── components/             # Capa Presentacional: Componentes visuales puros con Tailwind CSS
    ├── AppHeader.vue           # Cabecera con título e indicador visual del umbral (80.0%)
    ├── PhraseForm.vue          # Formulario principal con textarea, contador y feedback dinámico
    ├── ValidationResultCard.vue# Banner verde para frases únicas pre-validadas
    ├── DuplicateAlertCard.vue  # Alerta interactiva ámbar para duplicados potenciales
    ├── ErrorAlertBanner.vue    # Banner explicativo ante errores de red, cuota o backend
    ├── PhraseCatalog.vue       # Contenedor del catálogo histórico paginado
    ├── PhraseFilterBar.vue     # Selector de pestañas: Todas, Únicas, Duplicados
    ├── PhraseList.vue          # Lista de tarjetas o estado vacío accesible
    ├── PhraseCard.vue          # Tarjeta individual con badges, score y fecha
    └── PaginationBar.vue       # Barra de navegación entre páginas con contadores
```

---

## ⚙️ Configuración y Variables de Entorno

El cliente consume la variable de entorno `VITE_API_BASE_URL` configurada en `frontend/.env` (tomando como base `frontend/.env.example`):

| Variable | Tipo | Valor Predeterminado | Descripción |
|---|:---:|:---:|---|
| `VITE_API_BASE_URL` | String | `http://localhost:3000/api` | URL base del servidor backend donde residen los endpoints REST. |

> **Sincronización Crítica:** Si modificas el puerto del backend (`PORT=3001` en `backend/.env`), debes actualizar obligatoriamente esta variable (`VITE_API_BASE_URL=http://localhost:3001/api`) y reiniciar el servidor de desarrollo de Vite para que el navegador apunte al puerto correcto.

---

## 🔄 Máquina de Estados de Validación (`usePhraseValidation`)

El formulario de ingreso opera bajo una máquina de estados determinista que guía al usuario y previene colisiones semánticas:

| Estado | Descripción | Comportamiento del Textarea | Acciones Disponibles |
|---|---|:---:|---|
| `IDLE` | Estado inicial. Listo para escribir. | Editable libremente | «Validar similitud» y «Guardar frase» habilitados si el texto es válido [1-280 caracteres]. |
| `VALIDATING` | Consulta en curso contra `POST /api/phrases/validate`. | Bloqueado temporalmente | Spinner animado visible. Botones deshabilitados. Si la respuesta supera 150ms, se despliega el panel skeleton informativo. |
| `UNIQUE_APPROVED` | Pre-validación exitosa con afinidad < 80.0%. | Editable libremente | Se renderiza `<ValidationResultCard />` verde indicando unicidad. Modificar cualquier letra revierte a `IDLE`. |
| `DUPLICATE_INFORMATIVE` | Pre-validación exitosa con afinidad ≥ 80.0%. | Editable libremente | Se renderiza `<DuplicateAlertCard />` ámbar informativa mostrando similitud y frase causante **sin botones de forzado**. Permite editar libremente para corregir. |
| `DUPLICATE_WARNING` | Intento de guardado directo rechazado con HTTP `409 Conflict`. | **Solo Lectura (`readonly`)** | Botones principales bloqueados. Se habilitan los botones de decisión: **«Confirmar y guardar de todos modos»** (`confirmDuplicate: true`) y **«Cancelar»**. |
| `SAVING` | Persistencia en curso contra `POST /api/phrases`. | Bloqueado temporalmente | Spinner animado visible en el botón de guardado. |
| `ERROR` | Fallo de red, rate limit (`429`) o indisponibilidad de IA (`503`). | Editable libremente | Se muestra `<ErrorAlertBanner />` explicando la causa sin perder el texto ingresado. |

---

## 🎨 Diseño y Estilos con Tailwind CSS

- **Sin estilos inline:** Toda la interfaz gráfica se construye mediante utility classes de Tailwind CSS v3, garantizando coherencia visual y ligereza.
- **Micro-interacciones y accesibilidad:**
  - Contador dinámico de caracteres con advertencia en ámbar al aproximarse al límite (`> 260 chars`).
  - Animaciones de carga con spinners SVG y pulsaciones (`animate-pulse`) en estados de carga.
  - Badges semánticos: Verde esmeralda para frases únicas (`UNIQUE`), ámbar para duplicados confirmados (`CONFIRMED_DUPLICATE`).
  - Estado vacío accesible con icono y mensaje orientador cuando el catálogo no registra oraciones.

---

## 💻 Comandos de Desarrollo y Testing

Ejecutar desde el subdirectorio `frontend/`:

```bash
# Iniciar servidor de desarrollo en http://localhost:5173
npm run dev

# Validar tipos estáticos con vue-tsc en modo estricto
npm run typecheck

# Compilar aplicación optimizada para producción en dist/
npm run build

# Previsualizar el empaquetado de producción localmente
npm run preview

# Ejecutar la suite de tests unitarios y de componentes con Vitest
npm run test

# Ejecutar tests en modo interactivo/observador (watch)
npm run test:watch
```
