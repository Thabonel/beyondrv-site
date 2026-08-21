import { expect, test } from '@playwright/test';

const insight = {
  title: 'Promote the Advent 2450 to towing families',
  recommendation: 'Run a towing-capacity campaign aimed at dual-cab owners.',
  evidence: '18 enquiries in 30 days against 4 page views per enquiry.',
  priority: 'high',
};

const IDEA_ID = 'marketing_idea_promote-the-advent-2450-to-towing-families_1a2b3c';

const dashboard = {
  generatedAt: '2026-08-21T00:00:00.000Z',
  range: '30',
  decisions: [],
  lifecycle: [],
  orders: {
    total: 0, paid: 0, enquiryLinked: 0, shippingBlocked: 0,
    byStatus: [], byShippingStatus: [], recent: [],
  },
  inventory: {
    totalProducts: 0, available: 0, onSale: 0, comingSoon: 0, featured: 0, estimatedListedValue: 0,
    byCategory: [], byStatus: [], planning: [], weakListings: [],
  },
  leads: { last7Days: 0, last30Days: 0, open: 0, dueToday: 0, overdue: 0, byStatus: [], priorityQueue: [], followUpQueue: [], recent: [] },
  tasks: { open: 0, dueToday: 0, overdue: 0, recent: [] },
  productPerformance: [],
  productInterest: { unknownProductEnquiries: 0, topProducts: [], staleProducts: [] },
  traffic: [], funnel: [],
  marketingInsights: { status: 'ready', message: '', items: [insight] },
  chat: { topTopics: [], recent: [] },
  analytics: { status: 'unavailable', message: 'Not configured' },
  contact: { ready: true, toEmail: 'test@example.com', fromEmail: 'test@example.com' },
  readiness: [],
};

function savedIdea(status: string) {
  return {
    id: IDEA_ID,
    title: insight.title,
    audience: '',
    sourceQuestion: '',
    recommendation: insight.recommendation,
    evidence: insight.evidence,
    priority: insight.priority,
    status,
    relatedLeadId: '',
    createdAt: '2026-08-21T00:00:00.000Z',
    updatedAt: '2026-08-21T00:00:00.000Z',
  };
}

test('a dashboard marketing insight can be saved and moved through its review status', async ({ page }) => {
  const writes: Array<{ method: string; payload: Record<string, unknown> }> = [];

  await page.route('**/.netlify/functions/admin-dashboard?range=30', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(dashboard),
  }));

  await page.route('**/.netlify/functions/admin-marketing-ideas', async route => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ideas: [] }) });
      return;
    }
    const payload = request.postDataJSON() as Record<string, unknown>;
    writes.push({ method: request.method(), payload });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, idea: savedIdea(String(payload.status ?? 'idea')) }),
    });
  });

  await page.goto('/admin/');

  // The insight starts unsaved, and the saved list is empty.
  const insightCard = page.getByTestId('marketing-insight').filter({ hasText: insight.title });
  await expect(insightCard).toHaveCount(1);
  await expect(page.getByText('No saved ideas yet.', { exact: false })).toBeVisible();

  // Each dashboard panel explains itself under its heading.
  await expect(page.getByText('Insights you kept, tracked from idea through drafted, approved, and published.')).toBeVisible();
  await expect(page.getByText('Campaign recommendations generated from your analytics, rebuilt on every page load.')).toBeVisible();

  await insightCard.getByRole('button', { name: 'Save idea' }).click();

  // Saving posts the full insight, including the evidence and priority.
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].method).toBe('POST');
  expect(writes[0].payload).toMatchObject({
    title: insight.title,
    recommendation: insight.recommendation,
    evidence: insight.evidence,
    priority: insight.priority,
  });

  // The saved idea appears in the list with its evidence and a status control.
  const ideaRow = page.getByTestId(`marketing-idea-${IDEA_ID}`);
  await expect(ideaRow).toBeVisible();
  await expect(ideaRow.getByText(insight.evidence)).toBeVisible();
  await expect(ideaRow.getByRole('combobox')).toHaveValue('idea');

  // Both panels describe the same priority with the same word.
  await expect(insightCard.getByTestId('marketing-insight-priority')).toHaveText('High');
  await expect(ideaRow.getByTestId('marketing-idea-priority')).toHaveText('High');

  // The insight's button stays live so a regenerated insight can refresh the record.
  const savedButton = insightCard.getByRole('button');
  await expect(savedButton).toBeEnabled();
  await expect(savedButton).toHaveText('Update saved idea');

  // Re-saving posts the insight again rather than being blocked.
  await savedButton.click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].method).toBe('POST');
  expect(writes[1].payload).toMatchObject({ title: insight.title, evidence: insight.evidence });

  // Changing the status patches only the id and the new status.
  await ideaRow.getByRole('combobox').selectOption('approved');
  await expect.poll(() => writes.length).toBe(3);
  expect(writes[2].method).toBe('PATCH');
  expect(writes[2].payload).toEqual({ id: IDEA_ID, status: 'approved' });
  await expect(ideaRow.getByRole('combobox')).toHaveValue('approved');
});
