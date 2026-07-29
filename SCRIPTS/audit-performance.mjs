import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const exact = args.find((arg) => arg.startsWith(`${name}=`));
  return exact ? exact.slice(name.length + 1) : fallback;
};

const url = readArg('--url', 'https://beyondrv.com.au/');
const runs = Number.parseInt(readArg('--runs', '5'), 10);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = resolve(readArg('--out', `/tmp/beyondrv-lighthouse-${timestamp}`));
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

if (!Number.isInteger(runs) || runs < 1 || runs > 10) {
  throw new Error('--runs must be an integer from 1 to 10.');
}
if (!['http:', 'https:'].includes(new URL(url).protocol)) {
  throw new Error('--url must be an HTTP(S) URL.');
}

await mkdir(outputDir, { recursive: true });

function runLighthouse(outputPath) {
  const lighthouseArgs = [
    '--yes',
    'lighthouse@12.8.2',
    url,
    '--output=json',
    `--output-path=${outputPath}`,
    '--only-categories=performance,accessibility,best-practices,seo',
    '--chrome-flags=--headless=new --no-sandbox',
    '--quiet',
  ];
  if (process.env.CHROME_PATH) lighthouseArgs.push(`--chrome-path=${process.env.CHROME_PATH}`);

  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(npxCommand, lighthouseArgs, { stdio: 'inherit' });
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`Lighthouse exited with code ${code}.`));
    });
  });
}

const results = [];
for (let index = 1; index <= runs; index += 1) {
  const outputPath = resolve(outputDir, `run-${index}.json`);
  console.log(`Lighthouse run ${index}/${runs}: ${url}`);
  await runLighthouse(outputPath);
  const report = JSON.parse(await readFile(outputPath, 'utf8'));
  results.push({
    run: index,
    performance: Math.round(report.categories.performance.score * 100),
    accessibility: Math.round(report.categories.accessibility.score * 100),
    bestPractices: Math.round(report.categories['best-practices'].score * 100),
    seo: Math.round(report.categories.seo.score * 100),
    fcpMs: Math.round(report.audits['first-contentful-paint'].numericValue),
    lcpMs: Math.round(report.audits['largest-contentful-paint'].numericValue),
    tbtMs: Math.round(report.audits['total-blocking-time'].numericValue),
    cls: Number(report.audits['cumulative-layout-shift'].numericValue.toFixed(4)),
    speedIndexMs: Math.round(report.audits['speed-index'].numericValue),
  });
}

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const summary = {
  url,
  generatedAt: new Date().toISOString(),
  runs: results,
  median: {
    performance: median(results.map((result) => result.performance)),
    fcpMs: median(results.map((result) => result.fcpMs)),
    lcpMs: median(results.map((result) => result.lcpMs)),
    tbtMs: median(results.map((result) => result.tbtMs)),
    cls: median(results.map((result) => result.cls)),
    speedIndexMs: median(results.map((result) => result.speedIndexMs)),
  },
  minimum: {
    performance: Math.min(...results.map((result) => result.performance)),
    accessibility: Math.min(...results.map((result) => result.accessibility)),
    bestPractices: Math.min(...results.map((result) => result.bestPractices)),
    seo: Math.min(...results.map((result) => result.seo)),
  },
};

await writeFile(resolve(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
console.log(`Reports written to ${outputDir}`);
