# Semantic Phrase Validator - Frontend

Interfaz de usuario SPA construida con Vue 3, Vite, Tailwind CSS y TypeScript para la validación y gestión semántica de frases.

## Variables de Entorno

Copiar el archivo de plantilla `.env.example` a `.env`:

```bash
cp .env.example .env
```

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `VITE_API_BASE_URL` | URL base de la API REST del backend (incluyendo prefijo `/api`) | `http://localhost:3000/api` |

## Scripts Disponibles

Desde la raíz del monorepo o dentro del directorio `frontend/`:

- `npm run dev` (o desde la raíz: `npm run dev:frontend` / `npm run dev`): Inicia el servidor de desarrollo Vite (`http://localhost:5173`).
- `npm run build`: Compila la aplicación para producción con verificación de tipos TypeScript (`vue-tsc -b && vite build`).
- `npm run preview`: Previsualiza el build de producción localmente.
- `npm run test`: Ejecuta la suite de pruebas unitarias y de componentes con Vitest.
