import { portableSha256Hex } from '../agents/accessControl.js';

export function createHash(algorithm = '') {
  if (String(algorithm).toLowerCase() !== 'sha256') throw new Error('unsupported-browser-hash-algorithm');
  let input = '';
  return {
    update(value, encoding = 'utf8') {
      if (encoding && !['utf8', 'utf-8'].includes(String(encoding).toLowerCase())) {
        throw new Error('unsupported-browser-hash-encoding');
      }
      if (typeof value !== 'string') throw new Error('unsupported-browser-hash-input');
      input += value;
      return this;
    },
    digest(format = 'hex') {
      if (String(format).toLowerCase() !== 'hex') throw new Error('unsupported-browser-hash-digest');
      return portableSha256Hex(input);
    },
  };
}

export function randomUUID() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues !== 'function') throw new Error('secure-browser-random-unavailable');
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
