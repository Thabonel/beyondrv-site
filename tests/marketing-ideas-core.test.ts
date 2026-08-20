import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMarketingIdea, marketingIdeaId } from '../netlify/functions/owner-copilot-core.ts';

const NOW = '2026-08-21T00:00:00.000Z';

test('marketing ideas built from the same insight title reuse one id', () => {
  const first = marketingIdeaId('Promote the Advent 2450 to towing families');
  const second = marketingIdeaId('  Promote the Advent 2450 to towing families  ');

  assert.equal(first, second);
  assert.equal(first, 'marketing_idea_promote-the-advent-2450-to-towing-families');
});

test('marketing ideas built from different insight titles get different ids', () => {
  assert.notEqual(marketingIdeaId('Promote the Advent 2450'), marketingIdeaId('Promote the Sunpatch 15'));
});

test('marketing idea titles with no sluggable characters still get distinct stable ids', () => {
  const first = marketingIdeaId('!!!');
  const second = marketingIdeaId('???');

  assert.notEqual(first, second);
  assert.equal(first, marketingIdeaId('!!!'));
  assert.notEqual(first, 'marketing_idea_');
});

test('marketing idea without a title is rejected', () => {
  const result = buildMarketingIdea({ recommendation: 'Run a spring campaign.' }, null, NOW);

  assert.equal('error' in result, true);
  assert.equal((result as { error: string }).error, 'Missing marketing idea title.');
});

test('marketing idea with an unknown status is rejected', () => {
  const result = buildMarketingIdea({ title: 'Spring campaign', status: 'archived' }, null, NOW);

  assert.equal((result as { error: string }).error, 'Invalid marketing idea status.');
});

test('marketing idea with an unknown priority is rejected', () => {
  const result = buildMarketingIdea({ title: 'Spring campaign', priority: 'urgent' }, null, NOW);

  assert.equal((result as { error: string }).error, 'Invalid marketing idea priority.');
});

test('marketing idea saved from a dashboard insight keeps its evidence and priority', () => {
  const result = buildMarketingIdea(
    {
      title: 'Promote the Advent 2450',
      recommendation: 'Run a towing-capacity campaign for dual-cab owners.',
      evidence: '18 enquiries in 30 days against 4 page views per enquiry.',
      priority: 'high',
    },
    null,
    NOW,
  );

  assert.equal('error' in result, false);
  const { idea } = result as { idea: Record<string, unknown> };
  assert.equal(idea.evidence, '18 enquiries in 30 days against 4 page views per enquiry.');
  assert.equal(idea.priority, 'high');
  assert.equal(idea.status, 'idea');
  assert.equal(idea.createdAt, NOW);
});

test('marketing idea evidence longer than the field limit is clamped', () => {
  const result = buildMarketingIdea({ title: 'Spring campaign', evidence: 'e'.repeat(900) }, null, NOW);

  const { idea } = result as { idea: Record<string, unknown> };
  assert.equal((idea.evidence as string).length, 400);
});

test('marketing idea status change preserves the original creation time', () => {
  const existing = {
    id: 'marketing_idea_spring-campaign',
    title: 'Spring campaign',
    recommendation: 'Run a towing-capacity campaign.',
    evidence: '18 enquiries in 30 days.',
    priority: 'high',
    status: 'idea',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  const result = buildMarketingIdea({ id: existing.id, status: 'approved' }, existing, NOW);

  const { idea } = result as { idea: Record<string, unknown> };
  assert.equal(idea.status, 'approved');
  assert.equal(idea.createdAt, '2026-08-01T00:00:00.000Z');
  assert.equal(idea.updatedAt, NOW);
  assert.equal(idea.title, 'Spring campaign');
  assert.equal(idea.evidence, '18 enquiries in 30 days.');
});
