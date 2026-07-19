import React from 'react';

export default function ProjectDashboardHeader({ view = {} }) {
  const {
    activeProject,
    fixtureMeta,
    projectDashboardSnapshotSourceMeta,
    projectText,
    showSimpleViewButton,
    onOpenMeeting,
    onOpenChat,
    onOpenTimeline,
    onOpenSimpleView,
  } = view;

  return (
    <>
      <header className="col-span-12 border-b border-[#b8a57d] pb-8 flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#8f1e18] mb-3">Project Dashboard</div>
          <h1 className="font-serif text-6xl leading-none mb-4">{activeProject.name}</h1>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-[#6b5a3d]">
            <span className="bg-[#251b13] text-[#efe2bd] px-3 py-1">{projectText(activeProject.status)}</span>
            {fixtureMeta && <span className="border border-[#b9782b] bg-[#f7edcf] px-3 py-1 text-[#8f1e18]">Sample fixture</span>}
            <span
              data-testid="project-dashboard-snapshot-source"
              className={`border px-3 py-1 ${projectDashboardSnapshotSourceMeta.className}`}
            >
              {projectDashboardSnapshotSourceMeta.label}
            </span>
            <span>ID: {activeProject.id}</span>
            <span>{activeProject.team.length} {projectText('Members')}</span>
          </div>
          <div data-testid="project-dashboard-snapshot-source-detail" className="mt-2 font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">
            {projectDashboardSnapshotSourceMeta.detail}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" data-testid="project-open-meeting" onClick={onOpenMeeting} className="border border-[#251b13] bg-[#251b13] px-4 py-2 text-sm text-[#efe2bd] hover:bg-[#8f1e18]">
              {projectText('Open project meeting')}
            </button>
            <button type="button" data-testid="project-open-chat" onClick={onOpenChat} className="border border-[#251b13] px-4 py-2 text-sm hover:bg-[#efe2bd]">
              {projectText('Open project chat')}
            </button>
            <button type="button" data-testid="project-open-timeline" onClick={onOpenTimeline} className="border border-[#251b13] px-4 py-2 text-sm hover:bg-[#efe2bd]">
              {projectText('View full timeline')}
            </button>
            {showSimpleViewButton && (
              <button type="button" onClick={onOpenSimpleView} className="border border-[#7b6542] px-4 py-2 text-sm text-[#6b5a3d] hover:bg-[#efe2bd]">
                {projectText('Return to simple view')}
              </button>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="font-serif text-6xl">{activeProject.progress}%</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#6b5a3d]">{projectText('Project Progress')}</div>
          <div className="mt-3 flex flex-col items-end gap-1">
            <span
              data-testid="project-dashboard-progress-source"
              className={`w-fit border px-2 py-1 font-mono text-[8px] uppercase tracking-widest ${projectDashboardSnapshotSourceMeta.className}`}
            >
              {projectDashboardSnapshotSourceMeta.label}
            </span>
            <span
              data-testid="project-dashboard-progress-source-detail"
              className="max-w-[260px] text-right font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]"
            >
              {projectDashboardSnapshotSourceMeta.detail}
            </span>
          </div>
        </div>
      </header>

      {fixtureMeta && (
        <div data-testid="project-sample-fixture-banner" className="col-span-12 border border-[#b9782b] bg-[#fff6d7] p-5">
          <div className="font-mono text-[9px] uppercase tracking-widest text-[#8f1e18] mb-2">
            {fixtureMeta.label || 'Sample Fixture'}
          </div>
          <p className="font-serif text-xl leading-snug text-[#4d412d]">
            {projectText(fixtureMeta.purpose || 'Validation and demo data only; create real work through initiation.')}
          </p>
        </div>
      )}
    </>
  );
}
