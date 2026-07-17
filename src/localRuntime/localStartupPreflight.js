import { createServer } from 'node:net';

export const MINIMUM_NODE_MAJOR = 20;

export function validateLocalNodeVersion(version = process.versions.node, minimumMajor = MINIMUM_NODE_MAJOR) {
  const major = Number.parseInt(String(version || '').split('.')[0], 10);
  if (!Number.isInteger(major) || major < minimumMajor) {
    return {
      ok: false,
      major: Number.isInteger(major) ? major : null,
      message: `需要 Node.js ${minimumMajor} 或更高版本，当前版本为 ${version || '未知'}。`,
    };
  }
  return { ok: true, major, message: `Node.js ${version} 可以使用。` };
}

export function canListen({ host = '127.0.0.1', port } = {}) {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen({ host, port, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

export async function findAvailableLocalPort({ host = '127.0.0.1', preferredPort, attempts = 40, excludedPorts = [] } = {}) {
  const firstPort = Number(preferredPort);
  if (!Number.isInteger(firstPort) || firstPort < 1 || firstPort > 65_535) throw new Error('local-startup-port-invalid');
  const excluded = new Set(excludedPorts.map(Number));
  for (let offset = 0; offset < attempts; offset += 1) {
    const candidate = firstPort + offset;
    if (candidate > 65_535 || excluded.has(candidate)) continue;
    if (await canListen({ host, port: candidate })) return candidate;
  }
  throw new Error(`在 ${host} 上找不到可用端口，请关闭占用 ${firstPort}-${Math.min(65_535, firstPort + attempts - 1)} 的程序后重试。`);
}
