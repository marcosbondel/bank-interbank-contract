// Every example under examples/ must match its schema, and every example under
// examples/<Schema>/invalid/ must NOT. The second half is the point: a schema
// that accepts anything passes the first half trivially.
//
//   node scripts/validate-examples.mjs [path/to/contract.yaml]
//
// The directory name is the schema name in `components.schemas`.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('..', import.meta.url));
const contractPath = process.argv[2] ?? join(root, 'openapi/interbank.provisional.yaml');
const examplesDir = join(root, 'examples');

const contract = parse(readFileSync(contractPath, 'utf8'));
const schemas = contract?.components?.schemas ?? {};

// OpenAPI 3.1 schemas are JSON Schema 2020-12; only the $ref prefix differs.
const defs = JSON.parse(JSON.stringify(schemas).replaceAll('#/components/schemas/', '#/$defs/'));

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema({ $id: 'contract', $defs: defs });

let failures = 0;
let checked = 0;

for (const schemaName of readdirSync(examplesDir).sort()) {
  const dir = join(examplesDir, schemaName);
  if (!statSync(dir).isDirectory()) continue;

  if (!(schemaName in schemas)) {
    console.error(`✗ examples/${schemaName}: no schema named ${schemaName} in ${relative(root, contractPath)}`);
    failures += 1;
    continue;
  }

  const validate = ajv.getSchema(`contract#/$defs/${schemaName}`);

  for (const [subdir, mustPass] of [
    ['', true],
    ['invalid', false],
  ]) {
    const target = join(dir, subdir);
    let files = [];
    try {
      files = readdirSync(target).filter((file) => file.endsWith('.json'));
    } catch {
      continue;
    }

    for (const file of files.sort()) {
      const path = join(target, file);
      const valid = validate(JSON.parse(readFileSync(path, 'utf8')));
      checked += 1;

      if (valid === mustPass) {
        console.log(`✓ ${relative(root, path)}${mustPass ? '' : ' (rejected, as it must be)'}`);
      } else {
        failures += 1;
        const why = mustPass ? ajv.errorsText(validate.errors) : 'the schema accepted it';
        console.error(`✗ ${relative(root, path)}: ${why}`);
      }
    }
  }
}

console.log(`\n${checked} examples checked, ${failures} failed.`);
process.exit(failures === 0 && checked > 0 ? 0 : 1);
