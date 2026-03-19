import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../root-resolver.mjs';

const ROOT = resolveFrameworkRoot(import.meta.url);
const MATRIX_DOC = path.join(ROOT, 'docs', 'Provider路由对齐矩阵.md');
const OUT = process.env.TRAE_AUTH_FINGERPRINT_FILE || path.join(ROOT, 'docs', 'provider-fingerprints.jsonl');

function parseMatrix(md) {
  const routes = [];
  for (const line of md.split('\n')) {
    if (!line.startsWith('| ')) continue;
    if (line.includes('| --- |')) continue;
    const cells = line.split('|').map((x) => x.trim());
    if (cells.length < 8) continue;
    if (cells[1] === 'Provider') continue;

    routes.push({
      provider: cells[1],
      path: cells[2],
      requiredData: splitKeys(cells[3]),
      requiredHeaders: splitKeys(cells[4])
    });
  }
  return routes;
}

function splitKeys(raw) {
  const text = String(raw || '');
  if (!text || text === '(none required by rule)') return [];
  return text.split(',').map((x) => x.trim()).filter(Boolean);
}

function buildRecord(route, idx) {
  const now = new Date().toISOString();
  const withToken = !route.path.includes('/oauth/ExchangeToken') && !route.path.includes('/GetUserToken');

  const dataKeys = [...new Set([...route.requiredData, 'SceneHint'])].sort();
  const headerKeys = [...new Set([...route.requiredHeaders, 'Content-Type'])].sort();

  return {
    ts: now,
    source: 'seed',
    provider: route.provider,
    path: route.path,
    method: 'POST',
    hasToken: withToken,
    requestId: `seed_req_${idx}`,
    traceId: `seed_trace_${idx}`,
    dataKeys,
    headerKeys,
    missingDataKeys: [],
    missingHeaderKeys: []
  };
}

async function main() {
  const matrix = await readFile(MATRIX_DOC, 'utf8');
  const routes = parseMatrix(matrix);
  const rows = routes.map((r, i) => buildRecord(r, i + 1));
  const content = rows.map((x) => JSON.stringify(x)).join('\n') + '\n';

  await writeFile(OUT, content, 'utf8');
  console.log('SEED_OK', OUT, 'records=' + rows.length);
}

main().catch((e) => {
  console.error('SEED_FAIL', e.message);
  process.exit(1);
});
