import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../scripts/validate-manager-private-pilot-ui.mjs', import.meta.url), 'utf8');

test('private-pilot browser validation authenticates against its isolated local backend', () => {
  for (const contract of [
    "const LOCAL_AUTH_STORAGE_KEY = 'hall_of_fame_studio.local_auth_session.v1';",
    'let backendAuthContext = null;',
    'localAuthFilePath: join(ACCEPTANCE_ROOT, \'auth.json\')',
    'localAuthRequired: true',
    "fetch(`${backendRuntime.url}/local-auth/bootstrap`",
    "username: 'manager-private-pilot-validator'",
    "password: 'pilot1'",
    "provider: 'openai-compatible',\n    model: 'gpt-4o-mini',",
    'backendAuthContext = { baseUrl: backendRuntime.url, token: localAuthSession.token };',
    'window.sessionStorage.setItem(authStorageKey, JSON.stringify(authSession));',
    "const syncCatalogButton = page.getByTestId('backend-sync-project-catalog');",
    'if (await syncCatalogButton.count() > 0 && await syncCatalogButton.isVisible())',
    "page.getByTestId('project-overview').waitFor",
    "page.getByTestId('project-overview-open-advanced').waitFor",
    "page.getByTestId('project-overview-open-advanced').click()",
    'Validate private-pilot handoff for a generic AI product-team project.',
    'function validationProgress(label)',
    'async function waitForButtonDisabled(page, testId, message',
    'const readyPackageResponsePromise = page.waitForResponse((response) => (',
    "response.request().method() === 'GET'",
    "new URL(response.url()).pathname.endsWith('/manager-ready-package')",
    'const readyPackageResponse = await readyPackageResponsePromise;',
    'readyPackageResponse.ok(),',
    'validationProgress(`${label}: using refreshed prerequisites`)',
    'const [receiptResponse] = await Promise.all([',
    "page.waitForResponse((response) => (",
    "response.request().method() === 'POST'",
    "new URL(response.url()).pathname === route",
    'button.click(),',
    'const receiptPayload = await receiptResponse.json();',
    'receiptResponse.ok(),',
    'validationProgress(`${label}: receipt persisted`)',
    'await waitForButtonDisabled(page, testId, `${label} receipt button must disable after the backend receipt is recorded.`)',
  ]) {
    assert.ok(source.includes(contract), `Private-pilot browser validation must keep ${contract}`);
  }
  assert.equal(source.includes('PROJECT_ID.toUpperCase()'), false, 'Private-pilot validation must not require an internal project id in the ordinary project UI');
  assert.equal(
    source.includes('validationProgress(`${label}: syncing prerequisites`);\n  await syncReadyPackageModels(page);'),
    false,
    'Private-pilot validation must not repeat a full Ready Package sync immediately after the prior receipt refresh',
  );
  assert.equal(
    source.includes('validationProgress(`${label}: receipt persisted`);\n  await syncReadyPackageModels(page);'),
    false,
    'Private-pilot validation must verify the product automatic receipt refresh instead of forcing a full Ready Package sync',
  );
  assert.equal(
    source.includes('await proofButton.click();'),
    false,
    'Initial Ready Package validation must not cancel the full package request with a second proof-model sync',
  );
});
