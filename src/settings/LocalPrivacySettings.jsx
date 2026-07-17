import { LockKeyhole, ShieldCheck } from 'lucide-react';

export default function LocalPrivacySettings({
  project = null,
  policy = {},
  saving = false,
  canWrite = false,
  onUpdate,
} = {}) {
  const disabled = !canWrite || saving;
  const fieldClass = 'mt-2 w-full border border-[#b8b4a8] bg-white px-3 py-2.5 text-sm text-[#1a1a1a] outline-none focus:border-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <div className="space-y-5" data-testid="settings-local-privacy-simple">
      <section className="border border-[#d1d0c9] bg-[#f5f4f0] p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck size={22} className="mt-1 shrink-0 text-[#8f1e18]" />
          <div>
            <div className="font-mono text-xs tracking-[0.18em] text-[#8f1e18]">本地隐私</div>
            <h3 className="mt-2 font-serif text-3xl leading-tight text-[#1a1a1a]">项目数据由这台电脑管理</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#5f5a50]">账户、项目、会议、任务和文件保存在本机。模型只会收到完成当前工作所需的内容，产品不会自动把项目数据上传到云端。</p>
          </div>
        </div>
        {!project && <div className="mt-4 border border-[#b9a55f] bg-[#fbf7df] p-3 text-sm text-[#75631d]">请先创建或选择项目，再修改该项目的隐私设置。</div>}
      </section>

      <section className="grid gap-4 border border-[#d1d0c9] bg-[#f8f6ee] p-5 sm:grid-cols-2">
        <label className="text-sm text-[#4f4b43]">数据保留方式
          <select data-testid="settings-privacy-retention-mode" className={fieldClass} value={policy.retentionMode || 'project-local'} disabled={disabled} onChange={event => onUpdate?.({ retentionMode: event.currentTarget.value })}>
            <option value="project-local">随项目保存在本机</option>
            <option value="session-only">只保留到本次使用结束</option>
            <option value="manual-export">只在手动导出时保留</option>
          </select>
        </label>
        <label className="text-sm text-[#4f4b43]">模型服务日志
          <select data-testid="settings-privacy-provider-log-mode" className={fieldClass} value={policy.providerLogMode || 'redacted'} disabled={disabled} onChange={event => onUpdate?.({ providerLogMode: event.currentTarget.value })}>
            <option value="redacted">删除敏感内容后记录</option>
            <option value="metadata-only">只记录时间和状态</option>
          </select>
        </label>
        <label className="flex items-start gap-3 border border-[#d1d0c9] bg-white p-4 text-sm leading-relaxed text-[#1a1a1a] sm:col-span-2">
          <input data-testid="settings-privacy-export-approval" type="checkbox" className="mt-1" checked={policy.evidenceExportRequiresApproval !== false} disabled={disabled} onChange={event => onUpdate?.({ evidenceExportRequiresApproval: event.currentTarget.checked })} />
          <span><strong className="block font-medium">导出证据前需要确认</strong><span className="mt-1 block text-[#5f5a50]">防止项目资料在未经确认时被复制到项目目录之外。</span></span>
        </label>
      </section>

      <section className="flex items-start gap-3 border border-[#59684b] bg-[#eef5df] p-4 text-[#3f5136]">
        <LockKeyhole size={18} className="mt-0.5 shrink-0" />
        <div><div className="font-serif text-xl">不会用于模型训练</div><p className="mt-1 text-sm leading-relaxed">当前本地隐私规则不允许把项目内容作为模型训练数据。</p></div>
      </section>

      <details className="border border-[#d1d0c9] bg-[#f5f4f0]">
        <summary className="cursor-pointer px-5 py-3 font-mono text-xs tracking-[0.12em]">查看技术诊断信息</summary>
        <div className="space-y-2 border-t border-[#d1d0c9] p-4 font-mono text-xs text-[#5f5a50]">
          <div>项目：{project?.name || '尚未选择'}</div>
          <div>设置版本：{project?.projectSettings?.revision || 0}</div>
          <div>保存状态：{saving ? '正在保存' : canWrite ? '可以保存' : '等待选择项目'}</div>
        </div>
      </details>
    </div>
  );
}
