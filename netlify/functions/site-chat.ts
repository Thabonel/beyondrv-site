import Anthropic from '@anthropic-ai/sdk';
import type { Handler } from '@netlify/functions';
import catalogue from './product-catalogue.json';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BRAND_BLOCK = `You are the ByondRV assistant — a friendly, knowledgeable helper on the ByondRV website.
ByondRV builds slide-on campers, caravans, and expedition vehicles out of Mutdapilly, Queensland.

CONTACT:
- Phone: 0430 863 819
- Email: beyondcaravans@gmail.com
- Address: 77 Coleyville Rd, Mutdapilly QLD 4307

RULES:
- Answer questions about ByondRV products, specs, compatibility, and the buying process
- Be warm, direct, and Australian in tone — no corporate speak
- Keep responses under 3 short paragraphs — this is a chat, not an essay
- If you don't know something specific (delivery dates, finance, stock count), say so and suggest calling or enquiring
- Never fabricate specs — say "the team can confirm that" if uncertain
- When the customer signals purchase intent ("how do I order", "I want one", "I'm keen", "what's the process to buy"), respond naturally then add: "Sounds like you're ready to chat with the team — hit 'Talk to a human' above and I'll send them a summary of our conversation." Never auto-redirect. The user always clicks.
- Decline off-topic questions politely: "I'm set up to help with ByondRV campers — for anything else, I'd be out of my depth!"
- Never discuss competitor products`;

function buildSystemPrompt(productSlug?: string, pageTitle?: string): string {
  const pageContext = `CURRENT PAGE: ${pageTitle ?? 'ByondRV website'} (${productSlug ?? 'general'})`;

  let currentProductBlock = '';
  if (productSlug) {
    const product = (catalogue as { slug: string }[]).find((p) => p.slug === productSlug);
    if (product) {
      currentProductBlock = `\n\nCURRENT PRODUCT ENTRY:\n${JSON.stringify(product, null, 2)}`;
    }
  }

  const catalogueBlock = `PRODUCT CATALOGUE (all current products):\n${JSON.stringify(catalogue)}`;

  return `${BRAND_BLOCK}\n\n${pageContext}${currentProductBlock}\n\n${catalogueBlock}`;
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

  const { messages, productSlug, pageTitle } = JSON.parse(event.body ?? '{}') as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    productSlug?: string;
    pageTitle?: string;
  };

  if (!Array.isArray(messages)) {
    return { statusCode: 400, body: 'Bad Request' };
  }

  if (messages.length > 30) {
    return {
      statusCode: 200,
      headers: sseHeaders,
      body: "data: I've reached my session limit — hit \"Talk to a human\" above to reach the team directly.\n\ndata: [DONE]\n\n",
    };
  }

  const systemPrompt = buildSystemPrompt(productSlug, pageTitle);

  try {
    let fullText = '';

    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages,
    });

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        fullText += chunk.delta.text;
      }
    }

    const encoded = fullText.replace(/\n/g, '\\n');
    return {
      statusCode: 200,
      headers: sseHeaders,
      body: `data: ${encoded}\n\ndata: [DONE]\n\n`,
    };
  } catch (err) {
    console.error('[site-chat] Anthropic stream error:', err);
    return {
      statusCode: 500,
      headers: sseHeaders,
      body: 'data: [ERROR]\n\ndata: [DONE]\n\n',
    };
  }
};
