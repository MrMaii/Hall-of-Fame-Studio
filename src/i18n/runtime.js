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

function phraseMapFor(language) {
  const phrases = dictionaries[normalizeLanguage(language)]?.display?.phrases || {};
  return new Map(Object.entries(phrases).sort((a, b) => b[0].length - a[0].length));
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replacePhrase(text, source, localized) {
  if (source === 'Chat') {
    return text.replace(/\bChat\b/g, (match, offset, fullText) => (
      fullText.slice(Math.max(0, offset - 7), offset) === 'Google ' ? match : localized
    ));
  }
  if (/^[A-Za-z0-9_-]+$/.test(source)) {
    return text.replace(new RegExp(`(^|[^A-Za-z0-9_-])${escapeRegExp(source)}(?![A-Za-z0-9_-])`, 'g'), (match, prefix = '') => `${prefix}${localized}`);
  }
  return text.split(source).join(localized);
}

export function localizeText(text = '', language = DEFAULT_LANGUAGE) {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  const phrases = phraseMapFor(language);
  if (phrases.has(trimmed)) {
    return text.replace(trimmed, phrases.get(trimmed));
  }
  let next = text;
  phrases.forEach((localized, source) => {
    if (next.includes(source)) next = replacePhrase(next, source, localized);
  });
  return next;
}
