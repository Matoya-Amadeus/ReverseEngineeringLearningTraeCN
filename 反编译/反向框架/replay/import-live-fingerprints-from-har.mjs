import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../root-resolver.mjs';

const ROOT = resolveFrameworkRoot(import.meta.url);
const HAR_FILE = process.env.TRAE_AUTH_HAR_FILE || path.join(ROOT, 'docs', 'capture.har');
const OUT_FILE = process.env.TRAE_AUTH_FINGERPRINT_LIVE_IN || path.join(ROOT, 'docs', 'provider-fingerprints.live.in.jsonl');

const ROUTE_SET = new Set([
  '/cloudide/api/v3/trae/oauth/ExchangeToken',
  '/cloudide/api/v3/trae/GetUserInfo',
  '/cloudide/api/v3/trae/CheckLogin',
  '/cloudide/api/v3/trae/GenerateTempToken',
  '/api/v2/GetUserToken',
  '/api/v2/GetUserNativeRegion'
]);

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function lowerHeaderMap(headers = []) {
  const map = new Map();
  for (const h of headers) {
    const name = String(h?.name || '').trim();
    if (!name) continue;
    map.set(name.toLowerCase(), String(h?.value || ''));
  }
  return map;
}

function inferProvider(routePath, headerMap) {
  const viaHeader = String(headerMap.get('x-auth-provider') || '').toLowerCase();
  if (viaHeader.includes('mars')) return 'marscode';
  if (viaHeader.includes('saas')) return 'saas';
  if (viaHeader.includes('byte')) return 'bytedance';

  if (routePath.startsWith('/api/v2/')) return 'bytedance';
  return 'marscode';
}

function parseDataKeys(postData) {
  const text = String(postData?.text || '').trim();
  if (!text) return [];
  try {
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
    return Object.keys(obj).map((x) => String(x)).filter(Boolean).sort();
  } catch {
    return [];
  }
}

function extractRoutePath(url) {
  try {
    const u = new URL(String(url || ''));
    return u.pathname || '';
  } catch {
    return '';
  }
}

function toRow(entry, idx, sourceHar) {
  const req = entry?.request || {};
  const routePath = extractRoutePath(req.url);
  if (!ROUTE_SET.has(routePath)) return undefined;

  const headers = Array.isArray(req.headers) ? req.headers : [];
  const headerKeys = [...new Set(headers.map((h) => String(h?.name || '').trim()).filter(Boolean))].sort();
  const headerMap = lowerHeaderMap(headers);

  const requestId =
    String(headerMap.get('x-request-id') || '') ||
    String(headerMap.get('x-tt-logid') || '') ||
    `har_req_${idx + 1}`;

  return {
    ts: String(entry?.startedDateTime || new Date().toISOString()),
    source: 'live',
    captureMode: 'har-import',
    captureEvidence: 'har',
    captureSourceFile: sourceHar,
    provider: inferProvider(routePath, headerMap),
    path: routePath,
    method: String(req.method || 'POST'),
    hasToken: headerMap.has('x-cloudide-token'),
    requestId,
    traceId: String(headerMap.get('x-trace-id') || ''),
    dataKeys: parseDataKeys(req.postData),
    headerKeys,
    missingDataKeys: [],
    missingHeaderKeys: []
  };
}

function dedupe(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = [row.provider, row.path, row.requestId || row.ts].join('|');
    map.set(key, row);
  }
  return [...map.values()];
}

async function readJsonl(file) {
  if (!(await exists(file))) return [];
  const text = await readFile(file, 'utf8');
  const rows = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      rows.push(JSON.parse(t));
    } catch {
      // ignore malformed rows
    }
  }
  return rows;
}

async function main() {
  if (!(await exists(HAR_FILE))) {
    console.log('HAR_IMPORT_SKIP', HAR_FILE, 'not found');
    return;
  }

  const har = JSON.parse(await readFile(HAR_FILE, 'utf8'));
  const entries = Array.isArray(har?.log?.entries) ? har.log.entries : [];

  const imported = [];
  for (let i = 0; i < entries.length; i += 1) {
    const row = toRow(entries[i], i, HAR_FILE);
    if (!row) continue;
    imported.push(row);
  }

  const existing = await readJsonl(OUT_FILE);
  const merged = dedupe([...existing, ...imported]);
  const content = merged.map((x) => JSON.stringify(x)).join('\n') + (merged.length > 0 ? '\n' : '');
  await writeFile(OUT_FILE, content, 'utf8');

  console.log('HAR_IMPORT_OK', OUT_FILE, `entries=${entries.length}`, `imported=${imported.length}`, `records=${merged.length}`);
}

main().catch((e) => {
  console.error('HAR_IMPORT_FAIL', e.message);
  process.exit(1);
});
