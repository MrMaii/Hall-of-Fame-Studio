import { Cpu, Database, Settings, ShieldCheck, UserCircle, X } from 'lucide-react';

export default function LocalSettingsOverview({
  serviceReady = false,
  modelReady = false,
  projectCount = 0,
  user = null,
  onClose,
  onOpenAdvanced,
  onLogout,
  onDownloadDiagnostics,
} = {}) {
  const userRoleLabel = ({
    'security-admin': '安全管理员',
    manager: '项目负责人',
    observer: '查看者',
  })[user?.role] || '普通用户';
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4 py-4 md:px-6 md:py-6">
      <button type="button" aria-label="关闭设置" onClick={onClose} className="absolute inset-0 cursor-default" />
      <section role="dialog" aria-modal="true" aria-labelledby="local-settings-title" className="relative z-10 flex h-[min(720px,94vh)] w-[min(860px,96vw)] flex-col overflow-hidden border border-[#1a1a1a] bg-[#f5f4f0] text-[#1a1a1a] shadow-[18px_18px_0_rgba(0,0,0,0.22)]">
        <header className="flex items-start justify-between gap-5 border-b border-[#d1d0c9] px-6 py-5 md:px-8">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#8f1e18]">本机设置</div>
            <h2 id="local-settings-title" className="mt-2 font-serif text-4xl">名人堂工作室设置</h2>
            <p className="mt-2 text-sm text-[#6b665c]">账户、模型和项目数据都由这台电脑管理。</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-[#6b665c] hover:bg-[#e1ded5] hover:text-[#1a1a1a]" aria-label="关闭设置"><X size={19} /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8">
          <div className="grid gap-4 md:grid-cols-2">
            <section className="border border-[#d1d0c9] bg-white p-5">
              <div className="flex items-center gap-2 text-sm text-[#6b665c]"><ShieldCheck size={16} /> 本地服务</div>
              <div className="mt-3 font-serif text-2xl">{serviceReady ? '运行正常' : '需要检查'}</div>
              <p className="mt-2 text-sm leading-relaxed text-[#6b665c]">{serviceReady ? '项目、账户和消息可以在本机读取和保存。' : '项目数据仍保存在本机。请打开高级设置检查服务。'}</p>
              {!serviceReady && <button type="button" onClick={() => onOpenAdvanced?.('deployment')} className="mt-4 border border-[#251b13] px-4 py-2 text-sm">检查本地服务</button>}
            </section>

            <section className="border border-[#d1d0c9] bg-white p-5">
              <div className="flex items-center gap-2 text-sm text-[#6b665c]"><Cpu size={16} /> AI 模型</div>
              <div className="mt-3 font-serif text-2xl">{modelReady ? '已经配置' : '尚未配置'}</div>
              <p className="mt-2 text-sm leading-relaxed text-[#6b665c]">模型可来自这台电脑能够访问的本地接口。项目数据不会自动上传。</p>
              <button type="button" onClick={() => onOpenAdvanced?.('keys')} className="mt-4 border border-[#251b13] px-4 py-2 text-sm">{modelReady ? '查看模型设置' : '配置模型'}</button>
            </section>

            <section className="border border-[#d1d0c9] bg-white p-5">
              <div className="flex items-center gap-2 text-sm text-[#6b665c]"><UserCircle size={16} /> 本地账户</div>
              <div className="mt-3 font-serif text-2xl">{user?.displayName || user?.username || '未登录'}</div>
              <p className="mt-2 text-sm text-[#6b665c]">{user ? `用户名：${user.username} · 权限：${userRoleLabel}` : '登录后才能访问本机项目。'}</p>
              {user && <button type="button" onClick={onLogout} className="mt-4 border border-[#8f1e18] px-4 py-2 text-sm text-[#8f1e18]">退出本地账户</button>}
            </section>

            <section className="border border-[#d1d0c9] bg-white p-5">
              <div className="flex items-center gap-2 text-sm text-[#6b665c]"><Database size={16} /> 本地数据</div>
              <div className="mt-3 font-serif text-2xl">{projectCount} 个项目</div>
              <p className="mt-2 text-sm leading-relaxed text-[#6b665c]">项目、会议和工作记录保存在这台电脑，并使用本地备份与恢复机制。</p>
            </section>
          </div>

          <div className="mt-6 border border-[#d1d0c9] bg-[#ebe9e0] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-serif text-xl">高级设置</div>
                <p className="mt-1 text-sm text-[#6b665c]">用于账户管理、模型接口、工作区、隐私、诊断和恢复。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onDownloadDiagnostics} className="border border-[#251b13] px-4 py-2.5 text-sm">下载诊断信息</button>
                <button type="button" onClick={() => onOpenAdvanced?.('deployment')} className="inline-flex shrink-0 items-center justify-center gap-2 border border-[#251b13] bg-[#251b13] px-4 py-2.5 text-sm text-white"><Settings size={15} /> 打开高级设置</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
