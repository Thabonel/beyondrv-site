export function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('brv_admin_token') : '';
  const headers = new Headers(init.headers);

  if (token) headers.set('x-admin-token', token);

  return fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers,
  });
}

export function clearAdminToken() {
  localStorage.removeItem('brv_admin_token');
}
