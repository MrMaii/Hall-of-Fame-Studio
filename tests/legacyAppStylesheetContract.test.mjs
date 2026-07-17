import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const stylesheetUrl = new URL('../src/styles/legacyApp.css', import.meta.url);

test('legacy application styles load as CSS instead of runtime JavaScript', () => {
  assert.ok(existsSync(stylesheetUrl), 'legacy application stylesheet must exist');
  assert.ok(mainSource.includes("import './styles/legacyApp.css';"));
  assert.ok(mainSource.indexOf("import './styles/legacyApp.css';") > mainSource.indexOf("import './index.css';"));
  assert.ok(!appSource.includes('const globalStyles = `'));
  assert.ok(!appSource.includes('styleSheet.textContent = globalStyles'));
  assert.ok(!appSource.includes('document.createElement("style")'));

  const stylesheetSource = readFileSync(stylesheetUrl, 'utf8');
  assert.ok(stylesheetSource.length > 18000, 'legacy stylesheet must retain the complete original style set');
  for (const retainedStyle of [
    ':root {',
    '.project-room {',
    '.project-paper {',
    '.scene-bubble {',
    '.tl-node-card {',
    '.meeting-avatar {',
    '.meeting-timer {',
    '@keyframes link-flow',
    '@keyframes chatMsgIn',
    '@keyframes tlNodeIn',
    '@keyframes sound-wave',
  ]) {
    assert.ok(stylesheetSource.includes(retainedStyle), `legacy stylesheet is missing: ${retainedStyle}`);
  }
});
