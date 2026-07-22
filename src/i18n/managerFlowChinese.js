import { localizeText, normalizeLanguage } from './runtime.js';

const GRAPH_NATURAL_LANGUAGE_KEYS = new Set([
  'actionLabel',
  'agentName',
  'categoryLabel',
  'checklist',
  'commitMessage',
  'description',
  'detail',
  'displayTitle',
  'evidence',
  'evidencePlan',
  'expectedValue',
  'intent',
  'label',
  'managerMeaning',
  'managerQuestion',
  'outcome',
  'phase',
  'proof',
  'protocol',
  'reason',
  'relation',
  'role',
  'routineLabel',
  'semanticLabel',
  'sourceLabel',
  'submittedByAgentName',
  'summary',
  'text',
  'title',
  'typeLabel',
  'whyNow',
]);

function uniqueText(values = []) {
  return [...new Set(values
    .filter(value => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean))];
}

export function managerFlowUserAuthoredFragments(project = {}, messages = []) {
  const managerClarifications = project.initiation?.managerClarifications || [];
  const explicitDirectorMessages = (messages || []).filter(message => (
    message?.id === project.initiation?.directorBriefId
    || /^director_brief_/i.test(String(message?.id || ''))
    || /^meeting_.+_director_clarification_/i.test(String(message?.id || ''))
  ));

  return uniqueText([
    project.name,
    project.objective,
    project.currentObjective,
    project.initiation?.summary,
    ...managerClarifications.map(item => item?.text),
    ...explicitDirectorMessages.map(item => item?.text),
  ]);
}

function isStandaloneTechnicalValue(value = '') {
  const text = String(value || '').trim();
  return (
    /^https?:\/\//i.test(text)
    || /^\/[A-Za-z0-9_./:#?=&%-]+$/.test(text)
    || /^[A-Fa-f0-9]{12,}$/.test(text)
    || /^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+$/.test(text)
    || /^(?=[A-Za-z0-9_.:-]*\d)(?=[A-Za-z0-9_.:-]*[-_.:])[A-Za-z0-9_.:-]+$/.test(text)
    || /^[A-Za-z]+:\/\//.test(text)
  );
}

function containsNaturalEnglish(value = '') {
  return /[A-Za-z]{2,}/.test(String(value || ''));
}

export function localizeManagerFlowDisplayText(value, {
  language = 'zh',
  fallback = '系统记录',
  userAuthoredFragments = [],
} = {}) {
  if (typeof value !== 'string' || !value) return value;
  const currentLanguage = normalizeLanguage(language);
  if (currentLanguage !== 'zh') return localizeText(value, currentLanguage);

  const exactUserText = userAuthoredFragments.find(fragment => (
    typeof fragment === 'string' && fragment.trim() === value.trim()
  ));
  if (exactUserText) return value;
  if (isStandaloneTechnicalValue(value)) return value;

  const localized = localizeText(value, currentLanguage);
  if (!containsNaturalEnglish(localized)) return localized;

  const localizedFallback = localizeText(fallback, currentLanguage);
  return containsNaturalEnglish(localizedFallback) ? '系统记录' : localizedFallback;
}

function graphFallbackFor(key, context = {}) {
  const categoryLabel = localizeManagerFlowDisplayText(
    context.categoryLabel || context.category || '',
    { language: 'zh', fallback: '流程' },
  );
  const agentName = localizeManagerFlowDisplayText(
    context.agentName || '',
    { language: 'zh', fallback: '项目成员' },
  );
  switch (key) {
    case 'agentName':
    case 'submittedByAgentName': return '项目成员';
    case 'categoryLabel': return '流程';
    case 'description': return `此${categoryLabel}记录包含已提交的工作说明。`;
    case 'displayTitle': return '';
    case 'intent': return '智能体已提交此流程记录，等待经理复核。';
    case 'checklist': return '流程检查项';
    case 'evidencePlan': return '证据计划';
    case 'relation': return '关联';
    case 'role': return '项目成员';
    case 'routineLabel': return '智能体工作流程';
    case 'sourceLabel': return '后台流程图';
    case 'summary':
    case 'commitMessage': return `${agentName}的${categoryLabel}进展已记录。`;
    case 'title': return `${agentName}的${categoryLabel}记录`;
    case 'text': return '智能体动作';
    case 'whyNow': return '已记录本次发布理由。';
    default: return '流程记录';
  }
}

function localizeGraphValue(value, options, key = '', context = {}) {
  if (typeof value === 'string') {
    if (!GRAPH_NATURAL_LANGUAGE_KEYS.has(key)) return value;
    return localizeManagerFlowDisplayText(value, {
      ...options,
      fallback: graphFallbackFor(key, context),
    });
  }
  if (Array.isArray(value)) {
    return value.map(item => localizeGraphValue(item, options, key, context));
  }
  if (!value || typeof value !== 'object') return value;

  const nextContext = value.id && value.category ? value : context;
  const localized = Object.fromEntries(Object.entries(value).map(([childKey, item]) => [
    childKey,
    localizeGraphValue(item, options, childKey, nextContext),
  ]));

  if (value.id && value.category) {
    const categoryLabel = localized.categoryLabel || localizeManagerFlowDisplayText(value.category, {
      ...options,
      fallback: '流程',
    });
    localized.subtypeLabel = localizeManagerFlowDisplayText(value.subtype || '', {
      ...options,
      fallback: `${categoryLabel}记录`,
    });
    localized.statusLabel = localizeManagerFlowDisplayText(value.status || '', {
      ...options,
      fallback: '已记录',
    });
    localized.importanceLabel = localizeManagerFlowDisplayText(value.importance || '', {
      ...options,
      fallback: '普通',
    });
  }

  return localized;
}

export function localizeManagerFlowGraphReadModel(graph, {
  language = 'zh',
  userAuthoredFragments = [],
} = {}) {
  const currentLanguage = normalizeLanguage(language);
  if (currentLanguage !== 'zh') return graph;
  return localizeGraphValue(graph, {
    language: currentLanguage,
    userAuthoredFragments: uniqueText(userAuthoredFragments),
  });
}
