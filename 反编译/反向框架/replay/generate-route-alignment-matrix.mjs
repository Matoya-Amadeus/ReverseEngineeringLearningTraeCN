import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../root-resolver.mjs';

const ROOT = resolveFrameworkRoot(import.meta.url);
const OUT = path.join(ROOT, 'docs', 'Provider路由对齐矩阵.md');

const rows = [
  {
    provider: 'marscode',
    path: '/cloudide/api/v3/trae/oauth/ExchangeToken',
    requiredData: 'RefreshToken, ClientSecret, IDEVersion, AppVersion, Platform, Region',
    requiredHeaders: 'x-auth-provider, x-request-id, x-trace-id, x-auth-sign',
    payloadBuilder: 'buildExchangeTokenPayload',
    ruleType: 'hard',
    evidenceLevel: 'inferred-high-fidelity',
    status: 'aligned-inferred',
    evidenceNote: 'decompiled flow + replay parity; awaiting real capture evidence'
  },
  {
    provider: 'marscode',
    path: '/cloudide/api/v3/trae/GetUserInfo',
    requiredData: 'IDEVersion, AppVersion, Platform, Region',
    requiredHeaders: 'x-auth-provider, x-cloudide-token, x-request-id, x-auth-sign',
    payloadBuilder: 'buildUserInfoPayload',
    ruleType: 'hard',
    evidenceLevel: 'inferred-high-fidelity',
    status: 'aligned-inferred',
    evidenceNote: 'decompiled flow + replay parity; waiting for provider live capture diff'
  },
  {
    provider: 'marscode',
    path: '/cloudide/api/v3/trae/CheckLogin',
    requiredData: 'IDEVersion, AppVersion, Platform, Region',
    requiredHeaders: 'x-auth-provider, x-cloudide-token, x-request-id, x-auth-sign',
    payloadBuilder: 'buildCheckLoginPayload',
    ruleType: 'hard',
    evidenceLevel: 'inferred-high-fidelity',
    status: 'aligned-inferred',
    evidenceNote: 'decompiled flow + replay parity; live path still bootstrap-only'
  },
  {
    provider: 'marscode',
    path: '/cloudide/api/v3/trae/GenerateTempToken',
    requiredData: 'IDEVersion, AppVersion, Platform, Region, Scene',
    requiredHeaders: 'x-auth-provider, x-cloudide-token, x-request-id, x-auth-sign',
    payloadBuilder: 'buildGenerateTempTokenPayload',
    ruleType: 'hard',
    evidenceLevel: 'inferred-high-fidelity',
    status: 'aligned-inferred',
    evidenceNote: 'decompiled flow + replay parity; response shape is scaffolded until live proof'
  },
  {
    provider: 'saas',
    path: '/cloudide/api/v3/trae/oauth/ExchangeToken',
    requiredData: 'RefreshToken, ClientSecret, IDEVersion, AppVersion, Platform, Region',
    requiredHeaders: 'x-auth-provider, x-request-id, x-trace-id, x-auth-sign',
    payloadBuilder: 'buildExchangeTokenPayload',
    ruleType: 'hard',
    evidenceLevel: 'inferred-high-fidelity',
    status: 'aligned-inferred',
    evidenceNote: 'decompiled flow + replay parity; waiting for SaaS real capture'
  },
  {
    provider: 'saas',
    path: '/cloudide/api/v3/trae/GetUserInfo',
    requiredData: 'IDEVersion, AppVersion, Platform, Region',
    requiredHeaders: 'x-auth-provider, x-cloudide-token, x-request-id, x-auth-sign',
    payloadBuilder: 'buildUserInfoPayload',
    ruleType: 'hard',
    evidenceLevel: 'inferred-high-fidelity',
    status: 'aligned-inferred',
    evidenceNote: 'decompiled flow + replay parity; tenant fields remain inferred'
  },
  {
    provider: 'saas',
    path: '/cloudide/api/v3/trae/CheckLogin',
    requiredData: 'IDEVersion, AppVersion, Platform, Region',
    requiredHeaders: 'x-auth-provider, x-cloudide-token, x-request-id, x-auth-sign',
    payloadBuilder: 'buildCheckLoginPayload',
    ruleType: 'hard',
    evidenceLevel: 'inferred-high-fidelity',
    status: 'aligned-inferred',
    evidenceNote: 'decompiled flow + replay parity; route semantics to confirm by live capture'
  },
  {
    provider: 'bytedance',
    path: '/api/v2/GetUserToken',
    requiredData: 'Token, IDEVersion, AppVersion, Platform, Region',
    requiredHeaders: 'x-auth-provider, x-auth-sign, X-Cloudide-Token',
    payloadBuilder: 'buildBytedanceTokenPayload',
    ruleType: 'hard',
    evidenceLevel: 'inferred-high-fidelity',
    status: 'aligned-inferred',
    evidenceNote: 'decompiled flow + replay parity; anti-abuse signature details still inferred'
  },
  {
    provider: 'bytedance',
    path: '/api/v2/GetUserNativeRegion',
    requiredData: 'IDEVersion, AppVersion, Platform, Region, Scene',
    requiredHeaders: 'x-auth-provider, x-auth-sign, X-Cloudide-Token',
    payloadBuilder: 'buildBytedanceRegionPayload',
    ruleType: 'hard',
    evidenceLevel: 'inferred-high-fidelity',
    status: 'aligned-inferred',
    evidenceNote: 'decompiled flow + replay parity; region path needs live verification'
  }
];

function buildMarkdown() {
  const head = [
    '# Provider Route Alignment Matrix',
    '',
    'Date: 2026-03-18',
    'Scope: ${ROOT}',
    '',
    '| Provider | Path | Required Data Keys | Required Header Keys | Payload Builder | Rule Type | Evidence Level | Status | Evidence Note |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  ];

  const body = rows.map((r) =>
    `| ${r.provider} | ${r.path} | ${r.requiredData} | ${r.requiredHeaders} | ${r.payloadBuilder} | ${r.ruleType} | ${r.evidenceLevel} | ${r.status} | ${r.evidenceNote} |`
  );

  const tail = [
    '',
    '## Notes',
    '- `Rule Type=hard` means request keys are enforced by runtime alignment checker.',
    '- `Evidence Level=inferred-high-fidelity` means route behavior currently reconstructed from decompiled pseudo-code + replay, not fully proven by real capture.',
    '- Fingerprint capture lives in `src/auth/providers/network/request-fingerprint-recorder.ts`.',
    '- Optional JSONL export can be enabled with env `TRAE_AUTH_FINGERPRINT_FILE`.',
    ''
  ];

  return [...head, ...body, ...tail].join('\n');
}

async function main() {
  await writeFile(OUT, buildMarkdown(), 'utf8');
  console.log('MATRIX_OK', OUT);
}

main().catch((e) => {
  console.error('MATRIX_FAIL', e.message);
  process.exit(1);
});
