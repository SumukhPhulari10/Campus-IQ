/// <reference types="vite/client" />

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === 'string' && input.startsWith('/api/')) {
    return window.fetch(`${apiBaseUrl}${input}`, init);
  }

  return window.fetch(input, init);
}