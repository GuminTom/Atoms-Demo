import { createClient } from '@metagptx/web-sdk';

// Create client instance
export const client = createClient();

/**
 * Convenience wrapper around client.apiCall.invoke().
 * The web-sdk only exposes client.apiCall.invoke({ url, method, data }),
 * so we provide familiar get/put/post/delete helpers.
 * apiCall.invoke returns an AxiosResponse, so res.data contains the actual body.
 */
export const api = {
  get: (url: string) =>
    client.apiCall.invoke({ url, method: 'GET' }).then((res: any) => res.data ?? res),

  put: (url: string, data?: Record<string, unknown>) =>
    client.apiCall.invoke({ url, method: 'PUT', data }).then((res: any) => res.data ?? res),

  post: (url: string, data?: Record<string, unknown>) =>
    client.apiCall.invoke({ url, method: 'POST', data }).then((res: any) => res.data ?? res),

  delete: (url: string) =>
    client.apiCall.invoke({ url, method: 'DELETE' }).then((res: any) => res.data ?? res),
};