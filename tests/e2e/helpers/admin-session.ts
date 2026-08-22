import type { Page } from '@playwright/test';

const ownerCapabilities = [
  'sales:read', 'sales:write', 'agreements:read', 'agreements:write', 'agreements:approve',
  'agreements:send', 'agreements:record_acceptance', 'configurations:read', 'configurations:write',
  'configurations:approve', 'deposits:verify', 'builds:read', 'builds:release', 'site:read',
  'site:write', 'integrations:manage', 'audit:read',
];

export async function mockOwnerAdminSession(page: Page) {
  await page.route('**/.netlify/functions/admin-session', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      actor: { id: 'owner-e2e', displayName: 'Beyond RV Owner', role: 'owner', legacy: false },
      capabilities: ownerCapabilities,
    }),
  }));
}
