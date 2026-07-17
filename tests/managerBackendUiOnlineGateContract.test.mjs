import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const workerStationStatusSource = readFileSync(new URL('../src/project/ProjectDashboardBackendWorkerStationStatus.jsx', import.meta.url), 'utf8');
const stationRegionSource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendStationRegion.jsx', import.meta.url), 'utf8');
const stationContentSource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendStationContent.jsx', import.meta.url), 'utf8');
const workerStationPanelsSource = readFileSync(new URL('../src/project/ProjectDashboardManagerWorkerStationPanels.jsx', import.meta.url), 'utf8');
const validationSource = readFileSync(new URL('../scripts/validate-manager-backend-ui.mjs', import.meta.url), 'utf8');

test('backend UI validation waits for the rendered online state before sending a manager assignment', () => {
  assert.match(workerStationStatusSource, /data-testid="backend-worker-connection-status"/);
  assert.match(managerBodySource, /<ProjectDashboardManagerBackendStationRegion/);
  assert.match(stationRegionSource, /<ProjectDashboardManagerBackendStationContent/);
  assert.match(stationContentSource, /<ProjectDashboardManagerWorkerStationPanels/);
  assert.match(workerStationPanelsSource, /<ProjectDashboardBackendWorkerStationStatus/);
  assert.match(validationSource, /const waitForBackendOnlineStatus = async \(page/);

  const intentResponseIndex = validationSource.indexOf('const collaborationIntentQueueHttpResponse = await collaborationIntentQueueResponse;');
  const manualSyncConfirmationIndex = validationSource.indexOf("await page.getByText(/Backend collaboration intent queue synced/i).waitFor", intentResponseIndex);
  const onlineWaitIndex = validationSource.indexOf('await waitForBackendOnlineStatus(page);', intentResponseIndex);
  const assignmentClickIndex = validationSource.indexOf('await submitManagerAssignment(page);', intentResponseIndex);

  assert.ok(intentResponseIndex >= 0, 'intent response assertion must remain present');
  assert.ok(manualSyncConfirmationIndex > intentResponseIndex, 'manual intent sync confirmation must follow the matching response');
  assert.ok(onlineWaitIndex > manualSyncConfirmationIndex, 'online-state wait must follow the manual sync confirmation');
  assert.ok(assignmentClickIndex > onlineWaitIndex, 'manager assignment must follow the rendered online-state wait');
});

test('the long backend validation dispatches Leader assignment from the current enabled button', () => {
  assert.match(validationSource, /async function submitManagerAssignment\(page\)/);
  assert.match(validationSource, /waitForEnabledTestId\(page, 'manager-assignment-composer-submit'\)/);
  assert.match(validationSource, /button\.evaluate\(\(element\) => element\.click\(\)\)/);
});

test('the long backend validation dispatches the management proof click after confirming the button is available', () => {
  assert.match(
    validationSource,
    /getByRole\('button', \{ name: \/Management timeline proof\/i \}\)\.first\(\)\.evaluate\(\(button\) => button\.click\(\)\)/,
  );
});

test('the long backend validation dispatches a managed Agent pulse after confirming the button is available', () => {
  assert.match(
    validationSource,
    /getByTestId\(`agent-work-cycle-\$\{managedResponseTargetButtonId\}`\)\.evaluate\(\(button\) => button\.click\(\)\)/,
  );
});

test('the long backend validation scrolls the worker station without waiting for dashboard rerenders to settle', () => {
  assert.match(
    validationSource,
    /station\.evaluate\(\(element\) => element\.scrollIntoView\(\{ block: 'center' \}\)\)/,
  );
});

test('the long backend validation allows the meeting input to mount under sustained local load', () => {
  const meetingHelperStart = validationSource.indexOf('async function sendMeetingPrefill');
  const meetingHelperEnd = validationSource.indexOf('function playwrightChromiumExecutableCandidates', meetingHelperStart);
  const meetingHelper = validationSource.slice(meetingHelperStart, meetingHelperEnd);

  assert.match(meetingHelper, /input\.waitFor\(\{ state: 'visible', timeout: 30000 \}\)/);
  assert.match(meetingHelper, /\{ timeout: 15000 \}/);
});

test('the long backend validation waits for serialized sync controls under local load', () => {
  assert.match(validationSource, /async function waitForEnabledTestId\(page, testId, timeout = 65000\)/);
});

test('the long backend validation allows Dashboard navigation to finish under local load', () => {
  assert.match(validationSource, /getByTestId\('project-dashboard-view'\)\.waitFor\(\{ state: 'visible', timeout: 30000 \}\)/);
});

test('the long backend validation allows proof-map cards to render after large local ledgers', () => {
  const proofMapWaits = validationSource.match(/getByTestId\('proof-map-(?:collaboration-intent-queue|submission-review-workflow|product-team-acceptance-chain|product-team-delivery-trace)'\)\.waitFor\(\{ state: 'visible', timeout: 15000 \}\)/g) || [];
  assert.equal(proofMapWaits.length, 4);
});

test('the long backend validation does not duplicate diagnostic syncs during initial Dashboard hydration', () => {
  assert.doesNotMatch(validationSource, /for \(const syncTestId of \[\s*'backend-sync-scenario-walkthrough'/);
  const walkthroughClicks = validationSource.match(/getByTestId\('backend-sync-scenario-walkthrough'\)\.click\(\)/g) || [];
  assert.equal(walkthroughClicks.length, 1);
});

test('manager snapshot refreshes get a realistic local-backend render window', () => {
  const waits = validationSource.match(/getByTestId\('backend-manager-dashboard-snapshot'\)\.waitFor\(\{ state: 'visible', timeout: 15000 \}\)/g) || [];
  assert.equal(waits.length, 2);
  const readyPackageWaits = validationSource.match(/getByTestId\('backend-manager-ready-package-snapshot'\)\.waitFor\(\{ state: 'visible', timeout: 30000 \}\)/g) || [];
  assert.equal(readyPackageWaits.length, 3);
});

test('the long backend validation starts initiation from either restored workspace view', () => {
  assert.match(validationSource, /async function startInitiationFromWorkspace\(page\)/);
  assert.match(validationSource, /getByTestId\('project-hub'\)/);
  assert.match(validationSource, /getByTestId\('start-initiation-button'\)/);
  assert.match(validationSource, /await startInitiationFromWorkspace\(page\);/);
});

test('the long backend validation opens the restored full project console after initiation', () => {
  assert.match(validationSource, /async function openAdvancedProjectDashboard\(page\)/);
  assert.match(validationSource, /getByTestId\('project-simple-dashboard'\)/);
  assert.match(validationSource, /getByTestId\('project-overview'\)\.locator\('header button'\)\.nth\(1\)\.click\(\)/);
  assert.match(validationSource, /await openAdvancedProjectDashboard\(page\);/);
});

test('the long backend validation accepts structurally ready local drafts without bypassing human review', () => {
  assert.match(
    validationSource,
    /realSubmission\.artifactDraftQuality\?\.structurallyReadyForReview/,
  );
});

test('the long backend validation triggers Manager sync after the busy state clears', () => {
  assert.match(validationSource, /async function syncManagerView\(page\)/);
  assert.match(validationSource, /waitForEnabledTestId\(page, 'backend-sync-manager-view'\)/);
  assert.match(validationSource, /button\.evaluate\(\(element\) => element\.click\(\)\)/);
  assert.doesNotMatch(validationSource, /station\.getByRole\('button', \{ name: \/Sync Manager View\/i \}\)\.click\(\)/);
});
