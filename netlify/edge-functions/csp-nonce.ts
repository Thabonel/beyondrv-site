export default async function cspNonce(_request: Request, context: any) {
  const response = await context.next();

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const csp = response.headers.get('Content-Security-Policy') || '';
  if (!csp) {
    return response;
  }

  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));

  const directives = csp.split(';').map((d: string) => d.trim()).filter(Boolean);
  const newDirectives = directives.map((d: string) => {
    const name = d.split(/\s+/)[0].toLowerCase();
    if (name === 'script-src') {
      const sources = d.slice(name.length).trim().split(/\s+/);
      const filtered = sources.filter(s => s !== "'unsafe-inline'");
      return `script-src 'nonce-${nonce}' ${filtered.join(' ')}`;
    }
    return d;
  });

  let body = await response.text();
  body = body.replace(/<script(?![^>]*\snonce=)([^>]*)>/gi, `<script nonce="${nonce}"$1>`);

  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', newDirectives.join('; '));

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const config = {
  path: '/*',
};
