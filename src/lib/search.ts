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

/**
 * A term matches a field when some word in it starts with the term. Plain
 * substring matching pulled every expedition vehicle into a search for "on",
 * because "expedition" contains it. Matching word starts keeps type-ahead
 * working, so "adv" still finds "Advent".
 */
const SHORT_TERM_LENGTH = 2;

function fieldContains(field: string, term: string) {
  if (!field) return false;
  const words = field.split(' ');
  // A one or two letter term is too ambiguous to match word starts: "on"
  // would pull in "one". Short terms must match a whole word.
  if (term.length <= SHORT_TERM_LENGTH) return words.includes(term);
  return words.some((word) => word.startsWith(term));
}

/** The weight of the highest-weighted field containing the term, or 0 for no match. */
function termScore(fields: NormalisedFields, term: string) {
  if (fieldContains(fields.title, term)) return TITLE_WEIGHT;
  if (fieldContains(fields.category, term)) return CATEGORY_WEIGHT;
  if (fieldContains(fields.summary, term)) return SUMMARY_WEIGHT;
  if (fieldContains(fields.keywords, term)) return KEYWORD_WEIGHT;
  return 0;
}

/**
 * Words that carry no signal here. They appear across most taglines, so
 * matching on them ranks everything equally and matching against them
 * cannot exclude anything useful.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'do', 'does',
  'for', 'from', 'has', 'have', 'i', 'if', 'in', 'is', 'it', 'me', 'my', 'of',
  'or', 'that', 'the', 'their', 'them', 'this', 'to', 'was', 'what', 'which',
  'will', 'with', 'would', 'you', 'your',
]);

export interface SearchDiagnostics {
  results: SearchRecord[];
  /** Query terms that matched no record at all, in the order they were typed. */
  unmatched: string[];
}

/**
 * Same ranking as searchRecords, but also reports the terms nothing matched.
 * A customer asking about a vehicle the index has never heard of should be
 * told so, rather than handed a camper list that quietly ignored it.
 */
export function searchWithDiagnostics(
  records: SearchRecord[],
  query: string,
  options: SearchOptions = {},
): SearchDiagnostics {
  const normalisedQuery = normalise(query);
  if (!normalisedQuery) return { results: [], unmatched: [] };

  // Deduplicate so a repeated word cannot inflate a record's score, and drop
  // stop words so "slide on for my ford ranger" is judged on the words that
  // carry meaning.
  const terms = [...new Set(normalisedQuery.split(' '))].filter((term) => !STOP_WORDS.has(term));
  if (terms.length === 0) return { results: [], unmatched: [] };

  const matchedTerms = new Set<string>();
  const scored: Array<{ record: SearchRecord; matched: number; score: number }> = [];
  for (const record of records) {
    const fields: NormalisedFields = {
      title: normalise(record.title),
      category: normalise(record.category),
      summary: normalise(record.summary),
      keywords: normalise(record.keywords.join(' ')),
    };

    let score = 0;
    let matched = 0;
    for (const term of terms) {
      const weight = termScore(fields, term);
      if (weight === 0) continue;
      matchedTerms.add(term);
      matched += 1;
      score += weight;
    }
    // Requiring every term to match meant one unknown word emptied an
    // otherwise good result set. Rank partial matches instead of discarding.
    if (matched === 0) continue;

    if (fields.title.includes(normalisedQuery)) score += PHRASE_BONUS;
    scored.push({ record, matched, score });
  }

  scored.sort((a, b) =>
    b.matched - a.matched
    || b.score - a.score
    || a.record.title.localeCompare(b.record.title));
  const ordered = scored.map((entry) => entry.record);

  return {
    results: typeof options.limit === 'number' ? ordered.slice(0, options.limit) : ordered,
    unmatched: terms.filter((term) => !matchedTerms.has(term)),
  };
}

export function searchRecords(records: SearchRecord[], query: string, options: SearchOptions = {}) {
  return searchWithDiagnostics(records, query, options).results;
}
