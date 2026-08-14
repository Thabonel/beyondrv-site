export interface SocialCampaignRow {
  source: string;
  campaign: string;
  medium: string;
  content: string;
  sessions: number;
  enquiries: number;
  conversionRate: string;
}

type AggregateRow = [unknown, unknown, unknown, unknown, unknown];

const SOCIAL_SOURCES = new Set(['YouTube', 'Instagram', 'Facebook']);

function text(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function count(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function key(source: string, campaign: string, medium: string, content: string) {
  return [source, campaign, medium, content].join('\u001f');
}

export function mergeSocialCampaignRows(
  sessionRows: AggregateRow[],
  enquiryRows: AggregateRow[],
): SocialCampaignRow[] {
  const campaigns = new Map<string, Omit<SocialCampaignRow, 'conversionRate'>>();

  for (const [rawSource, rawCampaign, rawMedium, rawContent, rawSessions] of sessionRows) {
    const source = text(rawSource, 'Other');
    if (!SOCIAL_SOURCES.has(source)) continue;
    const campaign = text(rawCampaign, 'Unknown campaign');
    const medium = text(rawMedium, 'Unspecified');
    const content = text(rawContent, 'Unspecified');
    campaigns.set(key(source, campaign, medium, content), {
      source,
      campaign,
      medium,
      content,
      sessions: count(rawSessions),
      enquiries: 0,
    });
  }

  for (const [rawSource, rawCampaign, rawMedium, rawContent, rawEnquiries] of enquiryRows) {
    const source = text(rawSource, 'Other');
    if (!SOCIAL_SOURCES.has(source)) continue;
    const campaign = text(rawCampaign, 'Unknown campaign');
    const medium = text(rawMedium, 'Unspecified');
    const content = text(rawContent, 'Unspecified');
    const campaignKey = key(source, campaign, medium, content);
    const current = campaigns.get(campaignKey) ?? {
      source,
      campaign,
      medium,
      content,
      sessions: 0,
      enquiries: 0,
    };
    current.enquiries += count(rawEnquiries);
    campaigns.set(campaignKey, current);
  }

  return [...campaigns.values()]
    .map(row => ({
      ...row,
      conversionRate: row.sessions > 0 ? ((row.enquiries / row.sessions) * 100).toFixed(1) : '0.0',
    }))
    .sort((left, right) => right.sessions - left.sessions || right.enquiries - left.enquiries)
    .slice(0, 30);
}
