import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  createTranslator,
  localizeText,
  normalizeLanguage,
} from './runtime.js';

export {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  createTranslator,
  localizeText,
  normalizeLanguage,
} from './runtime.js';

function readStoredLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  try {
    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

const localizedTextSources = new WeakMap();
const localizedAttributeSources = new WeakMap();

function localizeDom(root, language) {
  if (!root || language == null) return;
  const skipTags = new Set(['SCRIPT', 'STYLE', 'TEXTAREA']);
  const translateNode = (node) => {
    if (!node || skipTags.has(node.parentElement?.tagName)) return;
    const value = node.nodeValue;
    const previous = localizedTextSources.get(node);
    const source = previous && value === previous.rendered ? previous.source : value;
    const localized = localizeText(source, language);
    localizedTextSources.set(node, { source, rendered: localized });
    if (localized !== value) node.nodeValue = localized;
  };

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach(translateNode);

  root.querySelectorAll?.('[placeholder], [title], [aria-label]').forEach((element) => {
    const records = localizedAttributeSources.get(element) || new Map();
    ['placeholder', 'title', 'aria-label'].forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (!value) return;
      const previous = records.get(attribute);
      const source = previous && value === previous.rendered ? previous.source : value;
      const localized = localizeText(source, language);
      records.set(attribute, { source, rendered: localized });
      if (localized !== value) element.setAttribute(attribute, localized);
    });
    localizedAttributeSources.set(element, records);
  });
}

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  projectLanguage: DEFAULT_LANGUAGE,
  setProjectLanguage: () => {},
  t: createTranslator(DEFAULT_LANGUAGE),
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage);
  const [projectLanguage, setProjectLanguageState] = useState(null);

  const setLanguage = useCallback((nextLanguage) => {
    const normalized = normalizeLanguage(nextLanguage);
    setLanguageState(normalized);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
      } catch {
        // Keep in-memory language even if storage is unavailable.
      }
    }
  }, []);

  const effectiveProjectLanguage = normalizeLanguage(projectLanguage || language);
  const t = useMemo(() => createTranslator(effectiveProjectLanguage), [effectiveProjectLanguage]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const root = document.body;
    localizeDom(root, effectiveProjectLanguage);
    let scheduled = false;
    const scheduleLocalization = () => {
      if (scheduled) return;
      scheduled = true;
      window.setTimeout(() => {
        scheduled = false;
        localizeDom(root, effectiveProjectLanguage);
      }, 50);
    };
    const observer = new MutationObserver(scheduleLocalization);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'],
    });
    return () => observer.disconnect();
  }, [effectiveProjectLanguage]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    projectLanguage: effectiveProjectLanguage,
    setProjectLanguage: (nextLanguage) => setProjectLanguageState(nextLanguage ? normalizeLanguage(nextLanguage) : null),
    t,
  }), [language, setLanguage, effectiveProjectLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
