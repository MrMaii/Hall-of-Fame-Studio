import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const marketViewUrl = new URL('../src/scenes/AgentMarketRouteView.jsx', import.meta.url);
const dossierViewUrl = new URL('../src/scenes/AgentDossierRouteView.jsx', import.meta.url);

test('talent market and dossier route displays load independently while retaining existing actions', () => {
  assert.ok(existsSync(marketViewUrl), 'AgentMarketRouteView must exist');
  assert.ok(existsSync(dossierViewUrl), 'AgentDossierRouteView must exist');
  const marketViewSource = readFileSync(marketViewUrl, 'utf8');
  const dossierViewSource = readFileSync(dossierViewUrl, 'utf8');

  assert.ok(appSource.includes("lazy(() => import('./scenes/AgentMarketRouteView.jsx'))"));
  assert.ok(appSource.includes("lazy(() => import('./scenes/AgentDossierRouteView.jsx'))"));
  assert.ok(appSource.includes('<AgentMarketRouteView'));
  assert.ok(appSource.includes('<AgentDossierRouteView'));
  assert.ok(!appSource.includes('<AgentMarketScene'));
  assert.ok(!appSource.includes('<AgentDossierScene'));

  for (const retained of ['AgentMarketScene', 'onOpenDossier', 'onContinueInitiation', 'setMarketSearch', 'setMarketCategory']) {
    assert.ok(marketViewSource.includes(retained), `market route view is missing ${retained}`);
  }
  for (const retained of ['AgentDossierScene', 'closeMarketDossier', 'startContractStamp', 'evidenceStrips']) {
    assert.ok(dossierViewSource.includes(retained), `dossier route view is missing ${retained}`);
  }

  for (const retainedAction of ['openMarketDossier', 'continueInitiationFromMarket', 'closeMarketDossier', 'startContractStamp']) {
    assert.ok(appSource.includes(retainedAction), `App must retain ${retainedAction}`);
  }
});
