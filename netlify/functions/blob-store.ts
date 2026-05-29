import { connectLambda, getStore, type Store } from '@netlify/blobs';
import type { HandlerEvent } from '@netlify/functions';

export function connectBlobStore(event: HandlerEvent) {
  const lambdaEvent = event as HandlerEvent & { blobs?: string };
  if (typeof lambdaEvent.blobs === 'string') {
    const headers = Object.fromEntries(
      Object.entries(event.headers).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
    connectLambda({ blobs: lambdaEvent.blobs, headers });
  }
}

export function getBlobStore(name: string): Store {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;

  if (siteID && token) {
    return getStore(name, {
      consistency: 'strong',
      siteID,
      token,
    });
  }

  return getStore({
    name,
    consistency: 'strong',
  });
}
