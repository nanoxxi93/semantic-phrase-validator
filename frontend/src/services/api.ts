import { API_BASE_URL } from '../config/env.js';
import type { ApiResponse, ApiErrorResponse } from '../types/api.js';

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: Record<string, unknown> | null;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details: Record<string, unknown> | null = null
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const request = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${normalizedEndpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Network communication error';
    throw new ApiClientError(
      `Unable to connect to server: ${message}`,
      0,
      'NETWORK_ERROR'
    );
  }

  let json: ApiResponse<T> | ApiErrorResponse | null = null;
  try {
    json = await response.json();
  } catch {
    // Non-JSON response body
  }

  if (response.ok) {
    if (json && typeof json === 'object' && 'success' in json && json.success === true) {
      return json.data;
    }
    return (json as unknown) as T;
  }

  if (json && typeof json === 'object' && 'success' in json && json.success === false && json.error) {
    throw new ApiClientError(
      json.error.message || 'Request failed',
      response.status,
      json.error.code || 'UNKNOWN_ERROR',
      json.error.details || null
    );
  }

  throw new ApiClientError(
    response.statusText || `Request failed with status ${response.status}`,
    response.status,
    'HTTP_ERROR'
  );
};
