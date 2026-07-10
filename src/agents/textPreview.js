import { redactSensitiveText } from './secretRedaction.js';

export function compactPreview(value = '', limit = 160) {
  const text = redactSensitiveText(String(value || '').replace(/\s+/g, ' ').trim());
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}
