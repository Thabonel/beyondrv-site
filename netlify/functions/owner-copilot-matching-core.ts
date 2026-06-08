export type MatchDecision = 'auto_link' | 'needs_confirmation' | 'possible_only' | 'do_not_suggest';

export interface MatchableCustomer {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  emailAliases?: string[];
}

export interface MatchableLead {
  id: string;
  customerId?: string;
  sourceEnquiryId?: string;
  productInterest?: string;
  relatedThreadIds?: string[];
}

export interface GmailThreadCandidate {
  id: string;
  fromEmail?: string;
  toEmail?: string;
  replyToEmail?: string;
  phone?: string;
  subject?: string;
  snippet?: string;
  productInterest?: string;
}

export interface DriveFileCandidate {
  id: string;
  name?: string;
  description?: string;
  folderName?: string;
  customerEmail?: string;
  customerPhone?: string;
  productInterest?: string;
}

export interface OwnerCopilotMatch {
  targetType: 'customer' | 'lead';
  targetId: string;
  confidence: number;
  decision: MatchDecision;
  reasons: string[];
}

export function normaliseEmail(value = '') {
  return value.trim().toLowerCase();
}

export function normalisePhone(value = '') {
  const digits = value.replace(/\D+/g, '');
  if (digits.startsWith('61') && digits.length === 11) return `0${digits.slice(2)}`;
  return digits;
}

function words(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function includesProduct(left = '', right = '') {
  const a = words(left);
  const b = words(right);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

function emailsFor(customer: MatchableCustomer) {
  return [customer.email, ...(customer.emailAliases || [])].map(value => normaliseEmail(value || '')).filter(Boolean);
}

function threadEmails(thread: GmailThreadCandidate) {
  return [thread.fromEmail, thread.toEmail, thread.replyToEmail].map(value => normaliseEmail(value || '')).filter(Boolean);
}

function classify(confidence: number): MatchDecision {
  if (confidence >= 95) return 'auto_link';
  if (confidence >= 80) return 'needs_confirmation';
  if (confidence >= 60) return 'possible_only';
  return 'do_not_suggest';
}

function uniqueMatches(matches: OwnerCopilotMatch[]) {
  const byTarget = new Map<string, OwnerCopilotMatch>();
  for (const match of matches) {
    const key = `${match.targetType}:${match.targetId}`;
    const existing = byTarget.get(key);
    if (!existing || match.confidence > existing.confidence) byTarget.set(key, match);
  }
  return [...byTarget.values()]
    .filter(match => match.decision !== 'do_not_suggest')
    .sort((a, b) => b.confidence - a.confidence || (a.targetType === 'lead' ? -1 : 1))
    .slice(0, 3);
}

export function scoreGmailThreadMatches(
  thread: GmailThreadCandidate,
  customers: MatchableCustomer[],
  leads: MatchableLead[]
) {
  const matches: OwnerCopilotMatch[] = [];
  const threadEmailSet = new Set(threadEmails(thread));
  const threadPhone = normalisePhone(thread.phone || `${thread.subject || ''} ${thread.snippet || ''}`);

  for (const customer of customers) {
    const customerEmails = emailsFor(customer);
    const customerPhone = normalisePhone(customer.phone || '');
    const reasons: string[] = [];
    let confidence = 0;
    if (customerEmails.some(email => threadEmailSet.has(email))) {
      confidence = 98;
      reasons.push('Exact customer email match.');
    }
    if (customerPhone && threadPhone && customerPhone === threadPhone) {
      confidence = Math.max(confidence, 96);
      reasons.push('Exact customer phone match.');
    }
    if (confidence) {
      matches.push({ targetType: 'customer', targetId: customer.id, confidence, decision: classify(confidence), reasons });
    }
  }

  for (const lead of leads) {
    const customer = customers.find(item => item.id === lead.customerId);
    const reasons: string[] = [];
    let confidence = 0;
    if (lead.relatedThreadIds?.includes(thread.id)) {
      confidence = 100;
      reasons.push('Previously linked Gmail thread ID.');
    }
    if (customer) {
      const customerMatch = scoreGmailThreadMatches(thread, [customer], []);
      if (customerMatch[0]?.confidence >= 95) {
        confidence = Math.max(confidence, customerMatch[0].confidence);
        reasons.push(...customerMatch[0].reasons);
      }
    }
    if (confidence >= 95 && includesProduct(thread.productInterest || `${thread.subject || ''} ${thread.snippet || ''}`, lead.productInterest || '')) {
      confidence = Math.max(confidence, 98);
      reasons.push('Product interest also matches the lead.');
    }
    if (confidence) {
      matches.push({ targetType: 'lead', targetId: lead.id, confidence, decision: classify(confidence), reasons });
    }
  }

  return uniqueMatches(matches);
}

export function scoreDriveFileMatches(
  file: DriveFileCandidate,
  customers: MatchableCustomer[],
  leads: MatchableLead[]
) {
  const matches: OwnerCopilotMatch[] = [];
  const fileEmail = normaliseEmail(file.customerEmail || `${file.name || ''} ${file.description || ''}`);
  const filePhone = normalisePhone(file.customerPhone || `${file.name || ''} ${file.description || ''}`);
  const haystack = `${file.name || ''} ${file.description || ''} ${file.folderName || ''}`;

  for (const customer of customers) {
    const reasons: string[] = [];
    let confidence = 0;
    if (emailsFor(customer).some(email => fileEmail.includes(email))) {
      confidence = 96;
      reasons.push('Exact customer email appears in Drive file metadata.');
    }
    const customerPhone = normalisePhone(customer.phone || '');
    if (customerPhone && filePhone.includes(customerPhone)) {
      confidence = Math.max(confidence, 95);
      reasons.push('Exact customer phone appears in Drive file metadata.');
    }
    if (!confidence && customer.name && words(haystack).includes(words(customer.name)) && words(customer.name).split(' ').length >= 2) {
      confidence = 74;
      reasons.push('Exact full customer name appears; owner confirmation required.');
    }
    if (confidence) {
      matches.push({ targetType: 'customer', targetId: customer.id, confidence, decision: classify(confidence), reasons });
    }
  }

  for (const lead of leads) {
    const customer = customers.find(item => item.id === lead.customerId);
    const customerMatches = customer ? scoreDriveFileMatches(file, [customer], []) : [];
    const reasons: string[] = [];
    let confidence = customerMatches[0]?.confidence || 0;
    if (confidence) reasons.push(...customerMatches[0].reasons);
    if (confidence >= 74 && includesProduct(file.productInterest || haystack, lead.productInterest || '')) {
      confidence = confidence >= 95 ? 98 : 82;
      reasons.push('Product interest also matches the lead.');
    }
    if (confidence) {
      matches.push({ targetType: 'lead', targetId: lead.id, confidence, decision: classify(confidence), reasons });
    }
  }

  return uniqueMatches(matches);
}
