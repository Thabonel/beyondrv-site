import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import catalogue from './product-catalogue.json';
import archivedCatalogue from './product-archive-catalogue.json';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, 'site:read')) return forbiddenResponse('site:read');

  const products = event.queryStringParameters?.archived === 'true'
    ? archivedCatalogue
    : catalogue;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
    },
    body: JSON.stringify({ products }),
  };
};
