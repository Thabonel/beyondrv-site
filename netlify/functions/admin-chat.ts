import Anthropic from '@anthropic-ai/sdk';
import type { Handler } from '@netlify/functions';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_REPO = process.env.GITHUB_REPO!;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? 'main';
const API = 'https://api.github.com';

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
- After proposing a change, tell the owner to review it in the Pending Changes panel and click Deploy when ready`;

async function githubFetch(path: string) {
  const res = await fetch(
    `${API}/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  if (!res.ok) return null;
  const data = await res.json() as { content: string };
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

async function githubListDir(path: string) {
  const res = await fetch(
    `${API}/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  if (!res.ok) return [];
  const data = await res.json() as { name: string; type: string }[];
  return data.map(f => `${f.type === 'dir' ? '📁' : '📄'} ${f.name}`);
}

const tools: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read a file from the GitHub repository',
    input_schema: {
      type: 'object' as const,
      properties: { path: { type: 'string', description: 'File path relative to repo root' } },
      required: ['path'],
    },
  },
  {
    name: 'list_files',
    description: 'List files in a directory of the repository',
    input_schema: {
      type: 'object' as const,
      properties: { dir: { type: 'string', description: 'Directory path relative to repo root' } },
      required: ['dir'],
    },
  },
  {
    name: 'propose_change',
    description: 'Queue a file change for the owner to review and deploy. Does NOT commit anything.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path to change' },
        content: { type: 'string', description: 'Complete new file content' },
        description: { type: 'string', description: 'Short human-readable summary of what changed (e.g. "Sunpatch price $78,888 → $74,000")' },
      },
      required: ['path', 'content', 'description'],
    },
  },
];

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { messages } = JSON.parse(event.body ?? '{}') as {
    messages: Anthropic.MessageParam[];
  };

  let currentMessages = [...messages];
  const pendingChanges: { path: string; content: string; description: string }[] = [];
  let finalText = '';

  for (let i = 0; i < 10; i++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages: currentMessages,
    });

    for (const block of response.content) {
      if (block.type === 'text') finalText += block.text;
    }

    if (response.stop_reason === 'end_turn') break;

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        let result = '';
        const input = block.input as Record<string, string>;

        if (block.name === 'read_file') {
          const content = await githubFetch(input.path);
          result = content ?? `Error: file not found at ${input.path}`;
        } else if (block.name === 'list_files') {
          const files = await githubListDir(input.dir);
          result = files.length ? files.join('\n') : `Error: directory not found at ${input.dir}`;
        } else if (block.name === 'propose_change') {
          pendingChanges.push({
            path: input.path,
            content: input.content,
            description: input.description,
          });
          result = `Change queued: ${input.description}`;
        }

        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }

      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ];
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: finalText, pendingChanges }),
  };
};
