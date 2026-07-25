import type { Handler } from '@netlify/functions';
import { runGoogleGmailSync } from './google-gmail-sync';

export const config = {
  schedule: '*/5 * * * *',
};

export const handler: Handler = async event => {
  if (event.headers['x-nf-event'] !== 'schedule') return { statusCode: 403, body: 'Scheduled invocation only.' };
  return runGoogleGmailSync(event);
};
