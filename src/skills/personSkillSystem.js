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

export const PROFESSIONAL_SKILLS = {
  market_research: {
    id: 'market_research',
    label: 'Market Research',
    zh: '市场调研',
    keywords: ['market', 'research', 'customer', 'segment', 'demand', 'pain', 'survey', '市场', '调研', '客户', '用户', '需求', '痛点', '人群'],
    process: ['define the buying context', 'map segments and jobs-to-be-done', 'separate stated pain from paid pain', 'identify market structure and willingness to pay'],
  },
  user_interview: {
    id: 'user_interview',
    label: 'User Interview',
    zh: '用户访谈',
    keywords: ['interview', 'user', 'persona', 'behavior', 'motivation', 'friction', '访谈', '用户', '行为', '动机', '摩擦', '画像'],
    process: ['select target users', 'ask behavior-first questions', 'capture anxieties and workarounds', 'turn patterns into product requirements'],
  },
  product_design: {
    id: 'product_design',
    label: 'Product Design',
    zh: '产品设计',
    keywords: ['product', 'design', 'ux', 'feature', 'flow', 'prototype', '产品', '设计', '体验', '功能', '原型', '流程'],
    process: ['define the user promise', 'reduce the core flow', 'choose interaction states', 'spec the smallest valuable artifact'],
  },
  business_analysis: {
    id: 'business_analysis',
    label: 'Business Analysis',
    zh: '商业分析',
    keywords: ['business', 'model', 'revenue', 'pricing', 'moat', 'margin', '商业', '模式', '收入', '定价', '护城河', '利润'],
    process: ['describe value creation', 'test revenue mechanics', 'assess advantage durability', 'compare upside against opportunity cost'],
  },
  engineering_breakdown: {
    id: 'engineering_breakdown',
    label: 'Engineering Breakdown',
    zh: '工程拆解',
    keywords: ['engineer', 'architecture', 'system', 'code', 'api', 'backend', 'frontend', '工程', '架构', '系统', '代码', '接口', '后端', '前端'],
    process: ['decompose system boundaries', 'name state and interfaces', 'identify constraints and failure modes', 'sequence implementation checkpoints'],
  },
  brand_story: {
    id: 'brand_story',
    label: 'Brand Story',
    zh: '品牌叙事',
    keywords: ['brand', 'story', 'positioning', 'naming', 'launch', 'message', '品牌', '叙事', '定位', '命名', '发布', '文案'],
    process: ['choose the cultural tension', 'name the promise', 'compress the message', 'design the symbols and launch moment'],
  },
  risk_review: {
    id: 'risk_review',
    label: 'Risk Review',
    zh: '风险审查',
    keywords: ['risk', 'review', 'security', 'evidence', 'audit', 'failure', '风险', '复核', '安全', '证据', '审查', '失败'],
    process: ['state the acceptance bar', 'list failure paths', 'require evidence for claims', 'assign mitigations and verification'],
  },
  growth_strategy: {
    id: 'growth_strategy',
    label: 'Growth Strategy',
    zh: '增长策略',
    keywords: ['growth', 'go-to-market', 'sales', 'distribution', 'acquisition', 'retention', '增长', '获客', '渠道', '销售', '留存', '转化'],
    process: ['identify the growth loop', 'choose a beachhead segment', 'define acquisition channels', 'measure activation and retention'],
  },
  competitor_analysis: {
    id: 'competitor_analysis',
    label: 'Competitor Analysis',
    zh: '竞品分析',
    keywords: ['competitor', 'alternative', 'category', 'benchmark', 'substitute', '竞品', '竞争', '替代品', '品类', '对标'],
    process: ['map existing alternatives', 'compare switching triggers', 'find underserved constraints', 'choose a defensible wedge'],
  },
  project_management: {
    id: 'project_management',
    label: 'Project Management',
    zh: '项目管理',
    keywords: ['project', 'deadline', 'owner', 'roadmap', 'task', 'delivery', '项目', '期限', '负责人', '路线图', '任务', '交付'],
    process: ['set the objective and constraints', 'assign owners and deadlines', 'surface dependencies', 'run evidence-based status checks'],
  },
  research_synthesis: {
    id: 'research_synthesis',
    label: 'Research Synthesis',
    zh: '研究综述',
    keywords: ['research', 'paper', 'evidence', 'synthesis', 'literature', 'study', '研究', '论文', '证据', '综述', '资料', '调研'],
    process: ['collect credible sources', 'separate signal from noise', 'extract mechanisms', 'state confidence and open questions'],
  },
  copywriting: {
    id: 'copywriting',
    label: 'Copywriting',
    zh: '文案写作',
    keywords: ['copy', 'writing', 'headline', 'landing', 'email', 'script', '文案', '写作', '标题', '落地页', '邮件', '脚本'],
    process: ['choose the reader and desired action', 'write the strongest promise', 'remove vague claims', 'shape cadence and proof'],
  },
};

const DEFAULT_PROFESSIONAL_SKILL_WEIGHTS = {
  market_research: 50,
  user_interview: 50,
  product_design: 50,
  business_analysis: 50,
  engineering_breakdown: 50,
  brand_story: 50,
  risk_review: 50,
  growth_strategy: 50,
  competitor_analysis: 50,
  project_management: 50,
  research_synthesis: 50,
  copywriting: 50,
};

const PERSONA_CAPABILITY_MAP = {
  ada_lovelace: { edge: 'computational imagination and symbolic systems', signature: ['engineering_breakdown', 'research_synthesis', 'product_design'], weights: { engineering_breakdown: 92, research_synthesis: 84, product_design: 78, brand_story: 72 } },
  amelia_earhart: { edge: 'frontier execution under uncertainty', signature: ['growth_strategy', 'project_management', 'brand_story'], weights: { growth_strategy: 86, project_management: 82, brand_story: 78, risk_review: 74 } },
  aristotle: { edge: 'classification, causality, and practical judgment', signature: ['research_synthesis', 'business_analysis', 'risk_review'], weights: { research_synthesis: 90, business_analysis: 82, risk_review: 80, product_design: 72 } },
  babbage: { edge: 'mechanical decomposition and programmable process', signature: ['engineering_breakdown', 'project_management', 'risk_review'], weights: { engineering_breakdown: 94, project_management: 82, risk_review: 78, business_analysis: 70 } },
  berners_lee: { edge: 'open network architecture and interoperable systems', signature: ['engineering_breakdown', 'product_design', 'growth_strategy'], weights: { engineering_breakdown: 92, product_design: 82, growth_strategy: 76, risk_review: 72 } },
  buffett: { edge: 'market insight, pain-to-value judgment, moats, and opportunity cost', signature: ['market_research', 'business_analysis', 'competitor_analysis'], weights: { market_research: 92, business_analysis: 96, competitor_analysis: 88, risk_review: 86, growth_strategy: 72 } },
  carnegie: { edge: 'relationship-driven selling and influence systems', signature: ['growth_strategy', 'user_interview', 'copywriting'], weights: { growth_strategy: 88, user_interview: 86, copywriting: 80, brand_story: 78 } },
  carson: { edge: 'public evidence, ecological risk, and patient persuasion', signature: ['research_synthesis', 'risk_review', 'copywriting'], weights: { research_synthesis: 94, risk_review: 92, copywriting: 82, brand_story: 74 } },
  chanel: { edge: 'taste, identity, symbols, and desire compression', signature: ['brand_story', 'product_design', 'copywriting'], weights: { brand_story: 96, product_design: 90, copywriting: 84, market_research: 72 } },
  confucius: { edge: 'roles, ritual, ethics, and durable social coordination', signature: ['project_management', 'user_interview', 'risk_review'], weights: { project_management: 86, user_interview: 80, risk_review: 78, brand_story: 70 } },
  curie: { edge: 'experimental rigor and evidence discipline', signature: ['research_synthesis', 'risk_review', 'engineering_breakdown'], weights: { research_synthesis: 96, risk_review: 92, engineering_breakdown: 82, product_design: 66 } },
  da_vinci: { edge: 'cross-domain invention and observational design', signature: ['product_design', 'engineering_breakdown', 'brand_story'], weights: { product_design: 94, engineering_breakdown: 88, brand_story: 82, research_synthesis: 80 } },
  deming: { edge: 'quality systems, process control, and continuous improvement', signature: ['project_management', 'risk_review', 'business_analysis'], weights: { project_management: 94, risk_review: 90, business_analysis: 84, user_interview: 72 } },
  drucker: { edge: 'management diagnosis, objectives, and responsibility design', signature: ['project_management', 'business_analysis', 'market_research'], weights: { project_management: 96, business_analysis: 90, market_research: 82, growth_strategy: 78 } },
  edison: { edge: 'rapid invention, commercialization, and lab execution', signature: ['product_design', 'engineering_breakdown', 'growth_strategy'], weights: { product_design: 88, engineering_breakdown: 86, growth_strategy: 82, project_management: 78 } },
  einstein: { edge: 'first-principles modeling and simplifying deep structure', signature: ['research_synthesis', 'engineering_breakdown', 'risk_review'], weights: { research_synthesis: 96, engineering_breakdown: 88, risk_review: 80, product_design: 72 } },
  feynman: { edge: 'clear explanation, concept testing, and anti-confusion', signature: ['research_synthesis', 'copywriting', 'user_interview'], weights: { research_synthesis: 92, copywriting: 86, user_interview: 82, risk_review: 78 } },
  goodall: { edge: 'field observation, empathy, and behavioral pattern discovery', signature: ['user_interview', 'market_research', 'research_synthesis'], weights: { user_interview: 96, market_research: 88, research_synthesis: 84, brand_story: 72 } },
  hopper_legacy: { edge: 'developer usability, language design, and execution pragmatism', signature: ['engineering_breakdown', 'product_design', 'copywriting'], weights: { engineering_breakdown: 92, product_design: 86, copywriting: 78, project_management: 76 } },
  ibn_khaldun: { edge: 'civilizational cycles, institutions, and market sociology', signature: ['market_research', 'business_analysis', 'competitor_analysis'], weights: { market_research: 90, business_analysis: 88, competitor_analysis: 84, research_synthesis: 82 } },
  jobs: { edge: 'end-to-end product experience, taste, and launch narrative', signature: ['product_design', 'brand_story', 'copywriting'], weights: { product_design: 98, brand_story: 96, copywriting: 88, growth_strategy: 80, market_research: 72 } },
  john_snow: { edge: 'causal investigation, field evidence, and public-health mapping', signature: ['research_synthesis', 'market_research', 'risk_review'], weights: { research_synthesis: 94, market_research: 86, risk_review: 90, engineering_breakdown: 74 } },
  kahneman: { edge: 'behavioral bias detection and decision quality', signature: ['user_interview', 'risk_review', 'market_research'], weights: { user_interview: 90, risk_review: 94, market_research: 84, copywriting: 72 } },
  lincoln: { edge: 'coalition building, moral framing, and conflict resolution', signature: ['project_management', 'brand_story', 'copywriting'], weights: { project_management: 88, brand_story: 86, copywriting: 82, user_interview: 78 } },
  mandela: { edge: 'reconciliation strategy, legitimacy, and long-horizon coalition work', signature: ['project_management', 'brand_story', 'risk_review'], weights: { project_management: 90, brand_story: 84, risk_review: 82, user_interview: 80 } },
  musk: { edge: 'first-principles engineering, urgency, and vertical integration', signature: ['engineering_breakdown', 'product_design', 'growth_strategy'], weights: { engineering_breakdown: 96, product_design: 88, growth_strategy: 86, risk_review: 74 } },
  nash: { edge: 'strategic incentives, equilibrium, and adversarial trade-offs', signature: ['business_analysis', 'competitor_analysis', 'risk_review'], weights: { business_analysis: 92, competitor_analysis: 94, risk_review: 86, growth_strategy: 76 } },
  nightingale: { edge: 'statistical evidence, operations, and humane systems', signature: ['risk_review', 'project_management', 'research_synthesis'], weights: { risk_review: 94, project_management: 90, research_synthesis: 88, user_interview: 78 } },
  noether: { edge: 'invariants, symmetry, and hidden structure', signature: ['engineering_breakdown', 'research_synthesis', 'risk_review'], weights: { engineering_breakdown: 90, research_synthesis: 94, risk_review: 82, product_design: 68 } },
  oprah: { edge: 'audience empathy, trust, and emotionally precise narrative', signature: ['user_interview', 'brand_story', 'copywriting'], weights: { user_interview: 94, brand_story: 92, copywriting: 88, growth_strategy: 78 } },
  ostrom: { edge: 'governance design, commons rules, and cooperative incentives', signature: ['project_management', 'business_analysis', 'risk_review'], weights: { project_management: 92, business_analysis: 86, risk_review: 84, user_interview: 78 } },
  ramanujan: { edge: 'pattern intuition and unconventional mathematical leaps', signature: ['research_synthesis', 'engineering_breakdown', 'product_design'], weights: { research_synthesis: 90, engineering_breakdown: 84, product_design: 76, risk_review: 70 } },
  shannon: { edge: 'information theory, signal/noise separation, and compression', signature: ['engineering_breakdown', 'research_synthesis', 'copywriting'], weights: { engineering_breakdown: 94, research_synthesis: 88, copywriting: 82, risk_review: 78 } },
  simon: { edge: 'bounded rationality, decision systems, and organizational design', signature: ['project_management', 'business_analysis', 'research_synthesis'], weights: { project_management: 90, business_analysis: 88, research_synthesis: 86, risk_review: 80 } },
  sun_tzu: { edge: 'competitive positioning, leverage, and indirect strategy', signature: ['competitor_analysis', 'growth_strategy', 'risk_review'], weights: { competitor_analysis: 96, growth_strategy: 88, risk_review: 84, market_research: 80 } },
  tesla: { edge: 'systems invention, energy transfer, and technical imagination', signature: ['engineering_breakdown', 'product_design', 'research_synthesis'], weights: { engineering_breakdown: 94, product_design: 86, research_synthesis: 82, brand_story: 72 } },
  toyoda: { edge: 'lean operations, root cause, and production discipline', signature: ['project_management', 'risk_review', 'engineering_breakdown'], weights: { project_management: 96, risk_review: 90, engineering_breakdown: 86, business_analysis: 78 } },
  turing: { edge: 'mechanism design, protocols, state, and verification', signature: ['engineering_breakdown', 'risk_review', 'research_synthesis'], weights: { engineering_breakdown: 98, risk_review: 88, research_synthesis: 86, product_design: 74 } },
  von_neumann: { edge: 'systems architecture, game theory, and formal strategy', signature: ['engineering_breakdown', 'business_analysis', 'competitor_analysis'], weights: { engineering_breakdown: 96, business_analysis: 90, competitor_analysis: 88, risk_review: 82 } },
  wangari_maathai: { edge: 'grassroots mobilization, environmental systems, and civic action', signature: ['growth_strategy', 'project_management', 'brand_story'], weights: { growth_strategy: 88, project_management: 86, brand_story: 82, risk_review: 78 } },
};

export function getProfessionalSkill(id) {
  return PROFESSIONAL_SKILLS[id] || null;
}

export function getPersonaCapabilityProfile(slug) {
  const profile = PERSONA_CAPABILITY_MAP[slug] || {};
  const weights = { ...DEFAULT_PROFESSIONAL_SKILL_WEIGHTS, ...(profile.weights || {}) };
  const signature = (profile.signature || Object.entries(weights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id))
    .map((id) => PROFESSIONAL_SKILLS[id])
    .filter(Boolean);
  return {
    edge: profile.edge || 'general-purpose judgment applied through reusable professional skills',
    signature,
    weights,
  };
}

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

function scoreProfessionalSkillForTask(professionalSkill, taskText = '') {
  const text = normalizeText(taskText);
  const tokens = new Set(splitTerms(taskText));
  const directHits = phraseHitCount(text, professionalSkill.keywords);
  const overlapHits = tokenOverlap(tokens, professionalSkill.keywords);
  const hasAnyText = text.trim().length > 0;
  return Math.round((directHits * 24) + (overlapHits * 10) + (hasAnyText ? 8 : 0));
}

export function inferProfessionalSkillsForTask(taskText = '', limit = 3) {
  const ranked = Object.values(PROFESSIONAL_SKILLS)
    .map((professionalSkill) => ({
      ...professionalSkill,
      matchScore: scoreProfessionalSkillForTask(professionalSkill, taskText),
    }))
    .sort((a, b) => b.matchScore - a.matchScore);
  const explicitMatches = ranked.filter((item) => item.matchScore > 8);
  return (explicitMatches.length ? explicitMatches : ranked).slice(0, limit);
}

export function buildPersonaSkillBlend(slug, taskText = '') {
  const capability = getPersonaCapabilityProfile(slug);
  const inferredSkills = inferProfessionalSkillsForTask(taskText, 4);
  const signatureIds = new Set(capability.signature.map((professionalSkill) => professionalSkill.id));
  const selected = inferredSkills
    .map((professionalSkill) => ({
      professionalSkill,
      affinity: capability.weights[professionalSkill.id] || 50,
      blendScore: Math.round(
        professionalSkill.matchScore * ((capability.weights[professionalSkill.id] || 50) / 100)
        + (signatureIds.has(professionalSkill.id) ? 10 : 0),
      ),
    }))
    .sort((a, b) => b.blendScore - a.blendScore)[0]
    || {
      professionalSkill: capability.signature[0] || Object.values(PROFESSIONAL_SKILLS)[0],
      affinity: 50,
      blendScore: 0,
    };

  return {
    edge: capability.edge,
    signatureSkills: capability.signature,
    selectedSkill: selected.professionalSkill,
    selectedAffinity: selected.affinity,
    selectedProcess: selected.professionalSkill.process,
    inferredSkills,
  };
}

export function buildPersonaProfessionalBrief(slug, taskText = '') {
  const blend = buildPersonaSkillBlend(slug, taskText);
  const signature = blend.signatureSkills.map((item) => item.label).join(', ');
  return [
    `Professional skill selected: ${blend.selectedSkill.label}`,
    `Persona real-world edge: ${blend.edge}`,
    `Reusable skill method: ${blend.selectedProcess.join(' -> ')}`,
    `Signature callable skills: ${signature}`,
    `Instruction: complete the assigned work by following the reusable professional method, then reshape priorities, trade-offs, objections, and final output through this persona's edge. Do not only imitate voice or style.`,
  ].join('\n');
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
  const capability = getPersonaCapabilityProfile(skill.slug);
  const professionalMatches = inferProfessionalSkillsForTask(taskText, 4);
  const professionalFit = professionalMatches.reduce((sum, professionalSkill) => {
    const affinity = capability.weights[professionalSkill.id] || 50;
    return sum + (professionalSkill.matchScore * affinity * 0.015);
  }, 0);
  const signatureHit = capability.signature.some((professionalSkill) => (
    phraseHitCount(text, professionalSkill.keywords) > 0 || tokenOverlap(tokens, professionalSkill.keywords) > 0
  )) ? 14 : 0;
  let value = keywordHits * 10 + bestForHits * 18 - misfitHits * 14;
  value += professionalFit + signatureHit;
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
  const blend = buildPersonaSkillBlend(slug, taskText);
  const professionalLabel = blend.selectedSkill.zh || blend.selectedSkill.label;
  const method = blend.selectedProcess.slice(0, 3).join(' -> ');
  const format = skill.defaultFormat.slice(0, 2).join(' -> ');
  return `「${skill.motto}」——我先接 ${focus}。${principle}${sceneRule ? ` ${sceneRule}` : ''} 我会调用「${professionalLabel}」方法：${method}，再用我的 ${blend.edge} 收口。下一步按「${format}」推进。`;
}

export function describeSkillIntent(slug, taskText = '', plan = {}) {
  const skill = getPersonSkill(slug);
  if (!skill) return null;
  if (plan.lead?.slug === slug) return '主责推进';
  if (plan.reviewer?.slug === slug) return '风险复核';
  const blend = buildPersonaSkillBlend(slug, taskText);
  return `${chooseFocusLabel(skill, taskText)} / ${blend.selectedSkill.zh || blend.selectedSkill.label}`;
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
  const professionalBrief = buildPersonaProfessionalBrief(slug, taskText);

  const taskLine = `当前任务：${taskText || '等待任务'}`;
  const phaseLine = context.phase ? `当前阶段：${context.phase}` : '';

  if (doc) {
    const roleplay = extractSection(doc, '角色扮演规则', '使用说明');
    const agentic = extractSection(doc, '回答工作流', 'Agentic Protocol');
    const models = extractSection(doc, '核心心智模型');
    const modelBlock = models ? models.split('---').slice(0, 2).join('\n') : '';
    return [roleplay, agentic, modelBlock, professionalBrief, taskLine, phaseLine].filter(Boolean).join('\n\n');
  }

  return buildPersonPrompt(slug, taskText, context);
}

export function buildPersonPrompt(slug, taskText = '', context = {}) {
  const skill = getPersonSkill(slug);
  if (!skill) return '';
  const professionalBrief = buildPersonaProfessionalBrief(slug, taskText);

  const taskLine = `当前任务：${taskText || '等待任务'}`;
  const phaseLine = context.phase ? `当前阶段：${context.phase}` : '';
  const doc = getPersonSkillDocument(slug);

  if (doc) {
    return [doc, '', professionalBrief, taskLine, phaseLine].filter(Boolean).join('\n');
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
    professionalBrief,
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
    professionalSkills: inferProfessionalSkillsForTask(taskText, 4),
    taskMatches: rankedForTask.map((match) => ({
      ...match,
      blend: buildPersonaSkillBlend(match.skill.slug, taskText),
    })),
  };
}

export function buildDossierProfileFromSkill(agent, language = 'zh') {
  const skill = getPersonSkill(agent.id);
  if (!skill) return null;

  const meta = skill.skillMeta || {};
  const doc = getPersonSkillDocument(agent.id);
  const capability = getPersonaCapabilityProfile(agent.id);
  const signatureSkills = capability.signature.map((item) => (language === 'zh' ? item.zh || item.label : item.label));

  return {
    skill,
    scores: getSkillScoreList(skill),
    strength: skill.bestFor.join(' / '),
    advice: skill.sceneRules.taskFits,
    summary: meta.preview || skill.intro,
    realWorldEdge: capability.edge,
    signatureSkills,
    professionalSkillRuntime: signatureSkills.join(' / '),
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
