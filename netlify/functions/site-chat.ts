import OpenAI from 'openai';
import type { Handler } from '@netlify/functions';
import catalogue from './product-catalogue.json';
import chatbotKnowledge from './chatbot-knowledge.json';

const openAiKey = process.env.OPENAI_API_KEY;
const client = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? 'gpt-5-nano';
const FALLBACK_REPLY = 'I had trouble getting the AI response just then. Please call 0430 863 819 or hit Talk to a human and the Beyond RV team can help directly.';

const BRAND_BLOCK = `You are the Beyond RV assistant — a friendly, knowledgeable helper on the Beyond RV website.
Beyond RV builds slide-on campers, caravans, and expedition vehicles out of Mutdapilly, Queensland.

CONTACT:
- Phone: 0430 863 819
- Email: beyondcaravans@gmail.com
- Address: 77 Coleyville Rd, Mutdapilly QLD 4307

RULES:
- Answer questions about Beyond RV products, specs, compatibility, and the buying process
- Be warm, direct, and Australian in tone — no corporate speak
- Keep responses under 3 short paragraphs — this is a chat, not an essay
- If you don't know something specific (delivery dates, finance, stock count), say so and suggest calling or enquiring
- Never fabricate specs — say "the team can confirm that" if uncertain
- When the customer signals purchase intent ("how do I order", "I want one", "I'm keen", "what's the process to buy"), respond naturally then add: "Sounds like you're ready to chat with the team — hit 'Talk to a human' above and I'll send them a summary of our conversation." Never auto-redirect. The user always clicks.
- Do not say "I can pass your info to the team" or imply you can send details directly unless you also tell the customer to click "Talk to a human" above. The handoff only happens when the customer clicks that button.
- Decline off-topic questions politely: "I'm set up to help with Beyond RV campers — for anything else, I'd be out of my depth!"
- Never discuss competitor products`;

function buildSystemPrompt(productSlug?: string, pageTitle?: string): string {
  const pageContext = `CURRENT PAGE: ${pageTitle ?? 'Beyond RV website'} (${productSlug ?? 'general'})`;

  let currentProductBlock = '';
  if (productSlug) {
    const product = (catalogue as { slug: string }[]).find((p) => p.slug === productSlug);
    if (product) {
      currentProductBlock = `\n\nCURRENT PRODUCT ENTRY:\n${JSON.stringify(product, null, 2)}`;
    }
  }

  const catalogueBlock = `PRODUCT CATALOGUE (all current products):\n${JSON.stringify(catalogue)}`;
  const knowledgeBlock = `BUSINESS KNOWLEDGE:\n${chatbotKnowledge.content || 'No additional business knowledge has been added yet.'}`;

  return `${BRAND_BLOCK}\n\n${pageContext}${currentProductBlock}\n\n${catalogueBlock}\n\n${knowledgeBlock}`;
}

function fallbackForQuestion(messages: { role: 'user' | 'assistant'; content: string }[]) {
  const lastUserMessage = [...messages].reverse().find(message => message.role === 'user')?.content.toLowerCase() ?? '';

  if (lastUserMessage.includes('lead time') || lastUserMessage.includes('how long')) {
    return 'Lead time depends on the vehicle, build spec, current production queue, and whether it is a custom expedition fitout. For a Unimog camper, the team should confirm the current slot directly — call 0430 863 819 or hit Talk to a human and send through your vehicle details.';
  }

  return FALLBACK_REPLY;
}

function responseOptions(messages: { role: 'user' | 'assistant'; content: string }[], systemPrompt: string) {
  const options: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
    model: CHAT_MODEL,
    instructions: systemPrompt,
    input: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    max_output_tokens: 1200,
  };

  if (CHAT_MODEL.startsWith('gpt-5')) {
    options.reasoning = { effort: 'minimal' };
  }

  return options;
}

export const handler: Handler = async (event) => {
  const sseHeaders = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!client) {
    return {
      statusCode: 200,
      headers: sseHeaders,
      body: 'data: The chat assistant is not available right now. Please call 0430 863 819 or use the enquiry form.\\n\\ndata: [DONE]\\n\\n',
    };
  }

  let parsed: { messages?: unknown; productSlug?: unknown; pageTitle?: unknown };
  try {
    parsed = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, body: 'Bad Request' };
  }

  if (!Array.isArray(parsed.messages)) {
    return { statusCode: 400, body: 'Bad Request' };
  }
  const messages = parsed.messages
    .filter((message): message is { role: 'user' | 'assistant'; content: string } => (
      typeof message === 'object' &&
      message !== null &&
      ((message as { role?: unknown }).role === 'user' || (message as { role?: unknown }).role === 'assistant') &&
      typeof (message as { content?: unknown }).content === 'string'
    ))
    .slice(-30);

  if (!messages.length) return { statusCode: 400, body: 'Bad Request' };

  const safeSlug = typeof parsed.productSlug === 'string' ? parsed.productSlug.slice(0, 100) : undefined;
  const safeTitle = typeof parsed.pageTitle === 'string' ? parsed.pageTitle.slice(0, 200) : undefined;

  if (messages.length > 30) {
    return {
      statusCode: 200,
      headers: sseHeaders,
      body: "data: I've reached my session limit — hit \"Talk to a human\" above to reach the team directly.\n\ndata: [DONE]\n\n",
    };
  }

  const systemPrompt = buildSystemPrompt(safeSlug, safeTitle);

  try {
    const response = await client.responses.create(responseOptions(messages, systemPrompt));

    const fullText = response.output_text?.trim() || fallbackForQuestion(messages);
    const encoded = fullText.replace(/\n/g, '\\n');
    return {
      statusCode: 200,
      headers: sseHeaders,
      body: `data: ${encoded}\n\ndata: [DONE]\n\n`,
    };
  } catch (err) {
    console.error('[site-chat] OpenAI response error:', err);
    return {
      statusCode: 500,
      headers: sseHeaders,
      body: 'data: [ERROR]\n\ndata: [DONE]\n\n',
    };
  }
};
