import personas from '../../skills/hall-of-fame-personas/build/personas.json' with { type: 'json' };

const SKILL_RAW = typeof import.meta.glob === 'function'
  ? import.meta.glob(
    '../../skills/hall-of-fame-personas/personas/*/SKILL.md',
    { query: '?raw', import: 'default', eager: true },
  )
  : {};

export const PERSON_SKILL_VERSION = '0.4.0';

export const PERSONALITY_DIMENSIONS = [
  { key: 'activity', label: 'Activity', zh: '积极度' },
  { key: 'optimism', label: 'Optimism', zh: '乐观度' },
  { key: 'leadership', label: 'Leadership', zh: '领导倾向' },
  { key: 'rigor', label: 'Rigor', zh: '严谨度' },
  { key: 'initiative', label: 'Initiative', zh: '主动性' },
  { key: 'riskTolerance', label: 'Risk', zh: '风险承受' },
  { key: 'patience', label: 'Patience', zh: '耐心' },
  { key: 'collaboration', label: 'Collab', zh: '协作性' },
  { key: 'skepticism', label: 'Skeptic', zh: '怀疑精神' },
  { key: 'creativity', label: 'Creative', zh: '创造性' },
];

function slugFromSkillPath(path) {
  const normalized = path.replace(/\\/g, '/');
  const match = normalized.match(/personas\/([^/]+)\/SKILL\.md$/);
  return match ? match[1] : null;
}

function stripFrontmatter(text = '') {
  if (!text.startsWith('---')) return text;
  const end = text.indexOf('---', 3);
  if (end === -1) return text;
  return text.slice(end + 3).trimStart();
}

const PERSON_SKILL_DOCS = Object.fromEntries(
  Object.entries(SKILL_RAW).flatMap(([path, text]) => {
    const slug = slugFromSkillPath(path);
    return slug ? [[slug, stripFrontmatter(text)]] : [];
  }),
);

export const PERSON_SKILLS = personas;
export const PERSON_SKILL_COUNT = Object.keys(PERSON_SKILLS).length;
export const PERSON_SKILL_DOC_COUNT = Object.keys(PERSON_SKILL_DOCS).length;

const normalizeText = (text = '') => text.toLowerCase();

const splitTerms = (text = '') => normalizeText(text)
  .replace(/[^\w\u4e00-\u9fff]+/g, ' ')
  .split(/\s+/)
  .filter(Boolean);

const charBigrams = (text = '') => {
  const value = normalizeText(text);
  if (value.length < 2) return new Set();
  return new Set([...value].slice(0, -1).map((_, index) => value.slice(index, index + 2)));
};

function fuzzyPhraseMatch(taskText = '', phrase = '') {
  const text = normalizeText(taskText);
  const value = normalizeText(phrase);
  if (!text || !value) return false;
  if (text.includes(value) || value.includes(text)) return true;
  if (value.length < 4) return false;
  const phraseGrams = charBigrams(value);
  const taskGrams = charBigrams(text);
  if (!phraseGrams.size || !taskGrams.size) return false;
  const hits = [...phraseGrams].filter((gram) => taskGrams.has(gram)).length;
  return hits / phraseGrams.size >= 0.42;
}

function phraseHitCount(taskText = '', phrases = []) {
  return phrases.reduce((count, phrase) => (
    fuzzyPhraseMatch(taskText, phrase) ? count + 1 : count
  ), 0);
}

function tokenOverlap(taskTokens, phrases = []) {
  return phrases.reduce((count, phrase) => {
    const phraseTokens = new Set(splitTerms(phrase));
    return phraseTokens.size && [...phraseTokens].some((token) => taskTokens.has(token)) ? count + 1 : count;
  }, 0);
}

export function getPersonSkill(slug) {
  return PERSON_SKILLS[slug] || null;
}

export function getPersonSkillDocument(slug) {
  return PERSON_SKILL_DOCS[slug] || null;
}

export function hasPersonSkill(slug) {
  return Boolean(getPersonSkill(slug));
}

export function hasPersonSkillDocument(slug) {
  return Boolean(getPersonSkillDocument(slug));
}

export function getSkillScoreList(skill, keys = ['activity', 'leadership', 'rigor', 'initiative', 'riskTolerance']) {
  if (!skill) return [];
  return keys.map((key) => {
    const dimension = PERSONALITY_DIMENSIONS.find((item) => item.key === key);
    return {
      key,
      label: dimension?.label || key,
      zh: dimension?.zh || key,
      value: skill.scores[key] || 0,
    };
  });
}

export function scoreSkillForTask(skill, taskText = '') {
  if (!skill) return 0;
  const text = normalizeText(taskText);
  const tokens = new Set(splitTerms(taskText));
  const keywordHits = phraseHitCount(text, skill.keywords) + tokenOverlap(tokens, skill.keywords);
  const bestForHits = phraseHitCount(text, skill.bestFor) + tokenOverlap(tokens, skill.bestFor);
  const misfitHits = phraseHitCount(text, skill.notFor) + tokenOverlap(tokens, skill.notFor);
  let value = keywordHits * 10 + bestForHits * 18 - misfitHits * 14;
  value += skill.scores.initiative * 0.1;
  value += skill.scores.activity * 0.05;
  if (/验证|风险|证据|安全|复核|准确|审计|评估/.test(text)) value += skill.scores.rigor * 0.16;
  if (/快|今天|立刻|紧急|上线|发布|冲刺/.test(text)) value += skill.scores.activity * 0.08;
  if (/冲突|争议|协同|团队|共识/.test(text)) value += skill.scores.collaboration * 0.1 + skill.scores.leadership * 0.08;
  if (/创新|从0到1|原型|突破/.test(text)) value += skill.scores.creativity * 0.1 + skill.scores.riskTolerance * 0.08;
  return Math.round(value);
}

export function rankSkillsForTask(slugs, taskText = '') {
  return slugs
    .map((slug) => getPersonSkill(slug))
    .filter(Boolean)
    .map((skill) => ({ skill, score: scoreSkillForTask(skill, taskText) }))
    .sort((a, b) => b.score - a.score);
}

export function rankSpeakers(slugs, context = {}) {
  const text = normalizeText(`${context.topic || ''} ${context.phase || ''}`);
  return slugs
    .map((slug) => getPersonSkill(slug))
    .filter(Boolean)
    .map((skill) => {
      let score = skill.scores.activity * 0.42 + skill.scores.initiative * 0.28 + skill.scores.leadership * 0.2;
      if (/冲突|反对|争议/.test(text)) score += skill.scores.leadership * 0.18 + skill.scores.skepticism * 0.12;
      if (/风险|验证|证据|复核/.test(text)) score += skill.scores.rigor * 0.22;
      if (/紧急|立刻|发布|上线/.test(text)) score += skill.scores.riskTolerance * 0.18 + skill.scores.activity * 0.12;
      return { skill, score: Math.round(score) };
    })
    .sort((a, b) => b.score - a.score);
}

function chooseSceneRule(skill, taskText = '') {
  const text = normalizeText(taskText);
  if (/不清楚|模糊|不知道|怎么做|怎么开始/.test(text)) return skill.sceneRules.unclearRequest;
  if (/冲突|争议|不同意|对齐|共识/.test(text)) return skill.sceneRules.conflict;
  if (/今天|立刻|紧急|上线|发布|截止|deadline/.test(text)) return skill.sceneRules.urgentDeadline;
  if (/风险|验证|证据|安全|复核|失败|不确定/.test(text)) return skill.sceneRules.riskFound;
  return skill.sceneRules.taskFits;
}

function chooseFocusLabel(skill, taskText = '', intent = {}) {
  const text = normalizeText(taskText);
  if (intent.target) return intent.target;
  if (/风险|验证|证据|安全|复核|失败|不确定/.test(text)) return '风险复核';
  if (/今天|立刻|紧急|上线|发布|截止|deadline/.test(text)) return '推进节奏';
  if (/体验|设计|界面|用户|产品|品牌/.test(text)) return '体验判断';
  if (/市场|竞争|定位|增长|价格|商业/.test(text)) return '策略判断';
  if (/技术|工程|架构|系统|原型|代码/.test(text)) return '工程路径';
  if (/冲突|争议|团队|协同|共识/.test(text)) return '共识治理';
  return skill.bestFor[0] || '任务判断';
}

function choosePrinciple(skill, taskText = '') {
  const text = normalizeText(taskText);
  return skill.principles.find((principle) => fuzzyPhraseMatch(text, principle))
    || skill.principles.find((principle) => /先|优先|必须|不要|验证|目标/.test(principle))
    || skill.principles[0];
}

export function buildSkillRoomReply(slug, taskText = '', intent = {}) {
  const skill = getPersonSkill(slug);
  if (!skill) return '';
  const focus = chooseFocusLabel(skill, taskText, intent);
  const principle = choosePrinciple(skill, taskText);
  const sceneRule = chooseSceneRule(skill, taskText);
  const format = skill.defaultFormat.slice(0, 3).join(' → ');
  return `「${skill.motto}」——我先接 ${focus}。${principle}${sceneRule ? ` ${sceneRule}` : ''} 下一步按「${format}」收口。`;
}

export function describeSkillIntent(slug, taskText = '', plan = {}) {
  const skill = getPersonSkill(slug);
  if (!skill) return null;
  if (plan.lead?.slug === slug) return '主责推进';
  if (plan.reviewer?.slug === slug) return '风险复核';
  return chooseFocusLabel(skill, taskText);
}

function extractSection(markdown, ...titles) {
  if (!markdown) return '';
  const lines = markdown.split('\n');
  let start = -1;
  let level = 2;
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].startsWith('#')) continue;
    const heading = lines[i].replace(/^#+\s*/, '').trim();
    if (titles.some((title) => heading.includes(title))) {
      start = i;
      level = lines[i].match(/^#+/)?.[0].length || 1;
      break;
    }
  }
  if (start === -1) return '';
  const collected = [lines[start]];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith('#')) {
      const currentLevel = lines[i].match(/^#+/)?.[0].length || 1;
      if (currentLevel <= level) break;
    }
    collected.push(lines[i]);
  }
  return collected.join('\n').trim();
}

export function buildPersonActingBrief(slug, taskText = '', context = {}) {
  const skill = getPersonSkill(slug);
  const doc = getPersonSkillDocument(slug);
  if (!skill) return '';

  const taskLine = `当前任务：${taskText || '等待任务'}`;
  const phaseLine = context.phase ? `当前阶段：${context.phase}` : '';

  if (doc) {
    const roleplay = extractSection(doc, '角色扮演规则', '使用说明');
    const agentic = extractSection(doc, '回答工作流', 'Agentic Protocol');
    const models = extractSection(doc, '核心心智模型');
    const modelBlock = models ? models.split('---').slice(0, 2).join('\n') : '';
    return [roleplay, agentic, modelBlock, taskLine, phaseLine].filter(Boolean).join('\n\n');
  }

  return buildPersonPrompt(slug, taskText, context);
}

export function buildPersonPrompt(slug, taskText = '', context = {}) {
  const skill = getPersonSkill(slug);
  if (!skill) return '';

  const taskLine = `当前任务：${taskText || '等待任务'}`;
  const phaseLine = context.phase ? `当前阶段：${context.phase}` : '';
  const doc = getPersonSkillDocument(slug);

  if (doc) {
    return [doc, '', taskLine, phaseLine].filter(Boolean).join('\n');
  }

  return [
    skill.identity,
    '',
    `座右铭：${skill.motto}`,
    `人物介绍：${skill.intro}`,
    `代表成就：${skill.achievements.join('；')}`,
    `行事原则：${skill.principles.join('；')}`,
    `擅长：${skill.bestFor.join('、')}`,
    `不擅长：${skill.notFor.join('、')}`,
    `输出风格：${skill.style.join('、')}`,
    `默认输出格式：${skill.defaultFormat.join(' -> ')}`,
    '',
    taskLine,
    phaseLine,
  ].filter(Boolean).join('\n');
}

export function createRoundtablePlan(slugs, taskText = '') {
  const rankedForTask = rankSkillsForTask(slugs, taskText);
  const rankedSpeakers = rankSpeakers(slugs, { topic: taskText });
  return {
    lead: rankedForTask[0]?.skill || null,
    reviewer: rankedForTask.find(({ skill }) => skill.scores.rigor >= 85)?.skill || rankedForTask[1]?.skill || null,
    firstSpeakers: rankedSpeakers.slice(0, 3).map(({ skill }) => skill),
    taskMatches: rankedForTask,
  };
}

export function buildDossierProfileFromSkill(agent) {
  const skill = getPersonSkill(agent.id);
  if (!skill) return null;

  const meta = skill.skillMeta || {};
  const doc = getPersonSkillDocument(agent.id);

  return {
    skill,
    scores: getSkillScoreList(skill),
    strength: skill.bestFor.join(' / '),
    advice: skill.sceneRules.taskFits,
    summary: meta.preview || skill.intro,
    codename: `${agent.category.toUpperCase()} / ${skill.role.toUpperCase()} / SKILL v${PERSON_SKILL_VERSION}`,
    motto: skill.motto,
    notFor: skill.notFor.join(' / '),
    skillLoaded: Boolean(doc),
    skillStats: meta.modelCount
      ? `${meta.modelCount} 心智模型 · ${meta.lineCount || '—'} 行 · ${meta.quality === 'imported' ? '深度蒸馏' : '框架生成'}`
      : doc
        ? '完整 SKILL 已加载'
        : '仅结构化注册表',
    skillPath: meta.path || `personas/${agent.id}/SKILL.md`,
  };
}
