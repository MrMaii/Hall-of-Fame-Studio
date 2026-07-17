import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const child = spawn(process.execPath, ['scripts/local-dev.mjs'], {
  cwd: root,
  env: process.env,
  stdio: ['inherit', 'pipe', 'pipe'],
});

let opened = false;
function openBrowser(url) {
  if (opened) return;
  opened = true;
  const platform = process.platform;
  const command = platform === 'win32' ? 'cmd.exe' : platform === 'darwin' ? 'open' : 'xdg-open';
  const args = platform === 'win32' ? ['/d', '/s', '/c', 'start', '', url] : [url];
  const opener = spawn(command, args, { detached: true, stdio: 'ignore' });
  opener.unref();
}

function forward(chunk, stream) {
  const text = chunk.toString();
  stream.write(text);
  const match = text.match(/\+ UI (http:\/\/[^\s]+)/);
  if (match) openBrowser(match[1]);
}

child.stdout.on('data', (chunk) => forward(chunk, process.stdout));
child.stderr.on('data', (chunk) => forward(chunk, process.stderr));
child.on('exit', (code) => process.exit(code || 0));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
