/**
 * Dated operational reminders shown on the admin dashboard.
 *
 * These exist because two dependencies nearly took the site down in August
 * 2026 and neither was surfaced by anything — one expiring service and one
 * silently failing build. Vendor emails proved an unreliable channel, so
 * anything with a deadline is shown where the owner already looks.
 *
 * There is deliberately no dismiss button. A reminder stays hidden until its
 * lead window opens, then shows until someone removes the entry below. That
 * makes "dismiss and forget" impossible, at the cost of a code change to
 * clear one — the right trade for a couple of entries a year.
 */
export interface AdminReminder {
  id: string;
  title: string;
  detail: string;
  /** ISO date the action should be completed by. */
  dueDate: string;
  /** How many days before dueDate the reminder starts showing. */
  leadDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const ADMIN_REMINDERS: AdminReminder[] = [
  {
    id: 'domain-card-expiry',
    title: 'Replace the payment card on the beyondrv.com.au domain',
    detail:
      'The card on file expires 07/27. It covers the May 2027 renewal but not May 2028, and a renewal that fails silently can cost the domain. Update it in Squarespace under Domains, beyondrv.com.au, Billing.',
    dueDate: '2027-07-01',
    leadDays: 120,
  },
  {
    id: 'abr-business-address',
    title: 'Business register still lists the company address as NSW',
    detail:
      'The ABN records the main business location as NSW while the factory operates from Mutdapilly, Queensland. It surfaced when it blocked a domain contact update. If the business has relocated, the register is out of date and affects more than the website — worth raising with the accountant.',
    dueDate: '2026-10-31',
    leadDays: 90,
  },
];

/**
 * Reminders whose lead window has opened, soonest due first.
 * Overdue reminders keep showing rather than disappearing.
 */
export function activeReminders(
  now: Date,
  reminders: AdminReminder[] = ADMIN_REMINDERS,
): AdminReminder[] {
  return reminders
    .filter((reminder) => {
      const due = Date.parse(reminder.dueDate);
      if (Number.isNaN(due)) return false;
      return now.getTime() >= due - reminder.leadDays * DAY_MS;
    })
    .sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate));
}
