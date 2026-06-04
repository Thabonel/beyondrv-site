import OpenAI from 'openai';
import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';

const openAiKey = process.env.OPENAI_API_KEY;
const client = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;
const REWRITE_MODEL = process.env.OPENAI_ADMIN_MODEL ?? 'gpt-5-mini';

const REWRITE_PROMPT = `You are an editor for a chatbot knowledge file. The user pastes rough notes or answers to business questions. Your job is to rewrite them into clean, factual dot points suitable for a chatbot knowledge base.

Rules:
- Keep the output as bullet points (one per line, starting with "- ").
- Be concise and factual. Remove fluff, marketing speak, and filler words.
- Preserve all facts and details from the original text.
- Group related points together logically.
- Do not add new facts or information not present in the input.
- Use Australian English spelling (colour, organise, aluminium, etc.).
- Keep the tone practical, direct, and friendly — not corporate.
- If the input is already well-structured dot points, tidy them up without changing the substance.
- Output ONLY the bullet points, no preamble or explanation.`;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!isAdminAuthorized(event)) return unauthorizedResponse();

  if (!client) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'OpenAI is not configured.' }),
    };
  }

  let draftText: string;
  try {
    const body = JSON.parse(event.body ?? '{}') as { text?: string };
    draftText = (body.text ?? '').trim();
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid request body.' }),
    };
  }

  if (!draftText) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'No text provided to rewrite.' }),
    };
  }

  try {
    const response = await client.responses.create({
      model: REWRITE_MODEL,
      instructions: REWRITE_PROMPT,
      input: `Rewrite the following notes into clean, factual dot points for a chatbot knowledge file:\n\n${draftText}`,
      max_output_tokens: 2048,
    });

    const rewritten = response.output_text?.trim() ?? '';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rewritten }),
    };
  } catch (err) {
    console.error('[knowledge-rewrite] OpenAI error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to rewrite text. Please try again.' }),
    };
  }
};
