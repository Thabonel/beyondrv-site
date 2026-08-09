export function safeAdminReturnTo(candidate: string | null | undefined): string {
  if (!candidate) return '/admin/';

  try {
    const url = new URL(candidate, 'https://beyondrv.invalid');
    if (url.origin !== 'https://beyondrv.invalid') return '/admin/';
    if (url.pathname !== '/admin' && url.pathname !== '/admin/') return '/admin/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/admin/';
  }
}
