/**
 * The admin dashboard renders nothing but an error when its own fetch fails, so
 * any spec covering a panel has to supply a working dashboard payload first.
 */
export const emptyDashboard = {
  generatedAt: '2026-08-30T00:00:00.000Z',
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
  marketingInsights: { status: 'ready', message: '', items: [] },
  chat: { topTopics: [], recent: [] },
  analytics: { status: 'unavailable', message: 'Not configured' },
  contact: { ready: true, toEmail: 'test@example.com', fromEmail: 'test@example.com' },
  readiness: [],
};
