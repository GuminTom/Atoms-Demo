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
  const token = getLocalAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Convenience wrapper around client.apiCall.invoke().
 * The web-sdk only exposes client.apiCall.invoke({ url, method, data }),
 * so we provide familiar get/put/post/delete helpers.
 * apiCall.invoke returns an AxiosResponse, so res.data contains the actual body.
 *
 * For local-auth endpoints, the auth token from localStorage is attached
 * automatically via the Authorization header.
 */
export const api = {
  get: (url: string) =>
    client.apiCall.invoke({ url, method: 'GET', headers: authHeaders() }).then((res: any) => res.data ?? res),

  put: (url: string, data?: Record<string, unknown>) =>
    client.apiCall.invoke({ url, method: 'PUT', data, headers: authHeaders() }).then((res: any) => res.data ?? res),

  post: (url: string, data?: Record<string, unknown>) =>
    client.apiCall.invoke({ url, method: 'POST', data, headers: authHeaders() }).then((res: any) => res.data ?? res),

  delete: (url: string) =>
    client.apiCall.invoke({ url, method: 'DELETE', headers: authHeaders() }).then((res: any) => res.data ?? res),
};