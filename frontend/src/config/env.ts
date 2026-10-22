/**
 * Frontend environment configuration module.
 * Resolves the backend base URL from VITE_API_BASE_URL, defaulting to local development URL.
 */
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
).replace(/\/+$/, '');
