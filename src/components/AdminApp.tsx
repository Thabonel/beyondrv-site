import React, { lazy, Suspense, useEffect, useState } from 'react';
import { adminFetch, adminJson, clearAdminToken } from '../lib/adminApi';

const AdminPanel = lazy(() => import('./AdminPanel'));
const GmSalesWorkspace = lazy(() => import('./GmSalesWorkspace'));

export interface AdminSessionActor {
  id: string;
  displayName: string;
  role: 'gm' | 'owner' | 'site_admin' | 'legacy_admin';
  legacy: boolean;
}

interface AdminSession {
  actor: AdminSessionActor;
  capabilities: string[];
}

function signInUrlForCurrentAdminPage() {
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/.netlify/functions/admin-login?returnTo=${encodeURIComponent(returnTo)}`;
}

function openGmWorkspace() {
  const url = new URL(window.location.href);
  url.searchParams.set('view', 'gm');
  window.location.href = url.toString();
}

export default function AdminApp() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function signOut() {
    await adminFetch('/.netlify/functions/admin-logout', { method: 'POST' });
    clearAdminToken();
    window.location.href = '/.netlify/functions/admin-login';
  }

  useEffect(() => {
    let active = true;
    adminFetch('/.netlify/functions/admin-session', { cache: 'no-store' })
      .then(async response => {
        if (response.status === 401) {
          clearAdminToken();
          window.location.href = signInUrlForCurrentAdminPage();
          return null;
        }
        if (!response.ok && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
          return {
            actor: { id: 'local-preview', displayName: 'Local preview', role: 'legacy_admin', legacy: true },
            capabilities: [],
          } as AdminSession;
        }
        const body = await adminJson<AdminSession>(response, 'Could not load the admin session');
        if (!response.ok || !body.actor) throw new Error(body.error || 'Could not load the admin session.');
        return body as AdminSession;
      })
      .then(result => {
        if (active && result) setSession(result);
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load the admin session.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div style={{ minHeight: 'calc(100vh - 60px)', display: 'grid', placeItems: 'center', color: '#aaa' }}>Opening your workspace…</div>;
  }

  if (error || !session) {
    return (
      <div style={{ minHeight: 'calc(100vh - 60px)', display: 'grid', placeItems: 'center', padding: '1rem' }}>
        <div style={{ maxWidth: '420px', color: '#fca5a5', lineHeight: 1.5, textAlign: 'center' }}>
          {error || 'Your admin session could not be loaded.'}
          <div><a href={signInUrlForCurrentAdminPage()} style={{ color: '#fff' }}>Return to sign in</a></div>
        </div>
      </div>
    );
  }

  if (session.actor.role === 'gm') {
    return <Suspense fallback={<div style={{ minHeight: 'calc(100vh - 60px)', display: 'grid', placeItems: 'center', color: '#aaa' }}>Opening Today…</div>}><GmSalesWorkspace actor={session.actor} /></Suspense>;
  }

  if (session.actor.role === 'owner' && new URLSearchParams(window.location.search).get('view') === 'gm') {
    return <Suspense fallback={<div style={{ minHeight: 'calc(100vh - 60px)', display: 'grid', placeItems: 'center', color: '#aaa' }}>Opening GM workspace…</div>}><GmSalesWorkspace actor={session.actor} ownerPreview onExitPreview={() => { const url = new URL(window.location.href); url.searchParams.delete('view'); window.location.href = url.toString(); }} /></Suspense>;
  }

  return <Suspense fallback={<div style={{ minHeight: 'calc(100vh - 60px)', display: 'grid', placeItems: 'center', color: '#aaa' }}>Opening admin tools…</div>}><AdminPanel onOpenGmWorkspace={session.actor.role === 'owner' ? openGmWorkspace : undefined} onSignOut={() => void signOut()} /></Suspense>;
}
