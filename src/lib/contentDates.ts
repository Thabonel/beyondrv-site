/**
 * Normalise a frontmatter date value to an ISO string.
 *
 * Astro reads content frontmatter with gray-matter, which uses js-yaml's
 * YAML 1.1 schema. That dialect has an implicit timestamp type, so a bare
 * ISO scalar like `archivedAt: 2026-08-18T00:42:18.388Z` parses as a Date
 * rather than a string — and any `z.string()` field then fails the build.
 *
 * Writers should still quote timestamps, but this keeps the content layer
 * tolerant of both YAML dialects so one unquoted value cannot take the
 * site down. Non-date values pass through untouched for zod to judge.
 */
export function toIsoDateString(value: unknown): unknown {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? value : value.toISOString();
  }
  return value;
}
