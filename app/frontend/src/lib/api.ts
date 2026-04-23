import { createClient } from '@metagptx/web-sdk';

// Create client instance
export const client = createClient();

/**
 * Get the local auth token from localStorage if available.
 */
function getLocalAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

/**
 * Build headers object with Authorization if a local auth token exists.
 */
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getLocalAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Native fetch-based API client.
 *
 * We use the browser's fetch API directly instead of the web-sdk's apiCall.invoke,
 * because the SDK does not reliably forward custom Authorization headers for our
 * local-auth JWT tokens. This ensures every request carries the token when
 * present, so the FastAPI backend can authenticate the user.
 */
async function request<T = any>(url: string, method: string, data?: Record<string, unknown>): Promise<T> {
  const init: RequestInit = {
    method,
    headers: authHeaders(),
    credentials: 'include',
  };
  if (data !== undefined) {
    init.body = JSON.stringify(data);
  }

  const response = await fetch(url, init);

  // Try to parse JSON body; fallback to text for non-JSON responses
  let body: any = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => '');
    body = text || null;
  }

  if (!response.ok) {
    const detail =
      (body && typeof body === 'object' && (body.detail || body.message)) ||
      (typeof body === 'string' ? body : `Request failed with status ${response.status}`);
    const err = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    (err as any).status = response.status;
    (err as any).body = body;
    throw err;
  }

  return body as T;
}

export const api = {
  get: <T = any>(url: string) => request<T>(url, 'GET'),
  put: <T = any>(url: string, data?: Record<string, unknown>) => request<T>(url, 'PUT', data),
  post: <T = any>(url: string, data?: Record<string, unknown>) => request<T>(url, 'POST', data),
  delete: <T = any>(url: string) => request<T>(url, 'DELETE'),
};

/**
 * Build a query URL for entity endpoints.
 *
 * Supports an optional filter dict (serialized as JSON in the `query` param),
 * pagination, and sorting.
 */
export function buildEntityQueryUrl(
  basePath: string,
  queryDict?: Record<string, unknown>,
  options?: { limit?: number; sort?: string; skip?: number }
): string {
  const params = new URLSearchParams();

  if (queryDict && Object.keys(queryDict).length > 0) {
    params.set('query', JSON.stringify(queryDict));
  }
  if (typeof options?.limit === 'number') {
    params.set('limit', String(options.limit));
  }
  if (typeof options?.skip === 'number') {
    params.set('skip', String(options.skip));
  }
  if (options?.sort) {
    params.set('sort', options.sort);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}