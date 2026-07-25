interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

export function decodeGmailBase64Url(value = '') {
  if (!value) return '';
  try {
    const normalised = value.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(normalised, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

export function htmlToSafeText(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function collect(part: GmailPart, plain: string[], html: string[]) {
  const decoded = decodeGmailBase64Url(part.body?.data);
  if (decoded && part.mimeType === 'text/plain') plain.push(decoded);
  else if (decoded && part.mimeType === 'text/html') html.push(decoded);
  for (const child of part.parts || []) collect(child, plain, html);
}

export function extractGmailMessageText(payload?: GmailPart | null, max = 12_000) {
  if (!payload) return '';
  const plain: string[] = [];
  const html: string[] = [];
  collect(payload, plain, html);
  const value = plain.length ? plain.join('\n\n') : htmlToSafeText(html.join('\n\n'));
  return value.replace(/\0/g, '').trim().slice(0, max);
}

export function isExcludedGmailMessage(input: { labelIds?: string[]; fromEmail?: string; connectedEmail?: string; subject?: string }) {
  const labels = new Set(input.labelIds || []);
  if (['SENT', 'DRAFT', 'SPAM', 'TRASH'].some(label => labels.has(label))) return true;
  if (input.connectedEmail && input.fromEmail?.toLowerCase() === input.connectedEmail.toLowerCase()) return true;
  const text = `${input.fromEmail || ''} ${input.subject || ''}`.toLowerCase();
  return /\b(no-?reply|mailer-daemon|signwell|newsletter|unsubscribe)\b/.test(text);
}
