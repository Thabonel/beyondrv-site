export default async function adminGate(request: Request) {
  const expected = Netlify.env.get('ADMIN_PASSWORD');
  const cookie = request.headers.get('cookie') ?? '';
  const isAllowed =
    Boolean(expected) &&
    cookie
      .split(';')
      .map((part) => part.trim())
      .includes(`brv_admin_auth=${encodeURIComponent(expected ?? '')}`);

  if (isAllowed) {
    return;
  }

  const url = new URL(request.url);
  url.pathname = '/.netlify/functions/admin-login';
  url.search = '';
  return Response.redirect(url, 302);
}

export const config = {
  path: ['/admin', '/admin/', '/admin/analytics', '/admin/analytics/'],
};
