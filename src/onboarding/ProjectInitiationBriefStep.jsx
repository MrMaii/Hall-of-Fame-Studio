import React from 'react';
import { ChevronRight } from 'lucide-react';

export default function ProjectInitiationBriefStep({
  activeLanguage,
  draft,
  workMode,
  workModes,
  onDraftChange,
  onWorkModeChange,
  onContinue,
}) {
  const selectedWorkMode = workModes.find(mode => mode.id === workMode);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-[#efe2bd] text-[#251b13] border border-[#7b6542] p-7 shadow-[16px_16px_0_rgba(0,0,0,0.25)]">
        <div className="font-mono text-[10px] tracking-[0.28em] text-[#8f1e18] mb-5">{activeLanguage === 'zh' ? '第 1 步 / 项目说明' : 'Step 01 / Project Brief'}</div>
        <div className="space-y-5">
          <label className="block">
            <span className="font-mono text-[9px] tracking-widest text-[#7d6a49]">{activeLanguage === 'zh' ? '项目名称' : 'Project Name'}</span>
            <input value={draft.name} onChange={(event) => onDraftChange('name', event.target.value)} className="mt-2 w-full bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-serif text-3xl outline-none focus:border-[#8f1e18]" />
          </label>
          <label className="block">
            <span className="font-mono text-[9px] tracking-widest text-[#7d6a49]">{activeLanguage === 'zh' ? '一句话简介' : 'One-Line Summary'}</span>
            <input value={draft.summary} onChange={(event) => onDraftChange('summary', event.target.value)} className="mt-2 w-full bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-serif text-xl outline-none focus:border-[#8f1e18]" />
          </label>
          <label className="block">
            <span className="font-mono text-[9px] tracking-widest text-[#7d6a49]">{activeLanguage === 'zh' ? '你想完成什么？' : 'What do you want to accomplish?'}</span>
            <textarea value={draft.intent} onChange={(event) => onDraftChange('intent', event.target.value)} className="mt-2 w-full min-h-[92px] resize-none bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-serif text-xl leading-relaxed outline-none focus:border-[#8f1e18]" />
          </label>
          <label className="block">
            <span className="font-mono text-[9px] tracking-widest text-[#7d6a49]">{activeLanguage === 'zh' ? '工作类型' : 'Operating Mode'}</span>
            <select data-testid="initiation-work-mode" value={workMode} onChange={(event) => onWorkModeChange(event.target.value)} className="mt-2 w-full bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-serif text-lg outline-none focus:border-[#8f1e18]">
              {workModes.map(mode => <option key={mode.id} value={mode.id}>{activeLanguage === 'zh' ? mode.zhLabel : mode.label}</option>)}
            </select>
            <p className="mt-2 font-serif text-sm leading-relaxed text-[#6a573d]">{activeLanguage === 'zh' ? selectedWorkMode?.zhDetail : `${selectedWorkMode?.detail} The final kickoff uses a role-covered team and independent reviewer for this mode.`}</p>
          </label>
          <div className="hidden">
            <label className="block">
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">Expected Output</span>
              <input value={draft.output} onChange={(event) => onDraftChange('output', event.target.value)} className="mt-2 w-full bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-serif text-lg outline-none focus:border-[#8f1e18]" />
            </label>
            <label className="block">
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">Why now?</span>
              <input value={draft.reason} onChange={(event) => onDraftChange('reason', event.target.value)} className="mt-2 w-full bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-serif text-lg outline-none focus:border-[#8f1e18]" />
            </label>
          </div>
        </div>
        <button data-testid="initiation-next-workspace" onClick={onContinue} className="mt-7 w-full bg-[#8f1e18] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
          {activeLanguage === 'zh' ? '下一步：选择保存位置' : 'Setup Local Workspace'} <ChevronRight size={15} />
        </button>
      </div>

      <aside className="hidden">
        <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#8f1e18] mb-5">Draft Status</div>
        <h2 className="font-serif text-4xl leading-none mb-4">{draft.name || 'Untitled Project'}</h2>
        <p className="font-serif text-xl leading-relaxed text-[#d8c99f] mb-6">{draft.summary}</p>
        <div className="border-t border-[#3a2a1c] pt-5 font-serif text-lg leading-relaxed text-[#bcae86]">
          This is only a project draft. It will not enter the dashboard until the kickoff meeting is approved.
        </div>
        <button onClick={onContinue} className="mt-7 w-full bg-[#8f1e18] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
          Setup Local Workspace <ChevronRight size={15} />
        </button>
      </aside>
    </div>
  );
}
