import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function readJson(rel) {
  const full = path.join(root, rel);
  return JSON.parse(await readFile(full, 'utf8'));
}

async function testFixturesShape() {
  const p1 = await readJson('fixtures/auth/provider/marscode.exchange-token.ok.json');
  assert(p1.code === 0, 'marscode.exchange-token fixture invalid');
  const p2 = await readJson('fixtures/auth/provider/marscode.check-login.invalid.json');
  assert(p2.code !== 0, 'marscode.check-login.invalid fixture invalid');
  console.log('TEST_OK fixtures_shape');
}

async function testLoginSuccessScenario() {
  const s = await readJson('fixtures/auth/scenario/login.success.marscode.json');
  assert(s.name === 'login_success_marscode', 'scenario name mismatch');
  assert(s.expect.userId === 'u_1001', 'scenario expected user mismatch');
  console.log('TEST_OK login_success_marscode');
}

async function testRefreshInvalidScenario() {
  const s = await readJson('fixtures/auth/scenario/refresh.invalid.force-logout.json');
  assert(s.error === 'RefreshTokenInvalid', 'refresh invalid fixture mismatch');
  assert(s.expect.forceLogout === true, 'refresh invalid expected forceLogout mismatch');
  console.log('TEST_OK refresh_invalid_force_logout');
}

async function testStrictInvalidScenario() {
  const s = await readJson('fixtures/auth/scenario/strict.invalid.force-logout.json');
  assert(s.checkResult.isValid === false, 'strict invalid fixture mismatch');
  assert(s.expect.forceLogout === true, 'strict invalid expected forceLogout mismatch');
  console.log('TEST_OK strict_invalid_force_logout');
}

async function testRegionSelfHealScenario() {
  const a = await readJson('fixtures/auth/tnc/tnc.region.initial.did.json');
  const b = await readJson('fixtures/auth/tnc/tnc.region.uid.us.json');
  assert(a.countryCodeSrc === 'did', 'tnc initial source should be did');
  assert(b.countryCodeSrc === 'uid' && b.region === 'US', 'tnc uid region fixture mismatch');
  console.log('TEST_OK region_self_heal_fixture');
}

async function main() {
  await testFixturesShape();
  await testLoginSuccessScenario();
  await testRefreshInvalidScenario();
  await testStrictInvalidScenario();
  await testRegionSelfHealScenario();
  console.log('TEST_SUITE_OK auth_replay');
}

main().catch((e) => {
  console.error('TEST_SUITE_FAIL', e.message);
  process.exit(1);
});
