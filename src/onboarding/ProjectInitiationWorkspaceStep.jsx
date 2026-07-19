import React from 'react';
import { ChevronRight } from 'lucide-react';

export default function ProjectInitiationWorkspaceStep({
  activeLanguage,
  workspaceDraft,
  workspaceReady,
  workspaceStatusClass,
  workspacePath,
  backendUrlConfigured,
  projectId,
  onBasePathChange,
  onFolderNameChange,
  onOpenFolderPicker,
  onPrepareWorkspace,
  onContinue,
}) {
  return (
    <div className="max-w-4xl mx-auto">
      <section className="bg-[#efe2bd] text-[#251b13] border border-[#7b6542] p-8">
        <div className="font-mono text-[10px] tracking-[0.28em] text-[#8f1e18] mb-5">{activeLanguage === 'zh' ? '第 2 步 / 选择保存位置' : 'Step 02 / Local Workspace Setup'}</div>
        <h2 className="font-serif text-5xl leading-none mb-5">{activeLanguage === 'zh' ? '选择项目保存位置' : "Choose this project's local workspace"}</h2>
        <p className="font-serif text-xl leading-relaxed text-[#4d3c28] mb-6">
          {activeLanguage === 'zh' ? '立项会议开始前，系统会在这台电脑上为项目创建独立文件夹。' : 'The backend will create a dedicated folder for this Agent project before the kickoff meeting starts.'}
        </p>
        <div data-testid="initiation-workspace-status" className={`mb-5 border px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] ${workspaceStatusClass}`}>
          {workspaceReady
            ? (activeLanguage === 'zh' ? '已经准备好' : 'Workspace ready')
            : (activeLanguage === 'zh' ? '请先准备项目文件夹' : 'Prepare the project folder first')}
        </div>
        <div className="grid gap-5 md:grid-cols-[1fr_0.8fr]">
          <label className="block">
            <span className="font-mono text-[9px] tracking-widest text-[#7d6a49]">{activeLanguage === 'zh' ? '上级文件夹' : 'Parent Folder'}</span>
            <input
              data-testid="initiation-workspace-base-path"
              value={workspaceDraft.basePath}
              onChange={(event) => onBasePathChange(event.target.value)}
              className="mt-2 w-full bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-mono text-base outline-none focus:border-[#8f1e18]"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[9px] tracking-widest text-[#7d6a49]">{activeLanguage === 'zh' ? '项目文件夹名称' : 'Project Folder Name'}</span>
            <input
              data-testid="initiation-workspace-folder-name"
              value={workspaceDraft.folderName}
              onChange={(event) => onFolderNameChange(event.target.value)}
              className="mt-2 w-full bg-[#f7edcf] border border-[#b8a57d] px-4 py-3 font-mono text-base outline-none focus:border-[#8f1e18]"
            />
          </label>
        </div>
        <div data-testid="initiation-workspace-full-path" className="mt-5 break-all border border-[#b8a57d] bg-[#f7edcf] p-4">
          <div className="font-mono text-[8px] tracking-widest text-[#7d6a49] mb-2">{activeLanguage === 'zh' ? '完整保存位置' : 'Workspace Path'}</div>
          <div className="font-mono text-sm leading-relaxed">{workspacePath}</div>
        </div>
        {workspaceDraft.browserHandleName && (
          <div data-testid="initiation-workspace-browser-folder" className="mt-3 border border-[#b9a55f] bg-[#fbf7df] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#75631d]">
            {activeLanguage === 'zh' ? '已选择文件夹' : 'Browser folder selected'}: {workspaceDraft.browserHandleName}
          </div>
        )}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            data-testid="initiation-workspace-open-folder-picker"
            onClick={onOpenFolderPicker}
            disabled={workspaceDraft.pickingFolder}
            className="flex-1 border border-[#251b13] px-5 py-4 font-mono text-[10px] uppercase tracking-widest hover:bg-[#d8c99f] disabled:cursor-wait disabled:opacity-60"
          >
            {workspaceDraft.pickingFolder
              ? (activeLanguage === 'zh' ? '正在等待位置选择…' : 'Waiting for folder selection...')
              : (activeLanguage === 'zh' ? '选择位置' : 'Choose Folder')}
          </button>
          <button
            type="button"
            data-testid="initiation-workspace-prepare"
            onClick={onPrepareWorkspace}
            disabled={workspaceDraft.preparing || workspaceDraft.pickingFolder || !backendUrlConfigured}
            className="flex-[1.3] bg-[#8f1e18] disabled:bg-[#b8a57d] disabled:text-[#7d6a49] hover:bg-[#a62a22] text-white px-5 py-4 font-mono text-[10px] uppercase tracking-widest transition-colors"
          >
            {workspaceDraft.preparing ? (activeLanguage === 'zh' ? '正在创建…' : 'Preparing...') : (activeLanguage === 'zh' ? '创建项目文件夹' : 'Create Workspace Folder')}
          </button>
        </div>
        {workspaceDraft.notice && (
          <div data-testid="initiation-workspace-picker-notice" className="mt-4 border border-[#b9a55f] bg-[#fbf7df] px-4 py-3 font-serif text-sm text-[#75631d]">{workspaceDraft.notice}</div>
        )}
        {workspaceDraft.error && (
          <div className="mt-4 border border-[#8f1e18] bg-[#f9e1dc] px-4 py-3 font-serif text-sm text-[#8f1e18]">{workspaceDraft.error}</div>
        )}
        <details data-testid="initiation-workspace-receipt" className="mt-4 border border-[#b8a57d] px-4 py-3 font-mono text-[10px] leading-relaxed text-[#7d6a49]">
          <summary className="cursor-pointer">{activeLanguage === 'zh' ? '查看技术信息' : 'View technical details'}</summary>
          <div className="mt-3 grid gap-2 break-all md:grid-cols-2">
            <div>Prepare route: /workspace/prepare</div>
            <div>Project id: {projectId}</div>
            <div>Prepared path: {workspaceDraft.receipt?.workspacePath || 'not prepared'}</div>
            <div>Status: {workspaceDraft.preparing ? 'preparing' : workspaceReady ? 'ready' : 'waiting'}</div>
          </div>
        </details>
        <button
          data-testid="initiation-workspace-next-invite"
          onClick={onContinue}
          disabled={!workspaceReady}
          className="mt-7 w-full bg-[#8f1e18] disabled:bg-[#3a2a1c] disabled:text-[#7d6a49] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors"
        >
          {activeLanguage === 'zh' ? '组建团队' : 'Invite Agents'} <ChevronRight size={15} />
        </button>
      </section>
    </div>
  );
}
