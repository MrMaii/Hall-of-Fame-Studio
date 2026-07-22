const CHINESE_TEXT = /[\u3400-\u9fff]/;
const LATIN_PROSE = /[A-Za-z]{3,}/;

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function normalizeModelOutputLanguage(language = 'en') {
  return String(language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function modelOutputLanguageInstruction(language = 'en') {
  return normalizeModelOutputLanguage(language) === 'zh'
    ? 'LANGUAGE CONTRACT: Write every user-visible natural-language value in Simplified Chinese only. Do not mix in English prose. Keep only required protocol identifiers, URLs, code symbols, and proper names unchanged.'
    : 'LANGUAGE CONTRACT: Write every user-visible natural-language value in English only. Do not include Chinese prose. Keep only required protocol identifiers, URLs, code symbols, and proper names unchanged.';
}

export function modelOutputMatchesLanguage({ text = '', language = 'en', allowedTerms = [] } = {}) {
  const normalizedLanguage = normalizeModelOutputLanguage(language);
  let naturalText = String(text || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\[[A-Za-z0-9_.:/-]+\]/g, ' ')
    .replace(/\b[A-Z][A-Z0-9-]{1,}\b/g, ' ');
  for (const term of allowedTerms.filter(Boolean).sort((a, b) => String(b).length - String(a).length)) {
    naturalText = naturalText.replace(new RegExp(escapeRegExp(term), 'gi'), ' ');
  }
  return normalizedLanguage === 'zh'
    ? !LATIN_PROSE.test(naturalText)
    : !CHINESE_TEXT.test(naturalText);
}
