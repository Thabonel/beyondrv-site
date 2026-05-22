import OpenAI from 'openai';
import type { Handler } from '@netlify/functions';
import { randomUUID } from 'crypto';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ADMIN_MODEL = process.env.OPENAI_ADMIN_MODEL ?? 'gpt-5-mini';
const JUDGE_MODEL = process.env.OPENAI_JUDGE_MODEL ?? 'gpt-5-mini';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_REPO = process.env.GITHUB_REPO!;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? 'main';
const API = 'https://api.github.com';

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
    const parsed = JSON.parse(json) as JudgeVerdict;
    console.log(`[judge] proposal=${proposal.proposal_id} model=${JUDGE_MODEL} decision=${parsed.decision} rationale="${parsed.rationale}"`);
    return parsed;
  } catch {
    console.error('[judge] failed to parse verdict, defaulting to allow', text);
    return { decision: 'allow', rationale: 'Parse error — defaulting to allow', risk_flags: ['judge_parse_error'] };
  }
}

// ─── System prompt & tools ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Beyond RV site admin assistant. You help the owner update their Astro website by reading and proposing changes to files.

SITE STRUCTURE:
- Product content: src/content/products/*.md (frontmatter: title, price, status, onSale, featured, heroImage, gallery, keySpecs, specs, features, description)
- Product images: public/images/products/<slug>/
- Site images: public/images/site/
- Pages: src/pages/**/*.astro
- Styles: src/styles/global.css

STATUS VALUES for products: available | sold | on-order | coming-soon
ONSALE: true | false (boolean)

RULES:
- Always read the file first before proposing changes
- Never guess at content — ask if you need clarification
- Confirm what you will change before calling propose_change
- For images, the owner will upload via the UI — you just note the target path
- Be concise and friendly
- After proposing a change, tell the owner to review it in the Pending Changes panel and click Deploy when ready
- If the judge blocks your proposal, explain why to the owner and ask for clarification`;

async function githubFetch(path: string): Promise<string | null> {
  const res = await fetch(
    `${API}/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  if (!res.ok) return null;
  const data = await res.json() as { content: string };
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

async function githubListDir(path: string): Promise<string[]> {
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
];

// ─── Handler ──────────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();

  const { messages } = JSON.parse(event.body ?? '{}') as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  // Extract the last user message for judge context
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const userRawInput = lastUserMsg?.content ?? '';

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
      instructions: SYSTEM_PROMPT,
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
        let input: Record<string, string> = {};
        try {
          input = JSON.parse(call.arguments ?? '{}') as Record<string, string>;
        } catch {
          result = 'Error: tool arguments were not valid JSON';
        }

        if (!result && call.name === 'read_file') {
          const content = await githubFetch(input.path);
          if (content) readCache[input.path] = content;
          result = content ?? `Error: file not found at ${input.path}`;

        } else if (!result && call.name === 'list_files') {
          const files = await githubListDir(input.dir);
          result = files.length ? files.join('\n') : `Error: directory not found at ${input.dir}`;

        } else if (!result && call.name === 'propose_change') {
          const { path, content, description } = input;

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
