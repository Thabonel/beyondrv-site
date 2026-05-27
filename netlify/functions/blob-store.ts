import { getStore, type Store } from '@netlify/blobs';

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
