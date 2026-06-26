export function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  return fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers,
  });
}

export async function adminJson<T>(res: Response, fallbackError: string): Promise<T & { error?: string }> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await res.json() as T & { error?: string };
  }

  const text = await res.text();
  const looksLikeHtml = /^\s*<!doctype|^\s*<html/i.test(text);
  const detail = looksLikeHtml
    ? 'The admin function returned HTML instead of JSON. Local admin API routes require Netlify dev, not Astro preview.'
    : text.slice(0, 220);

  throw new Error(`${fallbackError}: ${detail}`);
}

export function clearAdminToken() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem('brv_admin_token');
}
