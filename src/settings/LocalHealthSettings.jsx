import { Activity, Network, Play } from 'lucide-react';

const rowName = (row = {}) => {
  const token = `${row.id || ''} ${row.label || ''}`.toLowerCase();
  if (/project.*catalog/.test(token)) return '项目目录';
  if (/workflow/.test(token)) return '完整工作流程';
  if (/worker/.test(token)) return '后台任务服务';
  if (/evidence|search/.test(token) && /request|loop/.test(token)) return '调查资料搜索请求';
  if (/evidence|search/.test(token)) return '调查资料搜索配置';
  if (/model/.test(token) && /request|loop/.test(token)) return '模型请求';
  if (/model/.test(token)) return '模型配置';
  if (/secret.*vault|vault/.test(token)) return '本地密钥存储';
  if (/local.*mvp|startup/.test(token)) return '首次启动';
  if (/backend|settings-health-readiness/.test(token)) return '本地服务';
  return '本地检查';
};

const rowDetail = (row = {}) => {
  const name = rowName(row);
  if (row.status === 'pass') return '检查通过，可以正常使用。';
  if (row.status === 'running') return '正在检查，请稍候。';
  if (row.status === 'idle') return '尚未检查。';
  if (name === '本地服务') return '本地服务未响应时，请重新启动产品后再检查。';
  if (name === '模型配置' || name === '模型请求') return '请打开“密钥”页面完成模型配置，然后重新检查。';
  if (name === '调查资料搜索配置' || name === '调查资料搜索请求') return '这是可选功能；需要调查外部资料时再到“密钥”页面配置。';
  if (name === '完整工作流程') return '请先完成模型配置，再运行完整工作检查。';
  if (name === '后台任务服务') return '创建项目后，本地任务服务会自动开始工作。';
  return row.status === 'blocked' ? '需要先完成相关设置。' : '尚未配置或等待检查。';
};

const summaryLabel = (healthCheck = {}, backendUrlConfigured = false) => {
  if (healthCheck.running) return '正在检查';
  if (!backendUrlConfigured) return '需要设置本地服务';
  if (['failed', 'fail'].includes(String(healthCheck.summary || '').toLowerCase()) || healthCheck.error) return '检查没有通过';
  if (['blocked'].includes(String(healthCheck.summary || '').toLowerCase())) return '需要处理';
  if (healthCheck.lastRunAt) return '检查已完成';
  return '尚未检查';
};

const friendlyHealthError = (error) => {
  const message = String(error || '');
  if (/backend API URL|Save.*backend/i.test(message)) return '请先保存本地服务地址，再运行检查。';
  if (/timed out|timeout|AbortError/i.test(message)) return '检查等待时间过长，已经停止。请确认本地服务正在运行后重试。';
  if (/fetch|connect|ECONNREFUSED|unreachable/i.test(message)) return '无法连接本地服务。请重新启动本地服务后再试。';
  return '检查没有完成。请重新检查；如果仍然失败，请下载诊断信息。';
};

export default function LocalHealthSettings({
  healthCheck = {},
  rows = [],
  statusClass = {},
  statusLabels = {},
  backendUrlConfigured = false,
  targetLabel = '',
  workflowSmoke = null,
  workflowProofRows = [],
  onQuickCheck,
  onWorkflowCheck,
} = {}) {
  const lastRun = healthCheck.lastRunAt
    ? new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(healthCheck.lastRunAt))
    : '尚未运行';
  return (
    <div className="space-y-5" data-testid="settings-local-health-simple">
      <section className="border border-[#d1d0c9] bg-[#f5f4f0] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="font-mono text-xs tracking-[0.18em] text-[#8f1e18]">本地健康检查</div>
            <h3 className="mt-2 font-serif text-3xl leading-tight text-[#1a1a1a]">检查本地服务和模型</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#5f5a50]">基础检查不会调用模型。完整工作检查会实际验证一次本地团队工作流程，适合首次配置完成后运行。</p>
          </div>
          <Activity size={24} className={healthCheck.running ? 'animate-pulse text-[#8f1e18]' : 'text-[#555047]'} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" data-testid="settings-health-quick-check" onClick={onQuickCheck} disabled={healthCheck.running || !backendUrlConfigured} className="border border-[#1a1a1a] bg-[#1a1a1a] px-4 py-3 text-sm text-white disabled:opacity-40"><Play size={14} className="mr-2 inline" />运行基础检查</button>
          <button type="button" data-testid="settings-health-workflow-smoke" onClick={onWorkflowCheck} disabled={healthCheck.running || !backendUrlConfigured} className="border border-[#1a1a1a] px-4 py-3 text-sm disabled:opacity-40"><Network size={14} className="mr-2 inline" />运行完整工作检查</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="border border-[#d1d0c9] bg-white p-4"><div className="text-sm text-[#6b665c]">当前状态</div><div className="mt-2 font-serif text-xl">{summaryLabel(healthCheck, backendUrlConfigured)}</div></div>
          <div className="border border-[#d1d0c9] bg-white p-4"><div className="text-sm text-[#6b665c]">上次检查</div><div className="mt-2 font-serif text-xl">{lastRun}</div></div>
        </div>
      </section>

      <section className="overflow-hidden border border-[#d1d0c9] bg-[#f5f4f0]">
        {rows.map(row => (
          <div key={row.id} className="grid gap-2 border-b border-[#d1d0c9] px-4 py-4 last:border-b-0 sm:grid-cols-[160px_100px_1fr] sm:items-center">
            <div className="font-serif text-lg text-[#1a1a1a]">{rowName(row)}</div>
            <div><span className={`inline-flex min-w-[84px] justify-center border px-2 py-1 font-mono text-xs ${statusClass[row.status] || statusClass.idle}`}>{statusLabels[row.status] || '尚未检查'}</span></div>
            <div className="text-sm leading-relaxed text-[#5f5a50]">{rowDetail(row)}</div>
          </div>
        ))}
      </section>

      {healthCheck.error && <div role="alert" className="border border-red-800 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800">{friendlyHealthError(healthCheck.error)}</div>}

      <details className="border border-[#d1d0c9] bg-[#f5f4f0]">
        <summary className="cursor-pointer px-5 py-3 font-mono text-xs tracking-[0.12em]">查看技术诊断信息</summary>
        <div className="space-y-2 border-t border-[#d1d0c9] p-4 font-mono text-xs leading-relaxed text-[#5f5a50]">
          <div>本地服务：{targetLabel || '尚未设置'}</div>
          {rows.map(row => <div key={`technical-${row.id}`}>{rowName(row)}：{row.detail || row.status || '尚未检查'}</div>)}
          {workflowSmoke && <div data-testid="settings-health-workflow-smoke-output">完整工作检查：{workflowSmoke.status || '已返回结果'}</div>}
          {workflowProofRows.map(([label, value]) => <div key={label}>{label}：{value}</div>)}
        </div>
      </details>
    </div>
  );
}
