import { expect, test } from '@playwright/test';

const product = {
  slug: 'advent-2150-hardtop-slide-on',
  title: 'Advent 2150 Hardtop Ute Slide-On Camper',
  category: 'slide-on',
  status: 'on-sale',
  onSale: true,
  price: '$49,990',
  enquiries30Days: 0,
  totalEnquiries: 2,
  pageViews: 18,
  conversionRate: '0.0',
  flags: ['No enquiries in 30 days', 'On sale with no recent enquiries'],
};

const dashboard = {
  generatedAt: '2026-06-15T00:00:00.000Z',
  range: '30',
  decisions: [],
  inventory: {
    totalProducts: 1, available: 0, onSale: 1, comingSoon: 0, featured: 0, estimatedListedValue: 49990,
    byCategory: [{ category: 'slide-on', count: 1, value: 49990 }],
    byStatus: [{ status: 'on-sale', count: 1 }],
    weakListings: [{ slug: product.slug, title: product.title, issue: 'Fewer than three gallery images' }],
  },
  leads: { last7Days: 0, last30Days: 0, open: 0, dueToday: 0, overdue: 0, byStatus: [], priorityQueue: [], followUpQueue: [], recent: [] },
  tasks: { open: 0, dueToday: 0, overdue: 0, recent: [] },
  productPerformance: [product],
  productInterest: { unknownProductEnquiries: 0, topProducts: [product], staleProducts: [product] },
  traffic: [], funnel: [],
  marketingInsights: { status: 'fallback', message: '', items: [] },
  chat: { topTopics: [], recent: [] },
  analytics: { status: 'unavailable', message: 'Not configured' },
  contact: { ready: true, toEmail: 'test@example.com', fromEmail: 'test@example.com' },
  readiness: [],
};

test('AI product analysis merges alerts and renders grounded recommendations', async ({ page }) => {
  await page.route('**/.netlify/functions/admin-dashboard?range=30', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(dashboard),
  }));
  await page.route('**/.netlify/functions/admin-product-recommendations', async route => {
    const payload = route.request().postDataJSON();
    expect(payload.flags).toEqual([
      'No enquiries in 30 days',
      'On sale with no recent enquiries',
      'Fewer than three gallery images',
    ]);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ready',
        message: '',
        diagnosis: 'The page has some visibility but is not converting recorded visits into enquiries.',
        ownerInputs: ['Confirm the current sale price and included equipment.'],
        recommendations: [{
          title: 'Clarify the sale offer',
          action: 'Show verified inclusions and the enquiry next step beside the sale price.',
          evidence: '18 page views and 0 enquiries in 30 days.',
          priority: 'high',
          category: 'quick-fix',
        }],
      }),
    });
  });

  await page.goto('/admin/');
  const card = page.getByTestId(`attention-product-${product.slug}`);
  await expect(card).toHaveCount(1);
  await expect(card.getByText('Fewer than three gallery images')).toBeVisible();

  await card.getByRole('button', { name: 'Analyse with AI' }).click();
  const result = page.getByTestId(`product-recommendations-${product.slug}`);
  await expect(result).toBeVisible();
  await expect(result.getByText('Clarify the sale offer')).toBeVisible();
  await expect(result.getByText('18 page views and 0 enquiries in 30 days.')).toBeVisible();
  await expect(result.getByText('Confirm the current sale price and included equipment.')).toBeVisible();
});
