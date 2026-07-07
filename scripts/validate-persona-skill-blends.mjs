import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PERSON_SKILL_COUNT,
  buildPersonaProfessionalBrief,
  buildPersonaSkillBlend,
  buildPersonActingBrief,
  createRoundtablePlan,
  inferProfessionalSkillsForTask,
} from '../src/skills/personSkillSystem.js';
import { advanceAutonomousProjectCycle } from '../src/agents/agentRuntime.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const personaPackageRoot = resolve(repoRoot, 'skills/hall-of-fame-personas/personas');
const personaSkillDocs = readdirSync(personaPackageRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .filter((entry) => existsSync(resolve(personaPackageRoot, entry.name, 'SKILL.md')));

const productMarketTask = '做一个本地 AI Agent 产品的市场调研、痛点分析和产品设计';
const inferred = inferProfessionalSkillsForTask(productMarketTask, 3).map((item) => item.id);
assert(inferred.includes('market_research'), 'Market task must infer market_research.');
assert(inferred.includes('product_design'), 'Product task must infer product_design.');
assert(personaSkillDocs.length === PERSON_SKILL_COUNT, 'Every canonical persona must expose a package Skill document.');

const buffettMarket = buildPersonaSkillBlend('buffett', productMarketTask);
const jobsProduct = buildPersonaSkillBlend('jobs', productMarketTask);
const turingProduct = buildPersonaSkillBlend('turing', productMarketTask);
assert(
  ['buffett', 'jobs', 'turing'].every((slug) => existsSync(resolve(personaPackageRoot, slug, 'SKILL.md'))),
  'Representative personas must provide package Skill documents.',
);

assert(buffettMarket.selectedSkill.id === 'market_research', 'Buffett should use market_research for product-market research.');
assert(/moats|opportunity cost|pain-to-value/i.test(buffettMarket.edge), 'Buffett blend must expose his market/business edge.');
assert(jobsProduct.selectedSkill.id === 'product_design', 'Jobs should use product_design for product work.');
assert(/product experience|taste|launch/i.test(jobsProduct.edge), 'Jobs blend must expose experience/taste/launch edge.');
assert(['product_design', 'engineering_breakdown'].includes(turingProduct.selectedSkill.id), 'Turing should use a product or engineering method for product-system work.');
assert(/mechanism|protocols|verification/i.test(turingProduct.edge), 'Turing blend must expose mechanism/protocol/verification edge.');

const buffettDesign = buildPersonaSkillBlend('buffett', '请让 Buffett 做产品设计和 onboarding flow');
assert(buffettDesign.selectedSkill.id === 'product_design', 'A persona must be able to call a non-signature public skill when assigned that work.');
assert(/opportunity cost|pain-to-value|moats/i.test(buffettDesign.edge), 'Non-signature work must still be reshaped through the persona edge.');

const brief = buildPersonaProfessionalBrief('jobs', productMarketTask);
assert(brief.includes('Professional skill selected: Product Design'), 'Professional brief must name the selected reusable skill.');
assert(brief.includes('Do not only imitate voice or style'), 'Professional brief must reject style-only persona behavior.');

const actingBrief = buildPersonActingBrief('buffett', productMarketTask);
assert(actingBrief.includes('Professional skill selected: Market Research'), 'Acting brief must inject the selected professional skill.');
assert(actingBrief.includes('Reusable skill method:'), 'Acting brief must include reusable professional method steps.');

const plan = createRoundtablePlan(['buffett', 'jobs', 'turing'], productMarketTask);
assert(plan.professionalSkills.some((item) => item.id === 'market_research'), 'Roundtable plan must expose inferred professional skills.');
assert(plan.taskMatches.every((item) => item.blend?.selectedSkill?.id), 'Every task match must carry a persona/skill blend.');

const team = [
  { id: 'buffett', name: 'Warren Buffett', role: 'Market Strategist', capabilities: ['strategy', 'review'] },
  { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', capabilities: ['product', 'orchestration'] },
  { id: 'turing', name: 'Alan Turing', role: 'Systems Architect', capabilities: ['implementation', 'review'] },
];

const result = advanceAutonomousProjectCycle({
  project: {
    id: 'blend_demo',
    name: 'Local Agent Studio',
    objective: productMarketTask,
    team,
    tasks: [],
    logs: [],
  },
  team,
  cadence: 'hourly',
  messages: [],
  language: 'en',
  now: '2026-06-08T12:00:00.000Z',
});

const autonomousPlans = result.project.autonomousLedger?.[0]?.agentPlans || [];
assert(autonomousPlans.length === team.length, 'Autonomous ledger must retain every agent plan.');
assert(autonomousPlans.every((item) => item.professionalSkill?.id), 'Autonomous ledger plans must retain professionalSkill evidence.');
assert(result.cycle.agentStates.jobs.currentPlan.professionalSkill.id === 'product_design', 'Agent state must retain selected professional skill.');

console.log(`Validated persona skill blends across ${PERSON_SKILL_COUNT} registered personas`);
