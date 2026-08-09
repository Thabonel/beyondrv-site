import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [, , inputArg, outputArg] = process.argv;
if (!inputArg || !outputArg) {
  console.error('Usage: npm run configurator:prepare-glb -- input.glb output.glb');
  process.exit(1);
}
const input = resolve(inputArg);
const output = resolve(outputArg);
if (!input.toLowerCase().endsWith('.glb') || !output.toLowerCase().endsWith('.glb')) {
  console.error('Input and output must be .glb files.');
  process.exit(1);
}
const header = readFileSync(input).subarray(0, 4).toString('ascii');
if (header !== 'glTF') {
  console.error('Input is not a valid binary glTF file.');
  process.exit(1);
}
const executable = resolve('node_modules/.bin/gltf-transform');
const result = spawnSync(executable, ['optimize', input, output, '--compress', 'draco'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const bytes = statSync(output).size;
if (bytes > 25 * 1024 * 1024) {
  console.error(`Optimized GLB is ${(bytes / 1024 / 1024).toFixed(1)}MB; reduce it below 25MB before upload.`);
  process.exit(1);
}
console.log(`Prepared ${output} (${(bytes / 1024 / 1024).toFixed(2)}MB).`);
