import { expect, test } from '@playwright/test';

test('GM can review and confirm a typed post-call note without a microphone', async ({ page }) => {
  await page.route('**/.netlify/functions/admin-voice-capture-extract', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ capture: {
      id: 'voice-1', status: 'needs_confirmation', transcript: 'Spoke to Alex. Send photos tomorrow.',
      proposal: { summary: 'Spoke to Alex about the 3.5m pop-top.', customerName: 'Alex Smith', productInterest: '3.5m pop-top', followUpDate: '2026-08-20', followUpReason: 'Send photos', appointmentDateTime: '', moneyMentions: [{ amountText: '$148,500', meaning: 'price discussed', sourceExcerpt: 'one hundred and forty-eight thousand five hundred' }], discussedItems: ['Photos'], unresolvedItems: ['Cabinet colour'], requiresAgreementReview: true, confidence: 'high' },
    } }),
  }));
  let confirmation: Record<string, string> | null = null;
  await page.route('**/.netlify/functions/admin-voice-capture-confirm', async route => {
    confirmation = route.request().postDataJSON() as Record<string, string>;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { message: 'Call note saved.' } }) });
  });
  await page.goto('/admin/quick-note/');
  await page.getByLabel('What happened on the call?').fill('Spoke to Alex. Send photos tomorrow.');
  await page.getByRole('button', { name: 'Understand typed note' }).click();
  await expect(page.getByRole('heading', { name: 'Here is what I understood' })).toBeVisible();
  await expect(page.getByText('Money is stored only in the call note.')).toBeVisible();
  await page.getByLabel(/Customer phone/).fill('0400 000 002');
  await page.getByRole('button', { name: 'Correct — Save Everything' }).click();
  await expect(page.getByText('Call note saved.')).toBeVisible();
  expect(confirmation).toMatchObject({ captureId: 'voice-1', customerPhone: '0400 000 002', followUpDate: '2026-08-20' });
});

test('GM can discard an unconfirmed call note before it reaches a customer record', async ({ page }) => {
  await page.route('**/.netlify/functions/admin-voice-capture-extract', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ capture: {
      id: 'voice-discard', status: 'needs_confirmation', transcript: 'Temporary note',
      proposal: { summary: 'Temporary call summary', customerName: '', productInterest: '', followUpDate: '', followUpReason: '', appointmentDateTime: '', moneyMentions: [], discussedItems: [], unresolvedItems: [], requiresAgreementReview: false, confidence: 'medium' },
    } }),
  }));
  let discardedId = '';
  await page.route('**/.netlify/functions/admin-voice-capture-discard', async route => {
    discardedId = (route.request().postDataJSON() as { captureId: string }).captureId;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.goto('/admin/quick-note/');
  await page.getByLabel('What happened on the call?').fill('Temporary note');
  await page.getByRole('button', { name: 'Understand typed note' }).click();
  await page.getByRole('button', { name: 'Discard / re-record' }).click();
  await expect(page.getByRole('button', { name: 'Understand typed note' })).toBeVisible();
  expect(discardedId).toBe('voice-discard');
});
