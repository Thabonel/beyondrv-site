import assert from 'node:assert/strict';
import test from 'node:test';
import { searchRecords, searchWithDiagnostics, type SearchRecord } from '../src/lib/search.ts';

function record(overrides: Partial<SearchRecord> = {}): SearchRecord {
  return {
    id: 'advent-2450-hardtop-slide-on',
    title: 'Advent 2450 Hardtop Ute Slide-On Camper',
    summary: 'Hardtop slide-on for dual-cab utes.',
    url: '/advent-2450-hardtop-slide-on/',
    kind: 'product',
    category: 'slide-on',
    price: 'From $49,990',
    keywords: ['electric lift', 'payload 900kg'],
    ...overrides,
  };
}

test('a query term matches the title', () => {
  assert.equal(searchRecords([record()], 'advent').length, 1);
});

test('a query term matches the summary', () => {
  assert.equal(searchRecords([record()], 'dual-cab').length, 1);
});

test('a query term matches a keyword', () => {
  assert.equal(searchRecords([record()], 'payload').length, 1);
});

test('an unmatched extra term narrows the ranking but does not empty the results', () => {
  const results = searchRecords([record()], 'advent submarine');
  assert.equal(results.length, 1);
});

test('a natural-language question still finds the relevant products', () => {
  const slideOn = record({ id: 'a', title: 'Advent 2450 Hardtop Ute Slide-On Camper' });
  const caravan = record({ id: 'b', title: 'Sunpatch 15XC Couples Off-Road Van', summary: 'Off-road van.', category: 'caravan', keywords: [] });

  const results = searchRecords([caravan, slideOn], 'slide on for for ford ranger');

  assert.equal(results[0].id, 'a');
});

test('records matching more of the query outrank records matching less', () => {
  const both = record({ id: 'a', title: 'Advent 2450 Hardtop', summary: '', keywords: [] });
  const one = record({ id: 'b', title: 'Advent 2150 Hardtop', summary: '', keywords: [] });

  const results = searchRecords([one, both], 'advent 2450');

  assert.deepEqual(results.map((item) => item.id), ['a', 'b']);
});

test('common words alone are not enough to match anything', () => {
  assert.deepEqual(searchRecords([record()], 'for the with'), []);
});

test('a common word is ignored rather than driving the results', () => {
  const camper = record({ id: 'a', title: 'Advent 2450', summary: 'Built for touring.', keywords: [] });
  const van = record({ id: 'b', title: 'Sunpatch 15XC', summary: 'Made for couples.', keywords: [] });

  const results = searchRecords([van, camper], 'advent for');

  assert.deepEqual(results.map((item) => item.id), ['a']);
});

test('a title match outranks a summary match', () => {
  const inTitle = record({ id: 'a', title: 'Touring Camper', summary: 'Nothing here.' });
  const inSummary = record({ id: 'b', title: 'Nothing here.', summary: 'A touring camper.' });
  const results = searchRecords([inSummary, inTitle], 'touring');
  assert.deepEqual(results.map((item) => item.id), ['a', 'b']);
});

test('a summary match outranks a keyword match', () => {
  const inSummary = record({ id: 'a', title: 'Nothing.', summary: 'Electric lift roof.', keywords: [] });
  const inKeyword = record({ id: 'b', title: 'Nothing.', summary: 'Nothing.', keywords: ['electric lift'] });
  const results = searchRecords([inKeyword, inSummary], 'electric');
  assert.deepEqual(results.map((item) => item.id), ['a', 'b']);
});

test('a full phrase in the title outranks the same words spread across fields', () => {
  const phrase = record({ id: 'a', title: 'Advent 2450 Hardtop', summary: 'Nothing.', keywords: [] });
  const scattered = record({ id: 'b', title: 'Advent 2150', summary: 'Compare with the 2450.', keywords: [] });
  const results = searchRecords([scattered, phrase], 'advent 2450');
  assert.deepEqual(results.map((item) => item.id), ['a', 'b']);
});

test('punctuation in the query does not prevent a match', () => {
  assert.equal(searchRecords([record()], 'slide-on!').length, 1);
});

test('an empty or whitespace query returns nothing', () => {
  assert.deepEqual(searchRecords([record()], ''), []);
  assert.deepEqual(searchRecords([record()], '   '), []);
});

test('records with equal scores are ordered by title', () => {
  const beta = record({ id: 'b', title: 'Beta Camper', summary: '', keywords: [] });
  const alpha = record({ id: 'a', title: 'Alpha Camper', summary: '', keywords: [] });
  const results = searchRecords([beta, alpha], 'camper');
  assert.deepEqual(results.map((item) => item.id), ['a', 'b']);
});

test('a caller can cap how many results come back', () => {
  const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) =>
    record({ id, title: `${id} Camper`, summary: '', keywords: [] }));
  assert.equal(searchRecords(many, 'camper', { limit: 5 }).length, 5);
});

test('a term does not match in the middle of an unrelated word', () => {
  const expedition = record({ id: 'a', title: 'Unimog Overlander', summary: 'Nothing.', category: 'expedition', keywords: [] });

  // "on" must not match inside "expedition".
  assert.deepEqual(searchRecords([expedition], 'on'), []);
});

test('a term still matches the start of a word, so type-ahead works', () => {
  const advent = record({ id: 'a', title: 'Advent 2450 Hardtop', summary: '', keywords: [] });

  assert.equal(searchRecords([advent], 'adv').length, 1);
});

test('searchRecords reports which query terms found nothing', () => {
  const slideOn = record({ id: 'a', title: 'Advent 2450 Hardtop Ute Slide-On Camper' });

  const { results, unmatched } = searchWithDiagnostics([slideOn], 'slide on for my ford ranger');

  assert.equal(results.length, 1);
  assert.deepEqual(unmatched, ['ford', 'ranger']);
});

test('a query whose every term is unknown reports them all as unmatched', () => {
  const slideOn = record({ id: 'a', title: 'Advent 2450 Hardtop Ute Slide-On Camper' });

  const { results, unmatched } = searchWithDiagnostics([slideOn], 'toyota super duty');

  assert.deepEqual(results, []);
  assert.deepEqual(unmatched, ['toyota', 'super', 'duty']);
});

test('a two-letter term matches a whole word only, never a word that starts with it', () => {
  const slideOn = record({ id: 'a', title: 'Advent 2450 Slide-On Camper', summary: '', category: '', keywords: [] });
  const hasOne = record({ id: 'b', title: 'Sunpatch 21-XF', summary: 'One in stock.', category: '', keywords: [] });

  const results = searchRecords([hasOne, slideOn], 'on');

  assert.deepEqual(results.map((item) => item.id), ['a']);
});
