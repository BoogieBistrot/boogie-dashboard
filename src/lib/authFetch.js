export function authFetch(url, options = {}) {
  const token = localStorage.getItem('bb-auth-token') || '';
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  });
}
