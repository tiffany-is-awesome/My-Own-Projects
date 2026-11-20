// Copies the single-file build to the repo root as wearwise.html (served by GitHub Pages).
// unique-ava.html at the repo root is a tiny forwarder kept so old links keep working.
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
copyFileSync(resolve(here, '../dist/index.html'), resolve(here, '../../wearwise.html'));
console.log('✔ Wrote ../wearwise.html');
