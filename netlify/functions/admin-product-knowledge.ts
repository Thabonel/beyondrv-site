import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { buildProductKnowledgeContext } from './product-knowledge-core';
import catalogue from './product-catalogue.json';
import chatbotKnowledge from './chatbot-knowledge.json';

function clean(value: unknown, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();

  let query = '';
  let productInterest = '';

  if (event.httpMethod === 'GET') {
    query = clean(event.queryStringParameters?.q);
    productInterest = clean(event.queryStringParameters?.product);
  } else {
    try {
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      query = clean(body.query);
      productInterest = clean(body.productInterest);
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid request' }),
      };
    }
  }

  if (!query && !productInterest) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Add a product or question to search approved knowledge.' }),
    };
  }

  const context = buildProductKnowledgeContext({
    query,
    productInterest,
    products: catalogue as Parameters<typeof buildProductKnowledgeContext>[0]['products'],
    businessKnowledge: chatbotKnowledge.content,
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ context }),
  };
};
