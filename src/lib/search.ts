export interface SearchRecord {
  id: string;
  title: string;
  summary: string;
  url: string;
  kind: 'product' | 'guide' | 'tool';
  category: string;
  price: string;
  keywords: string[];
}

export interface SearchOptions {
  limit?: number;
}

const TITLE_WEIGHT = 10;
const CATEGORY_WEIGHT = 5;
const SUMMARY_WEIGHT = 3;
const KEYWORD_WEIGHT = 1;
const PHRASE_BONUS = 25;

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

interface NormalisedFields {
  title: string;
  category: string;
  summary: string;
  keywords: string;
}

/** The weight of the highest-weighted field containing the term, or 0 for no match. */
function termScore(fields: NormalisedFields, term: string) {
  if (fields.title.includes(term)) return TITLE_WEIGHT;
  if (fields.category.includes(term)) return CATEGORY_WEIGHT;
  if (fields.summary.includes(term)) return SUMMARY_WEIGHT;
  if (fields.keywords.includes(term)) return KEYWORD_WEIGHT;
  return 0;
}

export function searchRecords(records: SearchRecord[], query: string, options: SearchOptions = {}) {
  const normalisedQuery = normalise(query);
  if (!normalisedQuery) return [];
  const terms = normalisedQuery.split(' ');

  const scored: Array<{ record: SearchRecord; score: number }> = [];
  for (const record of records) {
    const fields: NormalisedFields = {
      title: normalise(record.title),
      category: normalise(record.category),
      summary: normalise(record.summary),
      keywords: normalise(record.keywords.join(' ')),
    };

    let score = 0;
    let matchedEveryTerm = true;
    for (const term of terms) {
      const weight = termScore(fields, term);
      if (weight === 0) {
        matchedEveryTerm = false;
        break;
      }
      score += weight;
    }
    if (!matchedEveryTerm) continue;

    if (fields.title.includes(normalisedQuery)) score += PHRASE_BONUS;
    scored.push({ record, score });
  }

  scored.sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title));
  const ordered = scored.map((entry) => entry.record);
  return typeof options.limit === 'number' ? ordered.slice(0, options.limit) : ordered;
}
