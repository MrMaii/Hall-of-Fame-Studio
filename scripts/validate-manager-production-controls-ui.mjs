process.env.HOFS_MANAGER_PRIVATE_PILOT_RUN_PRODUCTION_CONTROLS = '1';
process.env.HOFS_MANAGER_PRIVATE_PILOT_RUN_ID = process.env.HOFS_MANAGER_PRODUCTION_CONTROLS_RUN_ID
  || process.env.HOFS_MANAGER_PRIVATE_PILOT_RUN_ID
  || `manager-production-controls-ui-${process.pid}`;

await import('./validate-manager-private-pilot-ui.mjs');
