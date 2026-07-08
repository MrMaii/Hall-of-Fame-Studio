const contractScripts = [
  'validate-manager-chat-command-contract.mjs',
  'validate-agent-message-contract.mjs',
  'validate-agent-contract-contract.mjs',
  'validate-agent-workbench-contract.mjs',
  'validate-timeline-action-contract.mjs',
];

for (const script of contractScripts) {
  await import(`./${script}`);
}

console.log('Manager scenario low-write contract validation passed.');
