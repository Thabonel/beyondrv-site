// src/components/CookieConsent.tsx
import { useState, useEffect } from 'react';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('brv_cookie_consent');
    if (!consent) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem('brv_cookie_consent', 'accepted');
    setVisible(false);
    window.dispatchEvent(new Event('brv-cookie-accepted'));
  }

  function decline() {
    localStorage.setItem('brv_cookie_consent', 'declined');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#111', borderTop: '1px solid #333',
      padding: '1rem 1.5rem', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
      fontSize: '0.85rem', color: '#ccc',
    }}>
      <span>
        We use cookies to understand how the site is used.{' '}
        <a href="/privacy-policy/" style={{ color: '#E8540A', textDecoration: 'none' }}>
          Privacy policy
        </a>
      </span>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={decline}
          style={{ background: 'none', border: '1px solid #444', color: '#888', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          Decline
        </button>
        <button
          onClick={accept}
          style={{ background: '#E8540A', border: 'none', color: '#fff', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
