import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeSocialCampaignRows } from '../netlify/functions/analytics-attribution-core.ts';

test('merges social sessions and enquiries by platform, campaign, medium, and content', () => {
  const rows = mergeSocialCampaignRows(
    [
      ['YouTube', 'unimog-walkthrough', 'organic_social', 'description', 20],
      ['Instagram', 'advent-2150-reel', 'organic_social', 'reel', 10],
      ['Google', 'search', 'organic', 'Unspecified', 50],
    ],
    [
      ['YouTube', 'unimog-walkthrough', 'organic_social', 'description', 2],
      ['Instagram', 'advent-2150-reel', 'organic_social', 'reel', 1],
    ],
  );

  assert.deepEqual(rows, [
    {
      source: 'YouTube', campaign: 'unimog-walkthrough', medium: 'organic_social', content: 'description',
      sessions: 20, enquiries: 2, conversionRate: '10.0',
    },
    {
      source: 'Instagram', campaign: 'advent-2150-reel', medium: 'organic_social', content: 'reel',
      sessions: 10, enquiries: 1, conversionRate: '10.0',
    },
  ]);
});

test('keeps unattributed social referrals visible and ignores non-social rows', () => {
  const rows = mergeSocialCampaignRows(
    [['YouTube', null, null, null, 8], ['Other', null, null, null, 99]],
    [['Facebook', 'winter-post', 'organic_social', 'post', 1]],
  );

  assert.deepEqual(rows, [
    {
      source: 'YouTube', campaign: 'Unknown campaign', medium: 'Unspecified', content: 'Unspecified',
      sessions: 8, enquiries: 0, conversionRate: '0.0',
    },
    {
      source: 'Facebook', campaign: 'winter-post', medium: 'organic_social', content: 'post',
      sessions: 0, enquiries: 1, conversionRate: '0.0',
    },
  ]);
});
