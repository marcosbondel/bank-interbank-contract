// The course's base contract must reach this repository untouched (enunciado
// Fase 3, §4.1: "Los grupos no deben modificarlo"). When it is added, its
// SHA-256 is recorded in openapi/course-base/SHA256SUMS by whoever downloaded
// it, and from then on any edit to the file fails CI.
//
//   node scripts/check-course-base.mjs

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../openapi/course-base/', import.meta.url));
const contracts = readdirSync(dir).filter((file) => /\.(ya?ml|json)$/.test(file));

if (contracts.length === 0) {
  console.log('No course contract yet: openapi/course-base/ holds no .yaml or .json. Nothing to verify.');
  process.exit(0);
}

const sumsPath = join(dir, 'SHA256SUMS');
if (!existsSync(sumsPath)) {
  console.error('openapi/course-base/ has a contract but no SHA256SUMS. Record it with:');
  console.error('  (cd openapi/course-base && shasum -a 256 <file> > SHA256SUMS)');
  process.exit(1);
}

const expected = new Map(
  readFileSync(sumsPath, 'utf8')
    .split('\n')
    .map((line) => line.trim().split(/\s+\*?/))
    .filter((parts) => parts.length === 2)
    .map(([hash, file]) => [file, hash]),
);

let failures = 0;
for (const file of contracts) {
  const actual = createHash('sha256').update(readFileSync(join(dir, file))).digest('hex');
  if (expected.get(file) === actual) {
    console.log(`✓ ${file} is the file the course published (${actual.slice(0, 12)}…)`);
  } else {
    console.error(`✗ ${file}: hash ${actual} does not match SHA256SUMS. The course contract must not be edited.`);
    failures += 1;
  }
}

process.exit(failures === 0 ? 0 : 1);
