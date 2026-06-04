import OpenAI from 'openai';
import type { Handler } from '@netlify/functions';
import { randomUUID } from 'crypto';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore } from './blob-store';
import catalogue from './product-catalogue.json';

const openAiKey = process.env.OPENAI_API_KEY;
const client = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;
const ADMIN_MODEL = process.env.OPENAI_ADMIN_MODEL ?? 'gpt-5-mini';
const JUDGE_MODEL = process.env.OPENAI_JUDGE_MODEL ?? 'gpt-5-mini';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? 'main';
const API = 'https://api.github.com';
const ENQUIRY_STORE = 'customer-enquiries';
const LEAD_STATUS_STORE = 'customer-lead-status';
const SITE_URL = 'https://beyondrv.com.au';
const VALID_LEAD_STATUSES = new Set(['new', 'contacted', 'replied', 'called', 'qualified', 'quoted', 'follow-up-scheduled', 'won', 'lost', 'spam']);
const VALID_LEAD_PRIORITIES = new Set(['hot', 'warm', 'info-only', 'spam-low-quality']);
const VALID_OUTCOME_REASONS = new Set(['', 'too-expensive', 'wrong-vehicle', 'no-payload', 'bought-elsewhere', 'just-researching', 'no-response', 'timing-not-right', 'other']);

// ─── Types ───────────────────────────────────────────────────────────────────

type RiskClass = 'readonly' | 'reversible_write' | 'high_risk';
type JudgeDecision = 'allow' | 'block' | 'revise' | 'escalate';

interface ActionProposal {
  proposal_id: string;
  timestamp: string;
  user_raw_input: string;
  risk_class: RiskClass;
  proposed_action: {
    target: string;
    description: string;
    content_length: number;
  };
}

interface JudgeVerdict {
  decision: JudgeDecision;
  rationale: string;
  risk_flags: string[];
  revision_instructions?: string;
  block_reason?: string;
  escalation_reason?: string;
}

export interface PendingChange {
  path: string;
  content: string;
  description: string;
  proposal_id: string;
  judgeDecision: JudgeDecision;
  risk_flags: string[];
  escalation_reason?: string;
}

interface EnquiryRecord {
  id: string;
  submittedAt?: string;
  received_at?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  product_interest?: string;
  callback_date?: string;
  callback_time?: string;
  referral_source_self_reported?: string;
  referral_utm_source?: string;
  referral_utm_campaign?: string;
  leadStatus?: LeadStatusRecord;
}

interface LeadStatusRecord {
  enquiryId: string;
  status: string;
  notes?: string;
  nextFollowUpDate?: string;
  priority?: string;
  outcomeReason?: string;
  firstResponseAt?: string;
  lastContactedAt?: string;
  updatedAt?: string;
}

// ─── Risk classification ──────────────────────────────────────────────────────

const HIGH_RISK_PATHS = ['src/styles/', 'src/layouts/', 'src/components/', 'astro.config', 'package.json'];

function classifyRisk(path: string, currentContent: string | null, newContent: string): RiskClass {
  if (HIGH_RISK_PATHS.some(p => path.includes(p))) return 'high_risk';
  if (currentContent && newContent.length < currentContent.length * 0.5) return 'high_risk';
  return 'reversible_write';
}

// ─── Judge ────────────────────────────────────────────────────────────────────

const JUDGE_POLICY = `You are the ByondRV admin safety judge. A site actor agent has proposed a file change. Evaluate it against the owner's instruction and return JSON only.

POLICY:
- BLOCK if the file path was not mentioned or implied by the user's instruction (scope creep)
- BLOCK if the change description doesn't match what the user asked for
- ESCALATE if content is being drastically shortened (possible accidental deletion)
- ESCALATE if changing a core layout, style, or config file
- REVISE if the description is too vague to verify against the instruction
- ALLOW if it's a straightforward product data update clearly matching user intent

Return ONLY valid JSON with this exact shape:
{
  "decision": "allow" | "block" | "revise" | "escalate",
  "rationale": "one sentence",
  "risk_flags": ["array", "of", "concerns"],
  "revision_instructions": "string if decision is revise, else omit",
  "block_reason": "string if decision is block, else omit",
  "escalation_reason": "string if decision is escalate, else omit"
}`;

async function runJudge(proposal: ActionProposal): Promise<JudgeVerdict> {
  if (!client) {
    return { decision: 'block', rationale: 'OpenAI is not configured.', risk_flags: ['missing_openai_key'], block_reason: 'Admin AI cannot verify changes without an OpenAI API key.' };
  }

  const userBlock = `USER'S INSTRUCTION: "${proposal.user_raw_input}"

PROPOSED CHANGE:
- File: ${proposal.proposed_action.target}
- Description: ${proposal.proposed_action.description}
- New content length: ${proposal.proposed_action.content_length} chars
- Risk class: ${proposal.risk_class}`;

  const response = await client.responses.create({
    model: JUDGE_MODEL,
    instructions: JUDGE_POLICY,
    input: userBlock,
    max_output_tokens: 512,
  });

  const text = response.output_text || '{}';

  try {
    // Strip markdown code fences if the model added them
    const json = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    return JSON.parse(json) as JudgeVerdict;
  } catch {
    console.error('[judge] failed to parse verdict', text);
    return { decision: 'block', rationale: 'Safety judge returned invalid JSON.', risk_flags: ['judge_parse_error'], block_reason: 'Could not verify the proposed change safely.' };
  }
}

// ─── System prompt & tools ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Beyond RV site admin assistant. You help the owner update their Astro website by reading and proposing changes to files.

SITE STRUCTURE:
- Product content: src/content/products/*.md (frontmatter: title, price, status, onSale, featured, heroImage, gallery, keySpecs, specs, features, relatedSlugs, youtubeVideo, description)
- Product images: public/images/products/<slug>/
- Chatbot business knowledge: src/data/chatbot-knowledge.md
- Homepage recent builds: src/data/homepage/recent-builds.json
- Homepage testimonials: src/data/homepage/testimonials.json
- Site images: public/images/site/
- Pages: src/pages/**/*.astro
- Styles: src/styles/global.css

STATUS VALUES for products: available | on-sale | coming-soon
ONSALE: true | false (boolean)

RULES:
- Always read the file first before proposing changes
- Never guess at content — ask if you need clarification
- For operational admin requests, use the dedicated tools before proposing file edits
- If the owner asks about leads, enquiries, follow-ups, or reminders, use list_enquiries first unless they provide an exact enquiry ID
- If more than one enquiry matches a requested lead update, do not update anything; list the likely matches and ask which one
- Lead status writes happen immediately and do not go to Pending Changes
- If the owner asks about SEO, Google, sitemap, robots, AI search, or weak search pages, use get_seo_health
- Confirm what you will change before calling propose_change
- For chatbot knowledge, update src/data/chatbot-knowledge.md with short factual notes; do not add secrets, API keys, or private customer data
- For homepage Recent Builds, update src/data/homepage/recent-builds.json instead of editing homepage markup
- For testimonials, update src/data/homepage/testimonials.json; never invent customer quotes, customer names, or ratings
- Preserve valid JSON, existing IDs, sortOrder, and isVisible fields unless the owner explicitly asks to change them
- Standard product-line models stay listed when a unit sells; use the Orders admin tab to track customer orders and stock movement
- Remove a sold product from active listings only for one-off on-sale, demo, or used stock items, and add/confirm a redirect when removing a page
- For product videos, store YouTube data in a youtubeVideo frontmatter object. Store only the clean video ID in youtubeVideo.id, not the full URL. Preserve or remove the whole youtubeVideo block exactly as instructed by the owner.
- For images, the current UI can describe intended image changes but cannot upload full image files into the repository
- Be concise and friendly
- After proposing a change, tell the owner to review it in the Pending Changes panel and click Deploy when ready
- If the judge blocks your proposal, explain why to the owner and ask for clarification`;

async function githubFetch(path: string): Promise<string | null> {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return null;
  const res = await fetch(
    `${API}/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  if (!res.ok) return null;
  const data = await res.json() as { content: string };
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

async function githubListDir(path: string): Promise<string[]> {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return [];
  const res = await fetch(
    `${API}/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  if (!res.ok) return [];
  const data = await res.json() as { name: string; type: string }[];
  return data.map(f => `${f.type === 'dir' ? '📁' : '📄'} ${f.name}`);
}

const tools = [
  {
    type: 'function',
    name: 'read_file',
    description: 'Read a file from the GitHub repository',
    parameters: {
      type: 'object' as const,
      properties: { path: { type: 'string', description: 'File path relative to repo root' } },
      additionalProperties: false,
      required: ['path'],
    },
  },
  {
    type: 'function',
    name: 'list_files',
    description: 'List files in a directory of the repository',
    parameters: {
      type: 'object' as const,
      properties: { dir: { type: 'string', description: 'Directory path relative to repo root' } },
      additionalProperties: false,
      required: ['dir'],
    },
  },
  {
    type: 'function',
    name: 'propose_change',
    description: 'Queue a file change for the owner to review and deploy. Does NOT commit anything. A safety judge will review before queuing.',
    parameters: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path to change' },
        content: { type: 'string', description: 'Complete new file content' },
        description: { type: 'string', description: 'Short human-readable summary of what changed (e.g. "Sunpatch price $78,888 → $74,000")' },
      },
      additionalProperties: false,
      required: ['path', 'content', 'description'],
    },
  },
  {
    type: 'function',
    name: 'list_enquiries',
    description: 'Search or list recent customer enquiries and lead statuses. Use before updating a lead unless the owner provides an exact enquiry ID.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Optional search text such as customer name, email, phone, product, or message words' },
        limit: { type: 'number', description: 'Maximum number of records to return, default 8, max 20' },
      },
      additionalProperties: false,
      required: [],
    },
  },
  {
    type: 'function',
    name: 'update_lead_status',
    description: 'Immediately update a lead status, priority, notes, next follow-up date, and outcome reason. Use only when the target enquiry is unambiguous.',
    parameters: {
      type: 'object' as const,
      properties: {
        enquiry_id: { type: 'string', description: 'Exact enquiry ID to update' },
        status: { type: 'string', description: 'One of: new, contacted, replied, called, qualified, quoted, follow-up-scheduled, won, lost, spam' },
        notes: { type: 'string', description: 'Short factual notes to store on the lead' },
        next_follow_up_date: { type: 'string', description: 'Follow-up date in YYYY-MM-DD format, or blank to clear' },
        priority: { type: 'string', description: 'One of: hot, warm, info-only, spam-low-quality' },
        outcome_reason: { type: 'string', description: 'One of: too-expensive, wrong-vehicle, no-payload, bought-elsewhere, just-researching, no-response, timing-not-right, other, or blank' },
      },
      additionalProperties: false,
      required: ['enquiry_id', 'status'],
    },
  },
  {
    type: 'function',
    name: 'get_seo_health',
    description: 'Get current SEO crawl health, sitemap status, robots crawler access, weak page warnings, and content opportunities.',
    parameters: {
      type: 'object' as const,
      properties: {},
      additionalProperties: false,
      required: [],
    },
  },
];

function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalise(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function leadKey(enquiryId: string) {
  return `lead-status/${encodeURIComponent(enquiryId)}.json`;
}

function displayDate(value = '') {
  return value ? value.slice(0, 10) : '';
}

async function loadEnquiries(limit = 50): Promise<EnquiryRecord[]> {
  const store = getBlobStore(ENQUIRY_STORE);
  const statusStore = getBlobStore(LEAD_STATUS_STORE);
  const { blobs } = await store.list();
  const records = (await Promise.all(
    blobs.map(async (blob) => store.get(blob.key, { type: 'json' }) as Promise<EnquiryRecord | null>)
  ))
    .filter((record): record is EnquiryRecord => Boolean(record?.id))
    .sort((a, b) => (b.received_at ?? b.submittedAt ?? '').localeCompare(a.received_at ?? a.submittedAt ?? ''))
    .slice(0, limit);

  return Promise.all(records.map(async (record) => {
    let leadStatus: LeadStatusRecord | null = null;
    try {
      leadStatus = await statusStore.get(leadKey(record.id), { type: 'json' }) as LeadStatusRecord | null;
    } catch {
      leadStatus = null;
    }
    return {
      ...record,
      leadStatus: leadStatus ?? {
        enquiryId: record.id,
        status: 'new',
        notes: '',
        nextFollowUpDate: record.callback_date ?? '',
        priority: 'warm',
        outcomeReason: '',
        firstResponseAt: '',
        lastContactedAt: '',
        updatedAt: record.submittedAt ?? '',
      },
    };
  }));
}

function enquirySearchText(enquiry: EnquiryRecord) {
  return normalise([
    enquiry.id,
    enquiry.name,
    enquiry.email,
    enquiry.phone,
    enquiry.product_interest,
    enquiry.message,
    enquiry.referral_source_self_reported,
    enquiry.referral_utm_source,
    enquiry.referral_utm_campaign,
  ].filter(Boolean).join(' '));
}

async function listEnquiriesTool(query: unknown, limitValue: unknown) {
  const limit = Math.max(1, Math.min(20, typeof limitValue === 'number' ? Math.round(limitValue) : 8));
  const search = normalise(clean(query, 160));
  const enquiries = await loadEnquiries(50);
  const filtered = search
    ? enquiries.filter((enquiry) => enquirySearchText(enquiry).includes(search))
    : enquiries;

  return JSON.stringify({
    count: filtered.length,
    returned: filtered.slice(0, limit).map((enquiry) => ({
      id: enquiry.id,
      name: enquiry.name ?? '',
      email: enquiry.email ?? '',
      phone: enquiry.phone ?? '',
      product_interest: enquiry.product_interest ?? '',
      submitted: displayDate(enquiry.received_at ?? enquiry.submittedAt),
      status: enquiry.leadStatus?.status ?? 'new',
      priority: enquiry.leadStatus?.priority ?? 'warm',
      nextFollowUpDate: enquiry.leadStatus?.nextFollowUpDate ?? '',
      notes: enquiry.leadStatus?.notes ?? '',
      message_preview: clean(enquiry.message, 180),
    })),
  });
}

async function updateLeadStatusTool(input: Record<string, unknown>) {
  const enquiryId = clean(input.enquiry_id, 240);
  const status = clean(input.status, 40);
  const notes = clean(input.notes, 4000);
  const nextFollowUpDate = clean(input.next_follow_up_date, 40);
  const priority = clean(input.priority, 40);
  const outcomeReason = clean(input.outcome_reason, 80);

  if (!enquiryId) return 'Error: enquiry_id is required.';
  if (!VALID_LEAD_STATUSES.has(status)) return `Error: invalid status "${status}".`;
  if (priority && !VALID_LEAD_PRIORITIES.has(priority)) return `Error: invalid priority "${priority}".`;
  if (!VALID_OUTCOME_REASONS.has(outcomeReason)) return `Error: invalid outcome reason "${outcomeReason}".`;

  const enquiries = await loadEnquiries(100);
  const enquiry = enquiries.find((record) => record.id === enquiryId);
  if (!enquiry) return `Error: no enquiry found with ID ${enquiryId}. Use list_enquiries first.`;

  const statusStore = getBlobStore(LEAD_STATUS_STORE);
  let existing: LeadStatusRecord | null = null;
  try {
    existing = await statusStore.get(leadKey(enquiryId), { type: 'json' }) as LeadStatusRecord | null;
  } catch {
    existing = null;
  }

  const now = new Date().toISOString();
  const leadStatus: LeadStatusRecord = {
    ...existing,
    enquiryId,
    status,
    notes,
    nextFollowUpDate,
    priority: priority || existing?.priority || 'warm',
    outcomeReason,
    firstResponseAt: existing?.firstResponseAt || (['contacted', 'replied', 'called', 'qualified', 'quoted', 'follow-up-scheduled', 'won'].includes(status) ? now : ''),
    lastContactedAt: ['contacted', 'replied', 'called', 'qualified', 'quoted', 'follow-up-scheduled', 'won'].includes(status)
      ? now
      : existing?.lastContactedAt ?? '',
    updatedAt: now,
  };

  await statusStore.setJSON(leadKey(enquiryId), leadStatus);

  return JSON.stringify({
    ok: true,
    updated: {
      enquiry_id: enquiryId,
      customer: enquiry.name ?? '',
      product_interest: enquiry.product_interest ?? '',
      status: leadStatus.status,
      priority: leadStatus.priority,
      nextFollowUpDate: leadStatus.nextFollowUpDate,
      notes: leadStatus.notes,
      updatedAt: leadStatus.updatedAt,
    },
  });
}

async function fetchText(url: string) {
  const response = await fetch(url);
  return { ok: response.ok, status: response.status, text: await response.text() };
}

function extractUrls(xml: string) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]?.trim()).filter(Boolean) as string[];
}

async function getSeoHealthTool() {
  const [robots, sitemap, llms] = await Promise.all([
    fetchText(`${SITE_URL}/robots.txt`),
    fetchText(`${SITE_URL}/sitemap-0.xml`),
    fetchText(`${SITE_URL}/llms.txt`),
  ]);
  const urls = extractUrls(sitemap.text);
  const products = (catalogue as { products?: Array<{ slug: string; title: string; status?: string; galleryCount?: number; seoTitle?: string; seoDesc?: string }> }).products ?? [];
  const weakProducts = products
    .filter(product => (product.galleryCount ?? 0) < 3 || !product.seoTitle || !product.seoDesc)
    .slice(0, 8)
    .map(product => ({
      title: product.title,
      slug: product.slug,
      galleryCount: product.galleryCount ?? 0,
      missingSeoTitle: !product.seoTitle,
      missingSeoDesc: !product.seoDesc,
    }));

  return JSON.stringify({
    generatedAt: new Date().toISOString(),
    robots: {
      status: robots.status,
      allowsGooglebot: /Googlebot/i.test(robots.text),
      allowsBingbot: /Bingbot/i.test(robots.text),
      allowsOpenAI: /OAI-SearchBot/i.test(robots.text) && /ChatGPT-User/i.test(robots.text),
      allowsClaude: /Claude-SearchBot/i.test(robots.text),
      allowsPerplexity: /PerplexityBot/i.test(robots.text),
    },
    sitemap: {
      status: sitemap.status,
      urlCount: urls.length,
      hasLastmod: /<lastmod>/i.test(sitemap.text),
      sampleUrls: urls.slice(0, 12),
    },
    llms: {
      status: llms.status,
      available: llms.ok,
    },
    weakProducts,
    recommendedNextActions: [
      !/<lastmod>/i.test(sitemap.text) ? 'Add sitemap lastmod values.' : '',
      !/Claude-SearchBot/i.test(robots.text) || !/PerplexityBot/i.test(robots.text) ? 'Add Claude and Perplexity crawler allow rules if AI search visibility is desired.' : '',
      weakProducts.length ? 'Improve weak product listings with more photos and SEO metadata.' : '',
      'Check Google Search Console and Bing Webmaster Tools for query/page movement.',
    ].filter(Boolean),
  });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  connectBlobStore(event);

  if (!client || !GITHUB_TOKEN || !GITHUB_REPO) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Admin AI is not fully configured. Check OpenAI and GitHub environment variables.', pendingChanges: [] }),
    };
  }

  let messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  try {
    const parsed = JSON.parse(event.body ?? '{}') as { messages?: unknown };
    if (!Array.isArray(parsed.messages)) throw new Error('messages must be an array');
    messages = parsed.messages
      .filter((message): message is { role: 'user' | 'assistant'; content: string } => (
        typeof message === 'object' &&
        message !== null &&
        ((message as { role?: unknown }).role === 'user' || (message as { role?: unknown }).role === 'assistant') &&
        typeof (message as { content?: unknown }).content === 'string'
      ))
      .slice(-20);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  // Extract the last user message for judge context
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const userRawInput = lastUserMsg?.content ?? '';
  const brisbaneToday = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  }).format(new Date());
  const instructions = `${SYSTEM_PROMPT}

CURRENT DATE:
- Brisbane date today: ${brisbaneToday}
- When setting follow-up dates, convert relative wording into YYYY-MM-DD before calling update_lead_status.
- If a relative date is ambiguous, ask the owner to confirm before updating.`;

  // Cache of file content the actor has read (for delta-based risk classification)
  const readCache: Record<string, string> = {};

  let responseId: string | undefined;
  let currentInput: unknown = messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const pendingChanges: PendingChange[] = [];
  let finalText = '';

  for (let i = 0; i < 10; i++) {
    const response = await client.responses.create({
      model: ADMIN_MODEL,
      instructions,
      tools,
      input: currentInput as never,
      previous_response_id: responseId,
      max_output_tokens: 4096,
    } as never);

    responseId = response.id;

    for (const item of response.output as Array<Record<string, any>>) {
      if (item.type === 'message') {
        for (const content of item.content ?? []) {
          if (content.type === 'output_text') finalText += content.text;
        }
      }
    }

    const functionCalls = (response.output as Array<Record<string, any>>)
      .filter(item => item.type === 'function_call');

    if (functionCalls.length === 0) break;

    const toolResults: Array<{ type: 'function_call_output'; call_id: string; output: string }> = [];

    for (const call of functionCalls) {
        let result = '';
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(call.arguments ?? '{}') as Record<string, unknown>;
        } catch {
          result = 'Error: tool arguments were not valid JSON';
        }

        if (!result && call.name === 'read_file') {
          const path = clean(input.path, 500);
          const content = await githubFetch(path);
          if (content) readCache[path] = content;
          result = content ?? `Error: file not found at ${path}`;

        } else if (!result && call.name === 'list_files') {
          const dir = clean(input.dir, 500);
          const files = await githubListDir(dir);
          result = files.length ? files.join('\n') : `Error: directory not found at ${dir}`;

        } else if (!result && call.name === 'propose_change') {
          const path = clean(input.path, 500);
          const content = clean(input.content, 200000);
          const description = clean(input.description, 500);

          // Build proposal
          const proposal: ActionProposal = {
            proposal_id: randomUUID(),
            timestamp: new Date().toISOString(),
            user_raw_input: userRawInput,
            risk_class: classifyRisk(path, readCache[path] ?? null, content),
            proposed_action: { target: path, description, content_length: content.length },
          };

          // Run judge
          const verdict = await runJudge(proposal);

          if (verdict.decision === 'allow' || verdict.decision === 'escalate') {
            pendingChanges.push({
              path,
              content,
              description,
              proposal_id: proposal.proposal_id,
              judgeDecision: verdict.decision,
              risk_flags: verdict.risk_flags,
              escalation_reason: verdict.escalation_reason,
            });

            result = verdict.decision === 'allow'
              ? `Change queued (judge approved): ${description}`
              : `Change queued (ESCALATED — review carefully): ${description}. Reason: ${verdict.escalation_reason}`;

          } else if (verdict.decision === 'revise') {
            result = `REVISION NEEDED: The safety judge requires a revision before this change can be queued. Instructions: ${verdict.revision_instructions}. Please adjust and try propose_change again.`;

          } else {
            // block
            result = `BLOCKED: The safety judge blocked this change. Reason: ${verdict.block_reason}. Rationale: ${verdict.rationale}. Please tell the owner and ask for clarification.`;
          }
        } else if (!result && call.name === 'list_enquiries') {
          try {
            result = await listEnquiriesTool(input.query, input.limit);
          } catch (error) {
            result = `Error: could not load enquiries. ${blobStoreUserMessage(error)}`;
          }
        } else if (!result && call.name === 'update_lead_status') {
          try {
            result = await updateLeadStatusTool(input);
          } catch (error) {
            result = `Error: could not update lead. ${blobStoreUserMessage(error)}`;
          }
        } else if (!result && call.name === 'get_seo_health') {
          try {
            result = await getSeoHealthTool();
          } catch (error) {
            result = `Error: could not check SEO health. ${error instanceof Error ? error.message : String(error)}`;
          }
        } else if (!result) {
          result = `Error: unknown tool ${call.name}`;
        }

        toolResults.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: result,
        });
    }

    currentInput = toolResults;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: finalText, pendingChanges }),
  };
};
