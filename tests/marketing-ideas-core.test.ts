import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMarketingIdea, marketingIdeaId, resolveMarketingIdeaTarget } from '../netlify/functions/owner-copilot-core.ts';

const NOW = '2026-08-21T00:00:00.000Z';

test('marketing ideas built from the same insight title reuse one id', () => {
  const first = marketingIdeaId('Promote the Advent 2450 to towing families');
  const second = marketingIdeaId('  Promote the Advent 2450 to towing families  ');

  assert.equal(first, second);
  assert.match(first, /^marketing_idea_promote-the-advent-2450-to-towing-families_[a-f0-9]{16}$/);
});

test('marketing idea identity normalizes internal whitespace and case', () => {
  assert.equal(marketingIdeaId('Spring   Campaign'), marketingIdeaId('spring\n campaign'));
});

test('marketing ideas built from different insight titles get different ids', () => {
  assert.notEqual(marketingIdeaId('Promote the Advent 2450'), marketingIdeaId('Promote the Sunpatch 15'));
});

test('marketing idea titles that slug identically but differ still get different ids', () => {
  // Differ only in punctuation: the slug is the same for both.
  assert.notEqual(marketingIdeaId('Promote the Advent 2450'), marketingIdeaId('Promote the Advent 2450!'));
});

test('marketing idea titles sharing a long prefix past the slug limit still get different ids', () => {
  // Titles are capped at 120 characters upstream while the slug truncates at 80,
  // so two titles can share every sluggable character and still be different.
  const prefix = 'promote the advent twenty four fifty to towing families across regional australia now';
  assert.notEqual(marketingIdeaId(`${prefix} alpha`), marketingIdeaId(`${prefix} beta`));
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

test('a legacy record is reused by title instead of duplicated under the canonical id', () => {
  const legacy = { id: 'marketing_idea_spring-campaign', title: 'Spring campaign' };
  const target = resolveMarketingIdeaTarget({ title: 'Spring campaign' }, [legacy]);
  assert.deepEqual(target, { id: legacy.id, existing: legacy });
});

test('an id cannot overwrite a record with a different title', () => {
  const existing = { id: 'marketing_idea_existing', title: 'Existing campaign' };
  const target = resolveMarketingIdeaTarget({ id: existing.id, title: 'Different campaign' }, [existing]);
  assert.equal('error' in target, true);
  assert.equal((target as { statusCode: number }).statusCode, 409);
});

test('duplicate legacy titles fail closed for manual reconciliation', () => {
  const target = resolveMarketingIdeaTarget({ title: 'Spring campaign' }, [
    { id: 'legacy-a', title: 'Spring campaign' },
    { id: 'legacy-b', title: 'Spring campaign' },
  ]);
  assert.equal('error' in target, true);
  assert.equal((target as { statusCode: number }).statusCode, 409);
});

test('a client cannot invent a second id for an existing title', () => {
  const target = resolveMarketingIdeaTarget(
    { id: 'invented-id', title: 'Spring campaign' },
    [{ id: 'legacy-id', title: 'Spring campaign' }],
  );
  assert.equal('error' in target, true);
  assert.equal((target as { statusCode: number }).statusCode, 409);
});

test('a client-provided id cannot create a new record', () => {
  const target = resolveMarketingIdeaTarget({ id: 'client-selected', title: 'New campaign' }, []);
  assert.equal('error' in target, true);
  assert.equal((target as { statusCode: number }).statusCode, 409);
});

test('a status-only update can target an existing legacy record', () => {
  const existing = { id: 'legacy-id', title: 'Spring campaign', status: 'idea' };
  assert.deepEqual(resolveMarketingIdeaTarget({ id: existing.id, status: 'approved' }, [existing]), {
    id: existing.id,
    existing,
  });
});
