import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pickerSource = readFileSync(new URL('../src/settings/ModelProviderPicker.jsx', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../src/settings/LocalModelSettings.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('provider picker exposes an accessible scrollable supplier drawer and dependent model list', () => {
  for (const contract of [
    'settings-model-provider-trigger',
    'settings-model-provider-drawer',
    'settings-model-provider-option-',
    'settings-model-name-trigger',
    'settings-model-name-drawer',
    'settings-model-name-option-',
  ]) assert.match(pickerSource, new RegExp(contract));
  assert.match(pickerSource, /role="dialog"/);
  assert.match(pickerSource, /max-h-\[min\(520px,70vh\)\].*overflow-y-auto/);
  assert.match(pickerSource, /prefers-reduced-motion/);
  assert.match(pickerSource, /data-user-content=\{!selectedModel && modelId \? '' : undefined\}/);
});

test('provider picker dialogs trap focus, hide background content, close with Escape, and restore the trigger', () => {
  for (const contract of [
    "import { useEffect, useRef, useState } from 'react'",
    'const overlayRef = useRef(null)',
    'const dialogRef = useRef(null)',
    "event.key === 'Escape'",
    'event.stopPropagation()',
    "event.key !== 'Tab'",
    "sibling.setAttribute('inert', '')",
    "sibling.setAttribute('aria-hidden', 'true')",
    'previousFocus?.focus()',
    "document.addEventListener('keydown', handleKeyDown, true)",
    "document.removeEventListener('keydown', handleKeyDown, true)",
    'ref={overlayRef}',
    'ref={dialogRef}',
    'tabIndex={-1}',
  ]) assert.ok(pickerSource.includes(contract), `missing accessible dialog contract: ${contract}`);
});

test('model settings select a provider before model and keep API key as the only required manual secret', () => {
  assert.match(settingsSource, /<ModelProviderPicker/);
  assert.match(settingsSource, /modelProvider/);
  assert.match(settingsSource, /modelApiKey/);
  assert.match(settingsSource, /自定义接口地址/);
  assert.match(settingsSource, /自定义模型名称/);
  assert.match(appSource, /provider: modelProviderDraft/);
  assert.match(appSource, /name: 'model\.provider'/);
  assert.match(appSource, /secretKind: 'provider'/);
});

test('StepFun selection requires an explicit animated domestic or international environment choice', () => {
  for (const contract of [
    'settings-stepfun-region-dialog',
    'settings-stepfun-region-option-global',
    'settings-stepfun-region-option-china',
    'stepfun-region-dialog-in',
    'stepfunRegionForBaseUrl',
  ]) assert.match(pickerSource, new RegExp(contract));

  assert.match(pickerSource, /baseURL/);
  assert.match(settingsSource, /baseURL=\{drafts\.modelBaseUrl\}/);
  assert.match(settingsSource, /providerId: selectedProvider\.id/);
  assert.match(settingsSource, /baseURL: drafts\.modelBaseUrl/);
});
