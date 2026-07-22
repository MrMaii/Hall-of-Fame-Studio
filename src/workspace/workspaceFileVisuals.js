const FILE_FAMILIES = [
  { family: 'code', icon: 'code', extensions: ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'py', 'java', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'html', 'css', 'scss', 'vue', 'svelte', 'sh', 'ps1'] },
  { family: 'text', icon: 'text', extensions: ['md', 'mdx', 'txt', 'rtf', 'log'] },
  { family: 'document', icon: 'document', extensions: ['pdf', 'doc', 'docx', 'odt'] },
  { family: 'data', icon: 'data', extensions: ['json', 'jsonl', 'yaml', 'yml', 'csv', 'xml', 'sql'] },
  { family: 'spreadsheet', icon: 'table', extensions: ['xls', 'xlsx', 'ods'] },
  { family: 'presentation', icon: 'presentation', extensions: ['ppt', 'pptx', 'key'] },
  { family: 'image', icon: 'image', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff'] },
  { family: 'audio', icon: 'audio', extensions: ['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg'] },
  { family: 'video', icon: 'video', extensions: ['mp4', 'mov', 'webm', 'avi', 'mkv'] },
  { family: 'archive', icon: 'archive', extensions: ['zip', '7z', 'rar', 'tar', 'gz', 'tgz'] },
  { family: 'config', icon: 'config', extensions: ['env', 'ini', 'toml', 'lock', 'conf', 'config'] },
];

const TEXT_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'py', 'java', 'go', 'rs', 'rb', 'php', 'swift', 'kt',
  'html', 'css', 'scss', 'vue', 'svelte', 'sh', 'ps1', 'md', 'mdx', 'txt', 'rtf', 'log',
  'json', 'jsonl', 'yaml', 'yml', 'csv', 'xml', 'sql', 'env', 'ini', 'toml', 'lock', 'conf', 'config',
]);

export function workspaceFileExtension(name = '') {
  const normalized = String(name || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.startsWith('.') && normalized.indexOf('.', 1) === -1) return normalized.slice(1);
  const dot = normalized.lastIndexOf('.');
  return dot > -1 ? normalized.slice(dot + 1) : '';
}

export function resolveWorkspaceFileVisual(entry = {}) {
  if (entry.type === 'directory') return { family: 'folder', icon: 'folder', label: 'DIR' };
  if (entry.type === 'symlink') return { family: 'symlink', icon: 'link', label: 'LINK' };
  const extension = workspaceFileExtension(entry.name);
  const definition = FILE_FAMILIES.find(item => item.extensions.includes(extension));
  if (definition) return { family: definition.family, icon: definition.icon, label: extension.slice(0, 4).toUpperCase() };
  return { family: 'unknown', icon: 'file', label: extension ? extension.slice(0, 4).toUpperCase() : 'FILE' };
}

export function isWorkspaceTextFile(entry = {}) {
  return entry.type === 'file' && TEXT_EXTENSIONS.has(workspaceFileExtension(entry.name));
}
