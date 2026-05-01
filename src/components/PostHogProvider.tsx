// src/components/PostHogProvider.tsx
import { useEffect } from 'react';
import posthog from 'posthog-js';

const PH_KEY = import.meta.env.PUBLIC_POSTHOG_KEY as string | undefined;
const PH_HOST = 'https://us.i.posthog.com';

function initPostHog() {
  if (!PH_KEY) return;
  if ((posthog as any).__loaded) return;
  posthog.init(PH_KEY, {
    api_host: PH_HOST,
    autocapture: true,
    capture_pageview: true,
    persistence: 'localStorage',
  });
}

export default function PostHogProvider() {
  useEffect(() => {
    if (localStorage.getItem('brv_cookie_consent') === 'accepted') {
      initPostHog();
    }

    function handleConsent() {
      initPostHog();
    }
    window.addEventListener('brv-cookie-accepted', handleConsent);

    // Fire enquiry_submitted on the thank-you page
    if (window.location.pathname.includes('/inquiry-form/success')) {
      const timer = setTimeout(() => {
        if (!(posthog as any).__loaded) return;
        let extra: Record<string, unknown> = {};
        try { extra = { ...JSON.parse(localStorage.getItem('brv_referral') || '{}') }; } catch {}
        try { extra = { ...extra, ...JSON.parse(localStorage.getItem('brv_utm') || '{}') }; } catch {}
        posthog.capture('enquiry_submitted', extra);
      }, 1200);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('brv-cookie-accepted', handleConsent);
      };
    }

    return () => window.removeEventListener('brv-cookie-accepted', handleConsent);
  }, []);

  return null;
}
