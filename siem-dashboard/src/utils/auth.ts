/**
 * Auth Utility — JWT Token Management
 *
 * Centralizes token storage, retrieval, and authenticated fetch calls.
 * All frontend components should use `authFetch()` instead of raw `fetch()`
 * for any request to protected backend endpoints.
 */

const TOKEN_KEY = 'authToken';

/** Store the JWT token received from login/register */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Retrieve the stored JWT token */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Remove token (logout) */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Wrapper around fetch() that automatically attaches the JWT token
 * as an Authorization: Bearer header. Use this for ALL protected API calls.
 *
 * Usage:
 *   const res = await authFetch('/api/dashboard/stats');
 *   const data = await res.json();
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Ensure Content-Type is set for JSON bodies if not already
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
