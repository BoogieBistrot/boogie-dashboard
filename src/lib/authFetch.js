export function authFetch(url, options = {}) {
  const token = localStorage.getItem('bb-auth-token') || (import.meta.env.DEV ? 'dev-bypass' : '');
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  });
}
