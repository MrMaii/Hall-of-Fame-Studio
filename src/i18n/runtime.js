import { en } from './locales/en.js';
import { zh } from './locales/zh.js';

export const SUPPORTED_LANGUAGES = ['zh', 'en'];
export const DEFAULT_LANGUAGE = 'zh';
export const LANGUAGE_STORAGE_KEY = 'hall_of_fame_studio.language.v1';

export const dictionaries = { zh, en };

export function normalizeLanguage(value) {
  return SUPPORTED_LANGUAGES.includes(value) ? value : DEFAULT_LANGUAGE;
}

function getByPath(object, path) {
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((current, key) => (current && current[key] != null ? current[key] : undefined), object);
}

export function createTranslator(language = DEFAULT_LANGUAGE) {
  const normalizedLanguage = normalizeLanguage(language);
  const dictionary = dictionaries[normalizedLanguage] || dictionaries[DEFAULT_LANGUAGE];
  const fallback = dictionaries.en;

  return (key, params = {}) => {
    const template = getByPath(dictionary, key) ?? getByPath(fallback, key) ?? key;
    if (typeof template !== 'string') return template;
    return template.replace(/\{(\w+)\}/g, (match, paramKey) => (
      params[paramKey] == null ? match : String(params[paramKey])
    ));
  };
}

export function resolveProjectLanguage(project, globalLanguage = DEFAULT_LANGUAGE) {
  return normalizeLanguage(project?.language || globalLanguage);
}

// Perf-critical: localizeText runs for every localized string of every backend
// read model. Building and sorting the ~1600-entry phrase map (and compiling
// word-boundary regexes) on every call made read-model localization
// quadratic-slow, so both are memoized per language / per phrase (BUG-008).
const phraseMapCache = new Map();
const phraseIndexCache = new Map();

function phraseMapFor(language) {
  const normalizedLanguage = normalizeLanguage(language);
  let cached = phraseMapCache.get(normalizedLanguage);
  if (!cached) {
    const phrases = dictionaries[normalizedLanguage]?.display?.phrases || {};
    cached = new Map(Object.entries(phrases).sort((a, b) => b[0].length - a[0].length));
    phraseMapCache.set(normalizedLanguage, cached);
  }
  return cached;
}

function phraseCandidatesFor(text, language) {
  const normalizedLanguage = normalizeLanguage(language);
  if (normalizedLanguage === 'en') return [...phraseMapFor(normalizedLanguage).entries()];
  let index = phraseIndexCache.get(normalizedLanguage);
  if (!index) {
    index = new Map();
    phraseMapFor(normalizedLanguage).forEach((localized, source) => {
      const words = source.match(/[A-Za-z][A-Za-z0-9_-]*/g) || [];
      const key = words.sort((a, b) => b.length - a.length)[0]?.toLowerCase();
      if (!key) return;
      const rows = index.get(key) || [];
      rows.push([source, localized]);
      index.set(key, rows);
    });
    phraseIndexCache.set(normalizedLanguage, index);
  }
  const candidates = new Map();
  (text.match(/[A-Za-z][A-Za-z0-9_-]*/g) || []).forEach((word) => {
    (index.get(word.toLowerCase()) || []).forEach(([source, localized]) => candidates.set(source, localized));
  });
  return [...candidates.entries()].sort((a, b) => b[0].length - a[0].length);
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const wordPhraseRegexCache = new Map();

function wordPhraseRegexFor(source) {
  let cached = wordPhraseRegexCache.get(source);
  if (!cached) {
    cached = new RegExp(`(^|[^A-Za-z0-9_-])${escapeRegExp(source)}(?![A-Za-z0-9_-])`, 'gi');
    wordPhraseRegexCache.set(source, cached);
  }
  cached.lastIndex = 0;
  return cached;
}

function replacePhrase(text, source, localized) {
  if (source === 'Chat') {
    return text.replace(/\bChat\b/g, (match, offset, fullText) => (
      fullText.slice(Math.max(0, offset - 7), offset) === 'Google ' ? match : localized
    ));
  }
  if (/^[A-Za-z0-9_-]+$/.test(source)) {
    return text.replace(wordPhraseRegexFor(source), (match, prefix = '', offset, fullText) => {
      const nextCharacter = fullText[offset + match.length] || '';
      if (prefix === '/' || prefix === ':' || nextCharacter === '/' || nextCharacter === ':') return match;
      return `${prefix}${localized}`;
    });
  }
  return text.split(source).join(localized);
}

export function localizeText(text = '', language = DEFAULT_LANGUAGE) {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (normalizeLanguage(language) === 'zh') {
    if (/^Manager demo (?:scene|scenario) loaded:/i.test(trimmed)) {
      return '经理演示场景已加载：立项、选举、分配、会议变更、谷歌聊天变更、全天候工作和时间线证据。';
    }
    const managerDemoBriefMatch = trimmed.match(/A manager-ready demo where agents clarify roles, campaign for leadership, assign work in chat, run continuously, and accept mid-project changes from Google Chat\. Output: polished end-to-end manager walkthrough with timeline (?:proof|evidence)\./i);
    if (managerDemoBriefMatch) {
      return localizeText(text.replace(managerDemoBriefMatch[0], '一个经理就绪演示：智能体澄清角色、竞选负责人、在聊天中分配工作、持续运行，并接收来自谷歌聊天的项目中途变更。产出为带时间线证据的完整经理演练。'), 'zh');
    }
    const settingsRevisionMatch = trimmed.match(/^Project settings revision (\d+) updated\b/i);
    if (settingsRevisionMatch) {
      return `项目设置修订 ${settingsRevisionMatch[1]} 已更新。`;
    }
    const managementResponseMatch = trimmed.match(/^(.+?) responded to (.+?)(?:'s|’s) management signal and folded it into the current Agent work pulse\.$/i);
    if (managementResponseMatch) {
      return `${localizeText(managementResponseMatch[1], 'zh')} 已回应 ${localizeText(managementResponseMatch[2], 'zh')} 的管理信号，并将其纳入当前智能体工作脉冲。`;
    }
    const peerCheckInMatch = trimmed.match(/^(.+?) sent a peer-management check-in to (.+?) from an independent Agent worker pulse\.$/i);
    if (peerCheckInMatch) {
      return `${localizeText(peerCheckInMatch[1], 'zh')} 通过独立智能体工作器脉冲向 ${localizeText(peerCheckInMatch[2], 'zh')} 发送了同级管理检查。`;
    }
    const managementCheckInMatch = trimmed.match(/^(.+?) sent a management check-in to (.+?) from an independent Agent worker pulse\.$/i);
    if (managementCheckInMatch) {
      return `${localizeText(managementCheckInMatch[1], 'zh')} 通过独立智能体工作器脉冲向 ${localizeText(managementCheckInMatch[2], 'zh')} 发送了管理检查。`;
    }
    const assignmentMatch = trimmed.match(/^@(.+?) please take ownership of "([\s\S]+?)"\. Report progress in the work stream and push every meaningful update to the timeline\.$/i);
    if (assignmentMatch) {
      return `@${localizeText(assignmentMatch[1], 'zh')} 请负责“${assignmentMatch[2]}”。请在工作流中汇报进展，并把每项重要更新发布到时间线。`;
    }
    const assignmentReceiptMatch = trimmed.match(/^Received @(.+?)\. I own "([\s\S]+?)" and I am starting work now\. I will publish progress to the timeline\.$/i);
    if (assignmentReceiptMatch) {
      return `已收到 @${localizeText(assignmentReceiptMatch[1], 'zh')} 的分配。我负责“${assignmentReceiptMatch[2]}”，现在开始工作，并会把进展发布到时间线。`;
    }
    const dependencyHelpMatch = trimmed.match(/^(.+?) needs dependency help from @(.+?) review the (.+)$/i);
    if (dependencyHelpMatch) {
      return `${localizeText(dependencyHelpMatch[1], 'zh')} 需要 @${localizeText(dependencyHelpMatch[2], 'zh')} 协助复核${localizeText(dependencyHelpMatch[3], 'zh')}。`;
    }
    const workProgressMatch = trimmed.match(/^(.+?) advanced "([\s\S]+?)" through (.+?) and published (.+?) progress\.$/i);
    if (workProgressMatch) {
      return `${localizeText(workProgressMatch[1], 'zh')} 通过${localizeText(workProgressMatch[3], 'zh')}推进了“${workProgressMatch[2]}”，并发布了${localizeText(workProgressMatch[4], 'zh')}进展。`;
    }
  }
  const phrases = phraseMapFor(language);
  if (phrases.has(trimmed)) return text.replace(trimmed, phrases.get(trimmed));
  if (normalizeLanguage(language) === 'zh' && !/[A-Za-z]/.test(text)) return text;
  if (normalizeLanguage(language) === 'en' && !/[\u3400-\u9fff]/.test(text)) return text;
  let next = text;
  phraseCandidatesFor(next, language).forEach(([source, localized]) => {
    const containsSource = next.includes(source)
      || (/^[A-Za-z0-9_-]+$/.test(source) && next.toLowerCase().includes(source.toLowerCase()));
    if (containsSource) next = replacePhrase(next, source, localized);
  });
  return next;
}

const STRICT_VISIBLE_ZH = new Map([
  ['Project snapshot has backend catalog, initiation, or receipt evidence', '项目快照包含后台目录、立项或回执证据'],
  ['Backend timeline read model', '后台时间线读取模型'],
  ['Agent Runs', '智能体运行'],
  ['Backend Agent run model', '后台智能体运行模型'],
  ['Kickoff Generation Source', '立项生成来源'],
  ['Provider-backed kickoff meeting', '服务商支持的立项会议'],
  ['Provider-backed kickoff meeting / model-provider-backed', '服务商支持的立项会议 / 模型服务商支持'],
  ['provider-backed model', '服务商支持模型'],
  ['model-provider-backed', '模型服务商支持'],
  ['Provider-backed kickoff generation still requires production provider controls, eval policy, incident handling, and managed audit storage.', '服务商支持的立项生成仍需要生产服务商控制、评估策略、事件处理和受管审计存储。'],
  ['reading-chat', '阅读聊天'],
  ['completed-task', '已完成任务'],
  ['needs-evidence', '需要证据'],
  ['Submit completed work as an Agent artifact node.', '把已完成工作提交为智能体产物节点。'],
  ['Let candidates campaign, then confirm the Leader marker.', '让候选人进行竞选，然后确认负责人标记。'],
  ['Confirm next actions and start fixed Agent routines.', '确认下一步行动并启动固定智能体例行程序。'],
  ['Ask the Leader to @assign work and have the assignee start immediately.', '要求负责人分配工作，并让受派人立即开始。'],
  ['Confirm work progress reaches the big timeline while chat stays inspectable.', '确认工作进展进入主时间线，同时保持聊天记录可检查。'],
  ['Broadcast a new feature request through the meeting path and Google Chat.', '通过会议路径和谷歌聊天广播新的功能请求。'],
  ['Verify agents discussed the change and the responsible Leader confirmed it.', '验证智能体已讨论该变更，并且对应负责人已确认。'],
  ['Run or inspect peer-management check-ins so agents manage each other continuously.', '运行或检查同级管理同步，让智能体持续相互管理。'],
  ['Runnable actions:', '可运行操作：'],
  ['Manager route:', '经理路由：'],
  ['Run route:', '运行路由：'],
]);

function stripVisibleTechnicalTokens(value = '') {
  return String(value || '')
    .replace(/https?:\/\/[^\s）)]+/gi, ' ')
    .replace(/[A-Za-z]:\\[^\s]+/g, ' ')
    .replace(/\/[A-Za-z0-9_.:@?=&%/-]+/g, ' ')
    .replace(/\b(?:AI|API|BYOK|CLI|CORS|CSS|HTML|HTTP|HTTPS|ID|JSON|JWT|LLM|MCP|OAuth|SDK|SQL|UI|URL|UX|OpenAI|Anthropic|Claude|Gemini|Stepfun|DeepSeek|Qwen|Ollama|Llama|Kimi|LM\s+Studio|Node(?:\.js)?|Vite|React|Tailwind|Lucide|npm|pnpm|yarn)\b/gi, ' ')
    .replace(/\b[A-Za-z]*\d[A-Za-z0-9._:/-]*\b/g, ' ')
    .replace(/\b[A-Za-z][A-Za-z0-9]*(?:[._:/][A-Za-z0-9]+)+\b/g, ' ');
}

function containsVisibleNaturalEnglish(value = '') {
  return /[A-Za-z]{2,}/.test(stripVisibleTechnicalTokens(value));
}

function isVisibleTechnicalText(value = '') {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i.test(text)) return true;
  if (/^(?:https?:\/\/|\/[A-Za-z0-9_.:@?=&%/-]+$|[A-Za-z]:\\)/i.test(text)) return true;
  if (/^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+$/.test(text)) return true;
  if (/[㐀-鿿]/.test(text) && /[A-Za-z]/.test(text) && !containsVisibleNaturalEnglish(text)) return true;
  if (/^(?:AI|API|BYOK|CLI|CORS|CSS|HTML|HTTP|HTTPS|ID|JSON|JWT|LLM|MCP|OAuth|SDK|SQL|UI|URL|UX|OpenAI|Anthropic|Claude|Gemini|Stepfun|DeepSeek|Qwen|Ollama|Llama|Kimi|LM Studio|Node\.js|Vite|React|Tailwind|Lucide|npm|pnpm|yarn)$/i.test(text)) return true;
  if (/^[{[]/.test(text)) {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function strictVisibleChineseFallback(source = '', localized = '') {
  const trimmed = String(source || '').trim();
  if (STRICT_VISIBLE_ZH.has(trimmed)) return STRICT_VISIBLE_ZH.get(trimmed);

  const nextPulse = trimmed.match(/^Let (.+?) coordinate the next execution pulse while (.+?) keeps the first evidence report current\.(?: Current output target: (.+)\.)?$/i);
  if (nextPulse) {
    const target = nextPulse[3] ? ` 当前产出目标：${nextPulse[3]}。` : '';
    return `由${localizeText(nextPulse[1], 'zh')}协调下一轮执行，${localizeText(nextPulse[2], 'zh')}维护首份证据报告。${target}`;
  }

  const peerCheckIn = trimmed.match(/^(.+?): @(.+?) peer-management check-in from my Agent pulse\. Keep "(.+?)" moving and post the next evidence marker\.$/i);
  if (peerCheckIn) {
    const dependency = localizeText(peerCheckIn[3], 'zh');
    return `${localizeText(peerCheckIn[1], 'zh')}向 @${localizeText(peerCheckIn[2], 'zh')} 发起同级管理检查：继续推进“${/[A-Za-z]{2,}/.test(dependency) ? '协作依赖' : dependency}”，并发布下一项证据标记。`;
  }

  const managementEvidence = trimmed.match(/^(\d+) management evidence logs$/i);
  if (managementEvidence) return `${managementEvidence[1]} 条管理证据日志`;

  let next = String(localized || '')
    .replace(/(\d+) management inbox signals/gi, '$1 条管理收件箱信号')
    .replace(/\bmanaged by\b/gi, '由')
    .replace(/\bRunnable actions\b/gi, '可运行操作')
    .replace(/\bManager route\b/gi, '经理路由')
    .replace(/\bRun route\b/gi, '运行路由');
  if (!/[A-Za-z]{2,}/.test(next)) return next;

  if (/route/i.test(trimmed)) return '系统路由';
  if (/snapshot/i.test(trimmed)) return '项目快照来源';
  if (/read model/i.test(trimmed)) return '后台读取模型';
  if (/meeting/i.test(trimmed)) return '会议记录';
  if (/evidence/i.test(trimmed)) return '证据记录';
  if (/manager|management|peer-management/i.test(trimmed)) return '管理记录';
  if (/agent|work|task|run|execution/i.test(trimmed)) return '智能体运行记录';
  if (/project|kickoff/i.test(trimmed)) return '项目记录';
  return '系统记录';
}

export function localizeVisibleSystemText(text = '', language = DEFAULT_LANGUAGE) {
  if (!text || typeof text !== 'string') return text;
  const currentLanguage = normalizeLanguage(language);
  if (currentLanguage === 'zh') {
    const jsonStart = text.indexOf('{');
    if (jsonStart > 0) {
      const jsonText = text.slice(jsonStart).trim();
      try {
        JSON.parse(jsonText);
        const prefix = text.slice(0, jsonStart);
        return `${localizeVisibleSystemText(prefix, currentLanguage)}${jsonText}`;
      } catch {
        // Continue through ordinary natural-language localization.
      }
    }
  }
  if (currentLanguage !== 'zh' || isVisibleTechnicalText(text)) return localizeText(text, currentLanguage);
  const localized = localizeText(text, currentLanguage);
  return containsVisibleNaturalEnglish(localized)
    ? strictVisibleChineseFallback(text, localized)
    : localized;
}
