#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const violations = [];

const generatedPath = /(^|\/)(node_modules|playwright-report|test-results|work|outputs)(\/|$)/;
const secretFilename = /(^|\/)(\.env(?!\.example$)|id_(rsa|ed25519)|credentials[^/]*\.json|service-account[^/]*\.json|[^/]*\.(pem|p12|pfx))$/i;
const expectedLargeExtensions = new Set(['.glb', '.gltf', '.wasm', '.webp', '.avif', '.jpg', '.jpeg', '.png', '.pdf', '.mp4']);
const secretSignatures = [
  ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n(?:[A-Za-z0-9+/]{40,}={0,2}\r?\n){2,}-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token', /\bgh[opsu]_[A-Za-z0-9]{30,}\b/],
  ['Stripe live secret', /\bsk_live_[A-Za-z0-9]{20,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
];

for (const path of tracked) {
  if (!existsSync(path)) continue;
  if (generatedPath.test(path)) violations.push(`${path}: generated or dependency directory is tracked`);
  if (secretFilename.test(path)) violations.push(`${path}: secret-bearing filename is tracked`);

  const stat = statSync(path);
  if (stat.size > 25 * 1024 * 1024 && !expectedLargeExtensions.has(extname(path).toLowerCase())) {
    violations.push(`${path}: unexpected tracked file exceeds 25 MiB`);
  }
  if (stat.size > 2 * 1024 * 1024 || stat.size === 0) continue;

  const content = readFileSync(path, 'utf8');
  if (content.includes('\0')) continue;
  for (const [label, pattern] of secretSignatures) {
    if (pattern.test(content)) violations.push(`${path}: contains a ${label}`);
  }
}

if (violations.length) {
  console.error('Repository hygiene audit failed:');
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}

console.log(`Repository hygiene audit passed for ${tracked.length} tracked files.`);
