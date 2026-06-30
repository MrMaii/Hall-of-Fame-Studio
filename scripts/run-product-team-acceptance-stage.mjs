const stage = process.argv[2] || 'core';

process.env.HOFS_PRODUCT_TEAM_STAGE = stage;
process.env.HOFS_PROGRESS = process.env.HOFS_PROGRESS || '1';

await import('./validate-product-team-acceptance-scenario.mjs');
