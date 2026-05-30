import { connectLambda, getStore, type Store } from '@netlify/blobs';
import type { HandlerEvent } from '@netlify/functions';

type BlobRuntimeSource = 'event.blobs' | 'NETLIFY_BLOBS_CONTEXT' | 'explicit-env' | 'missing';

export interface BlobStoreConnection {
  source: BlobRuntimeSource;
  connected: boolean;
  missing: string[];
}

export class BlobStoreConfigurationError extends Error {
  code = 'BLOB_STORE_CONFIGURATION_ERROR';
  runtimeSource: BlobRuntimeSource;
  missing: string[];

  constructor(message: string, runtimeSource: BlobRuntimeSource, missing: string[]) {
    super(message);
    this.name = 'BlobStoreConfigurationError';
    this.runtimeSource = runtimeSource;
    this.missing = missing;
  }
}

let lambdaBlobsConnected = false;

function hasBlobsContext() {
  return Boolean(
    process.env.NETLIFY_BLOBS_CONTEXT ||
    typeof (globalThis as typeof globalThis & { netlifyBlobsContext?: unknown }).netlifyBlobsContext === 'string'
  );
}

function getExplicitConfig() {
  return {
    siteID: process.env.NETLIFY_BLOBS_SITE_ID || process.env.NETLIFY_SITE_ID || process.env.SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN,
  };
}

function missingConfig() {
  const { siteID, token } = getExplicitConfig();
  return [
    !siteID && 'NETLIFY_BLOBS_CONTEXT or event.blobs or NETLIFY_BLOBS_SITE_ID/NETLIFY_SITE_ID/SITE_ID',
    !token && 'NETLIFY_BLOBS_CONTEXT or event.blobs or NETLIFY_BLOBS_TOKEN/NETLIFY_AUTH_TOKEN',
  ].filter(Boolean) as string[];
}

export function connectBlobStore(event: HandlerEvent): BlobStoreConnection {
  const lambdaEvent = event as HandlerEvent & { blobs?: string };
  if (typeof lambdaEvent.blobs === 'string') {
    const headers = Object.fromEntries(
      Object.entries(event.headers).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
    connectLambda({ blobs: lambdaEvent.blobs, headers });
    lambdaBlobsConnected = true;
    return { source: 'event.blobs', connected: true, missing: [] };
  }
  lambdaBlobsConnected = false;
  if (hasBlobsContext()) return { source: 'NETLIFY_BLOBS_CONTEXT', connected: true, missing: [] };

  const { siteID, token } = getExplicitConfig();
  return siteID && token
    ? { source: 'explicit-env', connected: true, missing: [] }
    : { source: 'missing', connected: false, missing: missingConfig() };
}

export function getBlobStore(name: string): Store {
  if (lambdaBlobsConnected || hasBlobsContext()) {
    return getStore({
      name,
    });
  }

  const { siteID, token } = getExplicitConfig();

  if (siteID && token) {
    return getStore({
      name,
      siteID,
      token,
    });
  }

  const missing = missingConfig();

  throw new BlobStoreConfigurationError(
    `Netlify Blobs is not configured for store "${name}". Missing ${missing.join(' and ')}.`,
    'missing',
    missing
  );
}

export function safeBlobStoreError(error: unknown) {
  if (error instanceof BlobStoreConfigurationError) {
    return {
      name: error.name,
      code: error.code,
      message: error.message,
      runtimeSource: error.runtimeSource,
      missing: error.missing,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      status: 'status' in error && typeof error.status === 'number' ? error.status : undefined,
    };
  }

  return {
    name: 'UnknownError',
    message: 'Unknown Netlify Blobs error.',
  };
}

export function blobStoreUserMessage(error: unknown) {
  const safe = safeBlobStoreError(error);
  return safe.message || 'Netlify Blobs is unavailable. Check function logs for the safe diagnostic.';
}
