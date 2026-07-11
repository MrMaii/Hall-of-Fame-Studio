import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
const fail = (message) => { throw new Error(message); };
const ledger = read('docs/LOCAL_ONLY_50_CAPABILITIES.md');
const modes = read('docs/SUPER_AGENT_WORK_MODES.md');
const packageJson = JSON.parse(read('package.json'));
const rows = ledger.split(/\r?\n/).map((line) => line.match(/^\|\s*(\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/)).filter(Boolean)
  .map((match) => ({ number: Number(match[1]), name: match[2].trim(), status: match[3].trim(), evidence: match[4].trim() }));

if (rows.length !== 50) fail(`Expected exactly 50 capability rows, found ${rows.length}.`);
if (rows.some((row, index) => row.number !== index + 1)) fail('Capability rows must be uniquely numbered 1 through 50 in order.');
const incomplete = rows.filter((row) => row.status !== '已验证');
if (incomplete.length) fail(`Capabilities without current verified status: ${incomplete.map((row) => `${row.number}:${row.name}:${row.status}`).join(', ')}`);
const placeholderEvidence = rows.filter((row) => !row.evidence || /artifact gates|待补|placeholder|manual/i.test(row.evidence));
if (placeholderEvidence.length) fail(`Capabilities with placeholder evidence: ${placeholderEvidence.map((row) => row.number).join(', ')}`);
for (const mode of ['learning', 'academic-writing', 'investigation', 'technical-delivery', 'creative-studio']) {
  if (!modes.includes(`\`${mode}\``)) fail(`Missing documented work mode: ${mode}.`);
}
for (const command of ['agents:learning-program', 'agents:academic-writing-pipeline', 'agents:investigation-case', 'agents:technical-delivery', 'agents:creative-studio', 'agents:rights-provenance']) {
  if (!packageJson.scripts?.[command]) fail(`Missing executable capability evidence: npm run ${command}.`);
}
if (!/\*\*不\*\*把 SaaS、云端账号或公共生产部署当作前提/.test(ledger)) fail('Capability ledger must retain the pure-local non-SaaS boundary.');

console.log('All 50 pure-local capabilities have current executable evidence.');
