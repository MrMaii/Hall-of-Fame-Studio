const contractScripts = [
  'validate-transcript-channel-create-contract.mjs',
  'validate-transcript-search-contract.mjs',
  'validate-transcript-channel-pin-contract.mjs',
  'validate-transcript-pin-contract.mjs',
  'validate-transcript-reply-contract.mjs',
  'validate-transcript-mention-contract.mjs',
  'validate-transcript-attachment-contract.mjs',
  'validate-transcript-member-presence-contract.mjs',
];

for (const script of contractScripts) {
  await import(`./${script}`);
}

console.log('Group Chat transcript low-write contract validation passed.');
