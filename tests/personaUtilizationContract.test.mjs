import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPersonaSkillBlend,
  describeSkillIntent,
} from '../src/skills/personSkillSystem.js';
import { en } from '../src/i18n/locales/en.js';
import { zh } from '../src/i18n/locales/zh.js';

const missionBrief = 'Validate a generic AI product team using a research-style brief only as a sample customer goal.';

test('lead and reviewer self-marketing intents keep their selected professional skill visible', () => {
  const plan = {
    lead: { slug: 'jobs' },
    reviewer: { slug: 'curie' },
  };

  for (const slug of ['jobs', 'curie']) {
    const blend = buildPersonaSkillBlend(slug, missionBrief);
    const intent = describeSkillIntent(slug, missionBrief, plan);
    const visibleLabels = [blend.selectedSkill.zh, blend.selectedSkill.label].filter(Boolean);
    assert.ok(
      visibleLabels.some((label) => intent.includes(label)),
      `${slug} intent must expose its selected professional skill`,
    );
  }
});

test('Agent progress explains why management-priority work ran', () => {
  assert.ok(en.agent.managementPriority.includes('{reasons}'));
  assert.ok(zh.agent.managementPriority.includes('{reasons}'));
});
