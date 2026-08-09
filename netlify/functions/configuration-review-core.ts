import { createHash, randomBytes } from 'node:crypto';
import { getBlobStore } from './blob-store.ts';
import { CONFIGURATION_STORE, configurationKey, hydrateConfigurationRecord } from './configuration-core.ts';
import type { ConfigurationRecord } from '../../src/lib/configurator/types';

export interface ReviewTokenIndex {
  configurationId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}

export function reviewTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function reviewTokenKey(tokenHash: string) {
  return `review-tokens/${tokenHash}.json`;
}

export function createReviewToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: reviewTokenHash(token), hint: token.slice(-6) };
}

export function reviewLinkState(configuration: ConfigurationRecord, tokenHash: string, now = new Date()) {
  if (!configuration.customerReview.tokenHash || configuration.customerReview.tokenHash !== tokenHash) return { valid: false, reason: 'This review link is no longer valid.' };
  if (configuration.customerReview.status === 'revoked') return { valid: false, reason: 'This review link was revoked.' };
  if (configuration.customerReview.status === 'expired' || !configuration.customerReview.expiresAt || new Date(configuration.customerReview.expiresAt).getTime() <= now.getTime()) return { valid: false, reason: 'This review link has expired.' };
  if (configuration.customerReview.configurationUpdatedAt !== configuration.updatedAt) return { valid: false, reason: 'This configuration changed after the review link was created. Ask Beyond RV for a new link.' };
  return { valid: true, reason: '' };
}

export async function loadConfigurationForReviewToken(token: string, now = new Date()) {
  const hash = reviewTokenHash(token);
  const store = getBlobStore(CONFIGURATION_STORE);
  const index = await store.get(reviewTokenKey(hash), { type: 'json' }) as ReviewTokenIndex | null;
  if (!index || index.tokenHash !== hash) return { configuration: null, state: { valid: false, reason: 'Review link not found.' }, hash, store };
  const rawConfiguration = await store.get(configurationKey(index.configurationId), { type: 'json' }) as ConfigurationRecord | null;
  const configuration = rawConfiguration ? hydrateConfigurationRecord(rawConfiguration) : null;
  if (!configuration) return { configuration: null, state: { valid: false, reason: 'Configuration not found.' }, hash, store };
  return { configuration, state: reviewLinkState(configuration, hash, now), hash, store };
}
