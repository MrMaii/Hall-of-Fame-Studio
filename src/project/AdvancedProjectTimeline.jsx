import { useCallback, useLayoutEffect } from 'react';
import { localizeManagerFlowDisplayText } from '../i18n/managerFlowChinese.js';
import { timelineAxisCenteredPanY } from '../workflow/workflowTimelineLayout.js';

const AdvancedProjectTimeline = ({ view }) => {
  const {
    CheckCircle2,
    CircleDot,
    Database,
    FileText,
    MessageSquare,
    Network,
    ScrollText,
    X,
    activeLanguage,
    activeProject,
    agentDisplay,
    backendCommandAvailable,
    backendStation,
    canvasH,
    canvasW,
    categoryMeta,
    categoryOrder,
    channelNameById,
    chatProofIdsFromAttachment,
    committersLabel,
    compactText,
    confirmManagerFlowNode,
    connectedPeople,
    defaultGraphPan,
    edgeMeta,
    exitProjectScene,
    focusedTimelineProofIds,
    fitGraphView,
    focusGraphNode,
    focusLatestNode,
    focusSelectedNode,
    getAnchor,
    getTimeBranch,
    graphTime,
    handleGraphMouseDown,
    handleGraphMouseMove,
    handleGraphWheel,
    handleGraphZoomChange,
    isProofFocused,
    managerFlowGraph,
    managerFlowGraphLoadError,
    managerFlowGraphLoading,
    managerFlowGraphSourceLabel,
    nodeCommitters,
    nodeLayout,
    nodeMap,
    openProjectChatProof,
    openProjectTimelineProof,
    overflowGroups,
    projectText,
    openSelectedNodeProofMapRoute,
    openSelectedNodeSubmissionRecord,
    relatedEdges,
    relatedNodeIds,
    reportGraphViewportHeight,
    relationshipGraph,
    renderAutonomousActionDecision,
    resetGraphView,
    scaleProfiles,
    sceneTransition,
    selectedChatProofIds,
    selectedNode,
    selectedNodeHasSubmissionRecord,
    selectedNodeProofMapKey,
    selectedNodeProofMapRoutes,
    selectedNodeProofRoute,
    selectedNodeSubmissionId,
    selectedNodeSubmissionRoute,
    selectedThinkingFrame,
    setFocusedTimelineProofIds,
    setSelectedTimelineEventId,
    setTlDragging,
    setTlPan,
    syncBackendManagerFlowGraph,
    timeAxisY,
    timeTicks,
    timelineViewportRef,
    timelinePublication,
    toggleTimelineOverflowGroup,
    tlDragging,
    tlPan,
    tlZoom,
    visibleEdges,
    visibleNodes,
    visibleNodesByPosition,
    visibleTimelineProofCount,
    zoomDetail,
    zoomScale,
  } = view;

  const graphText = (value, fallback = '系统记录') => localizeManagerFlowDisplayText(value, {
    language: activeLanguage,
    fallback,
    userAuthoredFragments: [
      activeProject.name,
      activeProject.objective,
      activeProject.currentObjective,
      activeProject.initiation?.summary,
      ...(activeProject.initiation?.managerClarifications || []).map(item => item?.text),
    ],
  });

  const lockGraphAxisToViewport = useCallback(() => {
    const viewport = timelineViewportRef.current;
    if (!viewport) return;
    const centeredPanY = timelineAxisCenteredPanY({
      timeAxisY,
      viewportHeight: viewport.clientHeight,
    });
    reportGraphViewportHeight(viewport.clientHeight);
    setTlPan(previousPan => (
      Math.abs(previousPan.y - centeredPanY) < 0.5
        ? previousPan
        : { ...previousPan, y: centeredPanY }
    ));
  }, [reportGraphViewportHeight, setTlPan, timeAxisY, timelineViewportRef]);

  useLayoutEffect(() => {
    if (
      focusedTimelineProofIds.length > 0
      || tlZoom !== 1
      || tlPan.x !== 0
      || tlPan.y !== 0
      || (defaultGraphPan.x === 0 && defaultGraphPan.y === 0)
    ) return;
    setTlPan(defaultGraphPan);
  }, [
    activeProject.id,
    defaultGraphPan.x,
    defaultGraphPan.y,
    focusedTimelineProofIds.length,
    setTlPan,
    tlPan.x,
    tlPan.y,
    tlZoom,
  ]);

  useLayoutEffect(() => {
    lockGraphAxisToViewport();
    const viewport = timelineViewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(lockGraphAxisToViewport);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [activeProject.id, lockGraphAxisToViewport, timelineViewportRef]);

  const selectedNodeMeta = selectedNode ? (categoryMeta[selectedNode.category] || categoryMeta.execution) : categoryMeta.execution;
  const SelectedNodeIcon = selectedNodeMeta?.Icon || CircleDot;
  const selectedSubmissionQuality = selectedNode?.submission?.quality || selectedNode?.submissionQuality || null;
  const selectedContributionIntent = selectedNode?.submission?.submissionMotivation || selectedNode?.submissionMotivation || null;

  return (
        <div className="project-room relative h-screen overflow-hidden text-[#efe2bd] flex flex-col">
          {sceneTransition && <div className="absolute right-16 top-1/2 z-50 w-32 h-32 -translate-y-1/2 bg-[#8f1e18] scene-bubble" />}
          <div className="absolute inset-0 dotgrid-bg--dark tl-breath" />
  
          <div className="relative z-20 flex-shrink-0 border-b border-[#2a2118]/70 bg-[#0d0c0b]/72 px-6 py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-serif text-xl text-[#efe2bd]">{projectText('Recent Work Log')}</h1>
                <div className="breadcrumb-bar mt-1 text-[#7d6a49]">
                  <button data-testid="project-scene-back" aria-label={projectText('Back to project')} onClick={exitProjectScene} className="hover:text-[#efe2bd] transition-colors">{activeProject.name}</button>
                  <span className="sep">/</span>
                  <span className="text-[#efe2bd]">{projectText('Manager Flow Graph')}</span>
                  <span className="ml-3 text-[#7d6a49]">{projectText('Single-Axis Timeline')}</span>
                </div>
              </div>
              <div className="flex max-w-[70%] flex-wrap items-center justify-end gap-2">
                <span
                  data-testid="manager-flow-source-label"
                  className={`node-status-tag ${managerFlowGraph.frontendMockSuppressed ? 'bg-[#8f1e18] text-white' : managerFlowGraph.dataSource === 'frontend-fallback' ? 'bg-[#b9782b] text-white' : 'bg-[#59684b] text-white'}`}
                >
                  {graphText(managerFlowGraphSourceLabel, '后台数据')}
                </span>
                <button
                  type="button"
                  onClick={() => syncBackendManagerFlowGraph({ silent: false })}
                  disabled={!backendCommandAvailable || backendStation.loading || managerFlowGraphLoading}
                  className="inline-flex items-center gap-1.5 border border-[#3a2a1c] px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-40"
                >
                  <Database size={12} /> {projectText('Sync Graph')}
                </button>
                <label className="flex items-center gap-2 border border-[#3a2a1c] bg-[#141210]/85 px-3 py-1.5">
                  <span className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{projectText('Time Scale')}</span>
                  <input
                    data-testid="manager-flow-zoom"
                    type="range"
                    min="36"
                    max="220"
                    step="4"
                    value={Math.round(tlZoom * 100)}
                    onChange={(event) => handleGraphZoomChange(Number(event.target.value) / 100)}
                    className="w-32 accent-[#bcae86]"
                  />
                  <span className="w-20 text-right font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">{Math.round(tlZoom * 100)}% / {projectText(scaleProfiles[zoomScale]?.label)}</span>
                </label>
                <div role="group" aria-label={projectText('Timeline scale presets')} className="flex border border-[#3a2a1c] bg-[#141210]/85">
                  {[
                    ['manager-flow-zoom-outcome', 'month', 0.68, 'Outcome'],
                    ['manager-flow-zoom-phase', 'week', 0.88, 'Phase'],
                    ['manager-flow-zoom-activity', 'day', 1.2, 'Activity'],
                    ['manager-flow-zoom-trace', 'hour', 1.68, 'Trace'],
                  ].map(([testId, scale, zoom, label]) => (
                    <button
                      key={testId}
                      data-testid={testId}
                      type="button"
                      aria-pressed={zoomScale === scale}
                      onClick={() => handleGraphZoomChange(zoom)}
                      className={`border-r border-[#3a2a1c] px-2 py-1.5 font-mono text-[8px] uppercase tracking-widest last:border-r-0 ${zoomScale === scale ? 'bg-[#bcae86] text-[#141210]' : 'text-[#7d6a49] hover:text-[#efe2bd]'}`}
                    >
                      {projectText(label)}
                    </button>
                  ))}
                </div>
                <button data-testid="manager-flow-fit-view" type="button" onClick={fitGraphView} className="border border-[#3a2a1c] px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd]">
                  {projectText('Fit View')}
                </button>
                <button data-testid="manager-flow-focus-selected" type="button" onClick={focusSelectedNode} disabled={!selectedNode} className="border border-[#3a2a1c] px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-35">
                  {projectText('Focus Selected')}
                </button>
                <button data-testid="manager-flow-focus-latest" type="button" onClick={focusLatestNode} disabled={!visibleNodes.length} className="border border-[#3a2a1c] px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-35">
                  {projectText('Latest Commit')}
                </button>
                <button type="button" onClick={resetGraphView} className="border border-[#3a2a1c] px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] hover:border-[#7b6542] hover:text-[#efe2bd]">
                  {projectText('Reset')}
                </button>
              </div>
            </div>
            <div data-testid="manager-flow-legend" className="mt-3 flex flex-wrap items-center gap-2">
              {categoryOrder.map(category => {
                const meta = categoryMeta[category];
                const Icon = meta.Icon || CircleDot;
                return (
                  <span key={`flow-category-legend-${category}`} className="inline-flex items-center gap-1.5 border border-[#2a2118] bg-[#141210]/88 px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">
                    <Icon size={10} style={{ color: meta.color }} />
                    {graphText(meta.label, '流程记录')}
                  </span>
                );
              })}
            </div>
            <div data-testid="manager-flow-semantic-scale-guide" className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#2a2118] pt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
              <span className="text-[#bcae86]">{projectText(`${scaleProfiles[zoomScale]?.label} View`)}</span>
              <span>{projectText(scaleProfiles[zoomScale]?.description)}</span>
              <span>{visibleNodes.length} / {(managerFlowGraph.nodes || []).length} {projectText('nodes visible')}</span>
              <span data-testid="manager-flow-suppressed-node-count">
                {timelinePublication.suppressedNodeCount} {projectText('low-signal records kept in proof only')}
              </span>
            </div>
          </div>
  
          <div className="relative z-10 flex-1 flex overflow-hidden">
            <div
              className={`manager-flow-viewport relative flex-1 overflow-hidden ${tlDragging ? '' : 'tl-canvas-grab'}`}
              ref={timelineViewportRef}
              onWheel={handleGraphWheel}
              onMouseDown={handleGraphMouseDown}
              onMouseMove={handleGraphMouseMove}
              onMouseUp={() => setTlDragging(false)}
              onMouseLeave={() => setTlDragging(false)}
              onDoubleClick={resetGraphView}
            >
              <div className="absolute left-5 top-5 z-40 grid grid-cols-2 md:grid-cols-4 gap-2 max-w-3xl">
                {[
                  ['Nodes', visibleNodes.length],
                  ['Edges', visibleEdges.length],
                  ['Proofed', visibleNodes.filter(node => node.hasProof).length],
                  ['Blocked', visibleNodes.filter(node => node.status === 'blocked').length],
                ].map(([label, value]) => (
                  <div key={label} className="border border-[#3a2a1c] bg-[#141210]/92 px-3 py-2">
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText(label)}</div>
                    <div className="font-serif text-xl leading-tight">{value}</div>
                  </div>
                ))}
              </div>
              {focusedTimelineProofIds.length > 0 && (
                <div data-testid="timeline-evidence-detail" className="absolute left-5 top-[118px] z-40 border border-[#b9782b] bg-[#251b13]/95 px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#efe2bd] shadow-lg">
                  {projectText('Timeline proof focus')}: {visibleTimelineProofCount}/{focusedTimelineProofIds.length}
                  <span className="sr-only">{projectText('Source Channel Receipts Direct Targets')}</span>
                  <button type="button" onClick={() => setFocusedTimelineProofIds([])} className="ml-3 text-[#bcae86] hover:text-white">{projectText('Clear')}</button>
                </div>
              )}
              {managerFlowGraph.frontendMockSuppressed && (
                <div data-testid="manager-flow-backend-required" className="absolute left-5 top-[118px] z-40 max-w-xl border border-[#8f1e18] bg-[#251b13]/95 px-4 py-3 shadow-lg">
                  {managerFlowGraphLoading ? (
                    <div data-testid="manager-flow-loading" role="status" className="font-serif text-sm leading-relaxed text-[#d8c99f]">
                      {projectText('Loading the project timeline…')}
                    </div>
                  ) : (
                    <>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#efe2bd]">{projectText('Backend flow graph missing')}</div>
                      <div className="mt-2 font-serif text-sm leading-relaxed text-[#d8c99f]">
                        {projectText('This real project is connected to the backend, so frontend-generated flow nodes are suppressed until the manager flow graph returns a read model.')}
                      </div>
                      {managerFlowGraphLoadError && (
                        <div data-testid="manager-flow-load-error" role="alert" className="mt-2 font-mono text-[8px] text-[#e7a49f]">
                          {projectText(managerFlowGraphLoadError)}
                        </div>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    data-testid="manager-flow-backend-required-sync"
                    onClick={() => syncBackendManagerFlowGraph({ silent: false })}
                    disabled={!backendCommandAvailable || backendStation.loading || managerFlowGraphLoading}
                    className="mt-3 inline-flex items-center gap-1.5 border border-[#8f1e18] px-3 py-1.5 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:border-[#d8c99f] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Database size={11} /> {projectText('Sync Graph')}
                  </button>
                </div>
              )}
  
              <div
                className="relative"
                data-testid="manager-flow-graph"
                data-timeline-density={tlZoom}
                style={{
                  width: canvasW,
                  height: canvasH,
                  top: tlPan.y,
                  transform: `translate3d(${tlPan.x}px, 0px, 0)`,
                  transformOrigin: '0 0',
                  transition: tlDragging
                    ? 'none'
                    : 'transform 0.28s cubic-bezier(0.16,1,0.3,1), width 0.28s cubic-bezier(0.16,1,0.3,1), height 0.28s cubic-bezier(0.16,1,0.3,1)',
                }}
              >
                <div data-testid="manager-flow-time-axis" className="absolute left-0 right-0 border-t border-[#7b6542]/75" style={{ top: timeAxisY }}>
                  <div className="absolute left-5 top-3 font-mono text-[9px] uppercase tracking-[0.24em] text-[#bcae86]">{projectText('Commit Timeline')}</div>
                  {timeTicks.map(tick => (
                    <div key={`flow-time-tick-${tick.key}`} className="manager-flow-tick absolute top-0" style={{ left: tick.x }}>
                      <div className="h-2 -translate-y-1 border-l border-[#7b6542]" />
                      <div className="mt-1 -translate-x-1/2 whitespace-nowrap border border-[#3a2a1c] bg-[#141210]/92 px-2 py-1 text-center font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">
                        <span className="block text-[#efe2bd]">{tick.dateLabel} · {tick.timeLabel}</span>
                        <span className="block text-[#7d6a49]">{tick.count} {projectText('commits')}</span>
                      </div>
                    </div>
                  ))}
                </div>
  
                <svg className="absolute left-0 top-0 pointer-events-none" style={{ width: canvasW, height: canvasH }}>
                  <defs>
                    <marker id="flow-arrow" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 4 L 0 8 z" fill="#7b6542" />
                    </marker>
                  </defs>
                  <g data-testid="manager-flow-time-branches">
                    {visibleNodesByPosition.map((node) => {
                      const branch = getTimeBranch(node.id);
                      if (!branch) return null;
                      return (
                        <path
                          key={`time-branch-${node.id}`}
                          className="manager-flow-path-transition"
                          d={branch.path}
                          fill="none"
                          stroke="#7b6542"
                          strokeWidth="1"
                          opacity={selectedNode && selectedNode.id !== node.id ? 0.16 : 0.58}
                        />
                      );
                    })}
                  </g>
                  <g data-testid="manager-flow-relationships">
                    {visibleEdges.map(edge => {
                      const anchor = getAnchor(edge);
                      if (!anchor) return null;
                      const isSelected = selectedNode && (edge.fromNodeId === selectedNode.id || edge.toNodeId === selectedNode.id);
                      const meta = edgeMeta[edge.type] || edgeMeta.task_dependency;
                      return (
                        <g key={edge.id}>
                          <path
                            className={`manager-flow-path-transition ${edge.type === 'evidence' ? 'manager-flow-evidence-path' : ''}`}
                            d={anchor.path}
                            fill="none"
                            stroke={isSelected ? meta.color : '#3a2a1c'}
                            strokeWidth={isSelected ? 2 : 1}
                            strokeDasharray={edge.type === 'evidence' ? '5 5' : undefined}
                            markerEnd="url(#flow-arrow)"
                            opacity={selectedNode && !isSelected ? 0.18 : 0.78}
                          />
                          {isSelected && (
                            <circle className="manager-flow-transfer-pulse" r="3" fill="#efe2bd" opacity="0.85">
                              <animateMotion dur="2.6s" repeatCount="indefinite" path={anchor.path} />
                            </circle>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>

                {overflowGroups.map(group => (
                  <button
                    key={group.id}
                    type="button"
                    data-testid={`manager-flow-overflow-${group.id}`}
                    data-overflow-count={group.count}
                    data-expanded={group.expanded ? 'true' : 'false'}
                    aria-label={`${group.expanded ? projectText('Collapse') : projectText('More')} ${group.count}`}
                    onClick={() => toggleTimelineOverflowGroup(group)}
                    className={`manager-flow-overflow-marker absolute z-40 flex items-center justify-center gap-2 border px-3 font-mono text-[8px] uppercase tracking-widest shadow-[4px_4px_0_rgba(0,0,0,0.28)] ${group.expanded ? 'border-[#efe2bd] bg-[#efe2bd] text-[#141210]' : 'border-[#b9782b] bg-[#251b13] text-[#efe2bd]'}`}
                    style={{ left: group.x, top: group.y, width: group.w, height: group.h }}
                  >
                    <span>{projectText(group.expanded ? 'Collapse' : 'More')}</span>
                    <strong>{group.count}</strong>
                  </button>
                ))}
  
                {visibleNodesByPosition.map(node => {
                  const box = nodeLayout[node.id];
                  const meta = categoryMeta[node.category] || categoryMeta.execution;
                  const Icon = meta.Icon || CircleDot;
                  const isSelected = selectedNode?.id === node.id;
                  const isRelated = selectedNode && relatedNodeIds.includes(node.id);
                  const isDimmed = selectedNode && !isSelected && !isRelated;
                  const isFocused = isProofFocused(node);
                  const showDetail = zoomDetail === 'expanded';
                  const submitters = nodeCommitters(node);
                  const primarySubmitter = submitters[0] || agentDisplay(node.agentId);
                  const commitMessage = compactText(node.displayTitle || node.commitMessage || node.summary || node.title, zoomDetail === 'compact' ? 72 : zoomDetail === 'medium' ? 92 : 118);
                  const fullCommitMessage = node.displayTitle || node.commitMessage || node.summary || node.title;
                  const attachmentCount = node.attachments?.length || node.submission?.attachmentIds?.length || 0;
                  const artifactTypeLabel = node.artifactType
                    || node.submission?.artifactType
                    || node.attachmentType
                    || node.attachments?.[0]?.type
                    || node.metadata?.artifactType
                    || '';
                  return (
                    <button
                      key={node.id}
                      type="button"
                      data-testid={`manager-flow-node-${node.id}`}
                      data-timeline-event-id={node.id}
                      data-timeline-time={node.time || ''}
                      data-timeline-category={node.category}
                      data-timeline-directional-decision={node.category === 'decision' ? 'true' : 'false'}
                      data-timeline-proof-ids={JSON.stringify([
                        node.id,
                        ...(node.proofIds || []),
                        ...(node.timelineLogIds || []),
                        ...(node.eventIds || []),
                      ])}
                      onClick={() => setSelectedTimelineEventId(isSelected ? null : node.id)}
                      title={graphText(fullCommitMessage, '流程记录')}
                      className={`manager-flow-node-card absolute flex flex-col overflow-hidden text-left border bg-[#141210]/96 shadow-[7px_7px_0_rgba(0,0,0,0.22)] ${isSelected ? 'z-30 border-[#efe2bd]' : isRelated ? 'z-20 border-[#7b6542]' : 'z-10 border-[#3a2a1c]'} ${isDimmed ? 'opacity-35' : 'opacity-100'} ${isFocused ? 'ring-2 ring-[#b9782b] ring-offset-2 ring-offset-[#0d0c0b]' : ''}`}
                      style={{ left: box.x, top: box.y, width: box.w, height: box.h, borderColor: isSelected ? '#efe2bd' : meta.color }}
                    >
                      <div className="flex h-7 shrink-0 items-center justify-between gap-2 px-3 font-mono text-[8px] uppercase tracking-widest text-white" style={{ background: meta.color }}>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span data-testid={`manager-flow-node-logo-${node.id}`} className="inline-flex shrink-0"><Icon size={13} /></span>
                          <span className="truncate">{compactText(graphText(node.categoryLabel || meta.label, '流程记录'), 18)}</span>
                        </span>
                        {node.clusterCount > 1 ? (
                          <span data-testid={`manager-flow-cluster-count-${node.id}`} className="shrink-0 border border-white/45 px-1.5 py-0.5">{node.clusterCount} {projectText('commits')}</span>
                        ) : (
                          <span className="max-w-[46%] shrink-0 truncate opacity-85">{compactText(graphText(node.subtypeLabel || node.subtype, '记录'), 24)}</span>
                        )}
                      </div>
                      <div className="min-h-0 flex-1 overflow-hidden px-3 py-1.5">
                        <div className="max-h-[34px] overflow-hidden break-words font-serif text-sm leading-snug text-[#efe2bd]">{graphText(commitMessage, graphText(node.title, '流程记录'))}</div>
                        <div data-testid={`manager-flow-node-time-${node.id}`} className="mt-1 truncate font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">
                          {graphTime(node.time)}
                        </div>
                        {showDetail && (
                          <div className="mt-1 truncate font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                            {compactText(graphText(node.displayTitle || node.title, ''), 38)} / {graphText(node.statusLabel || node.status, '已记录')}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#2a2118] bg-[#0d0c0b]/78 px-3 py-1.5">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">{graphText(committersLabel(node), '项目成员')}</div>
                          <div className="truncate font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                            {artifactTypeLabel ? `${graphText(artifactTypeLabel, '项目产物')} / ` : ''}{graphText(primarySubmitter.role, '项目成员')} / {attachmentCount} {projectText('ATTACHMENTS')}
                          </div>
                        </div>
                        <span className={`node-status-tag shrink-0 ${node.status === 'blocked' ? 'bg-[#8f1e18] text-white' : node.status === 'confirmed' ? 'bg-green-700 text-white' : node.status === 'resolved' ? 'bg-[#59684b] text-white' : 'bg-[#3a2a1c] text-[#bcae86]'}`}>
                          {graphText(node.importanceLabel || node.importance, '普通')}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
  
            {selectedNode && (
            <aside className="w-[430px] shrink-0 border-l border-[#2a2118] bg-[#141210]/98 flex flex-col">
                <>
                  <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          data-testid={`manager-flow-node-logo-${selectedNode.id}-detail`}
                          className="flex h-12 w-12 shrink-0 items-center justify-center border text-white shadow-[4px_4px_0_rgba(0,0,0,0.3)]"
                          style={{ backgroundColor: selectedNodeMeta.color, borderColor: selectedNode.visual?.color || selectedNodeMeta.color }}
                        >
                          <SelectedNodeIcon size={22} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">{graphText(selectedNode.categoryLabel || selectedNode.category, '流程记录')} / {graphText(selectedNode.subtypeLabel || selectedNode.subtype, '记录')}</div>
                          <h3 className="mt-2 font-serif text-2xl leading-tight text-[#efe2bd]">{graphText(selectedNode.displayTitle || selectedNode.title, '')}</h3>
                        </div>
                      </div>
                      <button type="button" data-testid="manager-flow-detail-close" onClick={() => setSelectedTimelineEventId(null)} className="text-[#7d6a49] hover:text-[#efe2bd]"><X size={16} /></button>
                    </div>
                    <div data-testid="timeline-node-agent-description" className="border-l-2 pl-3" style={{ borderColor: selectedNode.visual?.color || selectedNodeMeta.color }}>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                        {projectText('Agent Description')} / {projectText(selectedNode.descriptionSource === 'runtime-fallback' ? 'runtime fallback' : 'agent authored')}
                      </div>
                      <p className="mt-1 font-serif text-sm leading-relaxed text-[#bcae86]">{graphText(selectedNode.description || selectedNode.summary, `此${graphText(selectedNode.categoryLabel || selectedNode.category, '流程')}记录的详细说明`)}</p>
                    </div>
  
                    <div data-testid="timeline-node-metadata-detail" className="tl-detail-section">
                      <div className="tl-detail-section-title">{projectText('Node Metadata')}</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {[
                          ['ID', selectedNode.id],
                          ['Status', selectedNode.statusLabel || selectedNode.status, '已记录'],
                          ['Importance', selectedNode.importanceLabel || selectedNode.importance, '普通'],
                          ['Semantic Level', selectedNode.semanticLabel || selectedNode.semanticLevel],
                          ['Submitted By', committersLabel(selectedNode) === 'Project' ? 'Project role' : committersLabel(selectedNode)],
                          ['Submitter Role', nodeCommitters(selectedNode)[0]?.role === 'Project'
                            ? 'Project role'
                            : nodeCommitters(selectedNode)[0]?.role || 'Project role'],
                          ['Task', selectedNode.taskId || 'none', selectedNode.taskId ? selectedNode.taskId : '无'],
                          ['Source', selectedNode.sourceLabel || selectedNode.source, '系统来源'],
                          ['Source Channel', channelNameById[selectedNode.sourceChannelId] || selectedNode.sourceChannelId || 'timeline', '时间线'],
                          ['Receipts', selectedNode.receiptCount ? `${selectedNode.receiptCount} seen` : 'no receipt count', selectedNode.receiptCount ? `${selectedNode.receiptCount} 条已读回执` : '无回执计数'],
                          ['Direct Targets', (selectedNode.directTargetIds || []).map(id => activeProject.team.find(agent => agent.id === id)?.name || id).join(' / ') || 'none'],
                          ['Time', graphTime(selectedNode.time)],
                          ['Proof IDs', (selectedNode.proofIds || []).length],
                        ].map(([label, value, fallback]) => (
                          <div key={label} className="min-w-0">
                            <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{projectText(label)}</div>
                            <div className="font-mono text-[9px] uppercase tracking-widest text-[#bcae86] break-words">{graphText(value, fallback || '系统记录')}</div>
                          </div>
                        ))}
                      </div>
                    </div>
  
                    <div data-testid="manager-flow-selected-proof-route" className="tl-detail-section border border-[#2a2118] bg-[#0d0c0b]/55 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{projectText('Proof Map / API Route')}</div>
                          <div className="mt-1 break-words font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">
                            {selectedNodeProofRoute || projectText('Backend proof route not linked yet')}
                          </div>
                          <div data-testid="manager-flow-selected-proof-map-coverage" className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                            {projectText('Coverage')}: {graphText(selectedNodeProofMapKey, '路由')} / {projectText('matches')} {selectedNodeProofMapRoutes.length} / {projectText('chat')} {selectedChatProofIds.length} / {projectText('timeline')} {(selectedNode.timelineLogIds || []).length} / {projectText('ledger')} {(selectedNode.eventIds || []).length}
                          </div>
                          {selectedNodeHasSubmissionRecord && (
                            <div data-testid="manager-flow-selected-submission-route" className="mt-1 break-words font-mono text-[7px] uppercase tracking-widest text-[#59684b]">
                              {projectText('Submission')}: {selectedNodeSubmissionRoute || `/projects/${activeProject.id}/submissions/${selectedNodeSubmissionId}`}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            data-testid="manager-flow-selected-submission-record-open"
                            onClick={openSelectedNodeSubmissionRecord}
                            disabled={!selectedNodeHasSubmissionRecord}
                            className="inline-flex items-center gap-1 border border-[#3a2a1c] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-40"
                          >
                            <FileText size={11} /> {projectText('Submission Record')}
                          </button>
                          <button
                            type="button"
                            data-testid="manager-flow-selected-proof-route-open"
                            onClick={openSelectedNodeProofMapRoute}
                            disabled={!selectedNodeProofRoute}
                            className="inline-flex items-center gap-1 border border-[#3a2a1c] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-40"
                          >
                            <Network size={11} /> {projectText('Proof Map')}
                          </button>
                        </div>
                      </div>
                    </div>
  
                    <div className="tl-detail-section">
                      <div className="tl-detail-section-title">{projectText('Submission Packet')}</div>
                      <div data-testid="timeline-node-submission-quality" className="mb-3 grid grid-cols-2 gap-2">
                        <div className="border border-[#2a2118] bg-[#0d0c0b]/45 p-3">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{projectText('Completeness')}</div>
                          <div className="mt-1 font-serif text-2xl text-[#efe2bd]">{selectedSubmissionQuality?.completenessScore ?? 0}%</div>
                          <div className={`mt-1 font-mono text-[8px] uppercase tracking-widest ${selectedSubmissionQuality?.readyForTimeline ? 'text-[#59684b]' : 'text-[#8f1e18]'}`}>
                            {projectText(selectedSubmissionQuality?.readyForTimeline ? 'Ready for Timeline' : 'Needs fields')}
                          </div>
                        </div>
                        <div data-testid="timeline-node-authorship-mode" className="border border-[#2a2118] bg-[#0d0c0b]/45 p-3">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{projectText('Authorship')}</div>
                          <div className="mt-1 font-serif text-lg capitalize text-[#efe2bd]">{graphText(selectedSubmissionQuality?.authorshipMode || 'projected', '预计')}</div>
                          <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                            {graphText((selectedSubmissionQuality?.missingFieldIds || []).join(' / ') || 'all required fields filled', '所有必填字段均已填写')}
                          </div>
                        </div>
                      </div>
                      <div className="border border-[#2a2118] bg-[#0d0c0b]/45 p-3">
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{projectText('Agent Intent')}</div>
                        <p className="mt-1 font-serif text-sm leading-relaxed text-[#d8c99f]">
                          {graphText(selectedNode.submission?.intent || 'Agent submitted this workflow commit for manager review.', '智能体已提交此流程记录，等待经理复核。')}
                        </p>
                        {selectedContributionIntent && (
                          <div data-testid="timeline-node-contribution-intent" className="mt-3 border border-[#3a2a1c] bg-[#141210]/75 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{projectText('Publication Decision')}</div>
                              <span className={`node-status-tag ${selectedContributionIntent.decision === 'submit' ? 'bg-[#59684b] text-white' : selectedContributionIntent.decision === 'defer' ? 'bg-[#b9782b] text-white' : 'bg-[#3a2a1c] text-[#bcae86]'}`}>
                                {graphText(selectedContributionIntent.decision || 'projected', '预计')}
                              </span>
                            </div>
                            <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">
                              {graphText(selectedContributionIntent.reasonCode || 'runtime-publication', '运行时发布')}
                            </div>
                            <p className="mt-2 font-serif text-sm leading-relaxed text-[#d8c99f]">
                              {graphText(selectedContributionIntent.whyNow || 'No explicit publication rationale was recorded.', '尚未记录明确的发布理由。')}
                            </p>
                            <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                              <span>{projectText('Value')}: {graphText(selectedContributionIntent.expectedValue || 'not recorded', '未记录')}</span>
                              <span>{projectText('Duplicate risk')}: {graphText(selectedContributionIntent.duplicationRisk?.level || 'not evaluated', '未评估')}</span>
                            </div>
                            {(selectedContributionIntent.evidencePlan || []).length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {selectedContributionIntent.evidencePlan.map(item => (
                                  <span key={item} className="border border-[#3a2a1c] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">
                                    {graphText(item, '证据计划')}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="mt-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{projectText('Commit Message')}</div>
                        <p className="mt-1 font-serif text-sm leading-relaxed text-[#efe2bd]">
                          {graphText(selectedNode.displayTitle || selectedNode.submission?.commitMessage || selectedNode.commitMessage || selectedNode.summary, graphText(selectedNode.title, ''))}
                        </p>
                        {selectedThinkingFrame && (
                          <div className="mt-3 border-t border-[#2a2118] pt-3">
                            <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{projectText('Thinking Framework')}</div>
                            <div className="mt-1 font-serif text-sm leading-tight text-[#d8c99f]">
                              {graphText(selectedThinkingFrame.routineLabel || selectedThinkingFrame.routineId || 'Agent work routine', '智能体工作流程')}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(selectedThinkingFrame.checklist || []).slice(0, 5).map(item => (
                                <span key={item} className="border border-[#3a2a1c] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">
                                  {graphText(item, '流程检查项')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="border border-[#2a2118] bg-[#0d0c0b]/45 p-2">
                          <div className="mb-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{projectText('Filled By Agent')}</div>
                          <div className="space-y-1">
                            {(selectedNode.submission?.requiredFields || []).map(field => (
                              <div key={field.id} className="flex items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-widest">
                                <span className="truncate text-[#bcae86]">{graphText(field.label, '字段')}</span>
                                <span className={field.status === 'missing' ? 'text-[#8f1e18]' : 'text-[#59684b]'}>{graphText(field.status, '已填写')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="border border-[#2a2118] bg-[#0d0c0b]/45 p-2">
                          <div className="mb-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{projectText('Auto Generated')}</div>
                          <div className="space-y-1">
                            {(selectedNode.submission?.autoFields || []).map(field => (
                              <div key={field.id} className="flex items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-widest">
                                <span className="truncate text-[#bcae86]">{graphText(field.label, '字段')}</span>
                                <span className="text-[#59684b]">{graphText(field.status, '已填写')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div data-testid="timeline-node-attachments" className="mt-3 space-y-2">
                        {(selectedNode.attachments || []).map(attachment => {
                          const attachmentChatProofIds = chatProofIdsFromAttachment(attachment);
                          const attachmentChannelId = attachment.providerEvidenceTranscriptRoute?.match(/\/transcripts\/([^#/?]+)/)?.[1]
                            || attachment.channelId
                            || selectedNode.channelId
                            || 'main';
                          return (
                            <div
                              key={attachment.id}
                              data-testid={`manager-flow-detail-attachment-${String(attachment.type || 'attachment').replace(/[^a-zA-Z0-9_-]/g, '-')}`}
                              className="border border-[#2a2118] bg-[#0d0c0b]/45 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{graphText(attachment.type, '证据附件')}</div>
                                  <div className="mt-1 font-serif text-sm leading-tight text-[#efe2bd]">{graphText(attachment.title, '证据附件')}</div>
                                </div>
                                <span className={`node-status-tag shrink-0 ${attachment.autoGenerated ? 'bg-[#3a2a1c] text-[#bcae86]' : 'bg-[#59684b] text-white'}`}>
                                  {projectText(attachment.autoGenerated ? 'auto' : 'agent')}
                                </span>
                              </div>
                              <p className="mt-2 font-serif text-xs leading-relaxed text-[#bcae86]">{graphText(attachment.summary, '此附件提供该流程记录的支撑证据。')}</p>
                              {renderAutonomousActionDecision(attachment.autonomousActionDecision, {
                                testId: `manager-flow-autonomous-action-decision-${String(attachment.id || attachment.type || 'attachment').replace(/[^a-zA-Z0-9_-]/g, '-')}`,
                                dark: true,
                                text: (value) => graphText(value, '智能体动作'),
                              })}
                              {(attachment.url || attachment.absolutePath || attachment.path || attachment.relativePath || attachment.route || attachmentChatProofIds.length) && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {(attachment.url || attachment.absolutePath || attachment.path || attachment.relativePath || attachment.route) && (
                                    <>
                                      <button
                                        type="button"
                                        data-testid={`flow-open-artifact-${attachment.id}`}
                                        onClick={() => {
                                          const target = attachment.url || (attachment.absolutePath || attachment.path || attachment.route || '').replace(/\\/g, '/');
                                          if (target) window.open(target.startsWith('file:') || target.startsWith('http') ? target : `file://${target}`, '_blank', 'noopener,noreferrer');
                                        }}
                                        className="border border-[#3a2a1c] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd]"
                                      >
                                        {projectText('Open artifact')}
                                      </button>
                                      <button
                                        type="button"
                                        data-testid={`flow-locate-artifact-${attachment.id}`}
                                        onClick={() => navigator.clipboard?.writeText(attachment.absolutePath || attachment.path || attachment.relativePath || attachment.route || '')}
                                        className="border border-[#3a2a1c] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd]"
                                      >
                                        {projectText('Locate artifact')}
                                      </button>
                                    </>
                                  )}
                                  {attachmentChatProofIds.length > 0 && (
                                    <button
                                      type="button"
                                      data-testid={`flow-open-transcript-${attachment.id}`}
                                      onClick={() => openProjectChatProof(activeProject, attachmentChatProofIds, attachmentChannelId)}
                                      className="inline-flex items-center gap-1 border border-[#3a2a1c] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd]"
                                    >
                                      <MessageSquare size={9} /> {projectText('Transcript proof')}
                                    </button>
                                  )}
                                </div>
                              )}
                              {attachment.providerEvidenceTranscriptRoute && (
                                <div className="mt-2 break-words font-mono text-[7px] uppercase tracking-widest text-[#59684b]">
                                  {projectText('Transcript route')}: {attachment.providerEvidenceTranscriptRoute}
                                </div>
                              )}
                              <div className="mt-2 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                                {projectText('proof')} {(attachment.proofIds || []).length} / {projectText('timeline')} {(attachment.timelineLogIds || []).length} / {projectText('ledger')} {(attachment.eventIds || []).length}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
  
                    <div data-testid="timeline-node-relationship-graph" className="tl-detail-section">
                      <div className="tl-detail-section-title">{projectText('Task Relationship Graph')}</div>
                      {connectedPeople.length ? (
                        <div className="border border-[#2a2118] bg-[#0d0c0b]/45 p-2">
                          <svg viewBox={`0 0 ${relationshipGraph.width} ${relationshipGraph.height}`} className="h-[250px] w-full">
                            <defs>
                              <marker id="person-relation-dot" markerWidth="6" markerHeight="6" refX="3" refY="3">
                                <circle cx="3" cy="3" r="2.2" fill="#7b6542" />
                              </marker>
                            </defs>
                            {relationshipGraph.people.map(person => {
                              const mx = (relationshipGraph.center.x + person.x) / 2;
                              const my = (relationshipGraph.center.y + person.y) / 2;
                              return (
                                <g key={`relation-edge-${person.id}`}>
                                  <line
                                    x1={relationshipGraph.center.x}
                                    y1={relationshipGraph.center.y}
                                    x2={person.x}
                                    y2={person.y}
                                    stroke="#7b6542"
                                    strokeWidth="1.2"
                                    markerEnd="url(#person-relation-dot)"
                                    opacity="0.82"
                                  />
                                  <text x={mx} y={my - 5} textAnchor="middle" className="fill-[#bcae86] font-mono text-[8px] uppercase tracking-widest">
                                    {graphText(person.relation, '关联')}
                                  </text>
                                </g>
                              );
                            })}
                            <g>
                              <rect x={relationshipGraph.center.x - 58} y={relationshipGraph.center.y - 28} width="116" height="56" fill="#141210" stroke="#efe2bd" />
                              <text x={relationshipGraph.center.x} y={relationshipGraph.center.y - 4} textAnchor="middle" className="fill-[#efe2bd] font-serif text-[13px]">
                                {projectText('Commit')}
                              </text>
                              <text x={relationshipGraph.center.x} y={relationshipGraph.center.y + 13} textAnchor="middle" className="fill-[#7d6a49] font-mono text-[7px] uppercase tracking-widest">
                                {graphText(selectedNode.categoryLabel || selectedNode.category, '流程')}
                              </text>
                            </g>
                            {relationshipGraph.people.map(person => (
                              <g key={`relation-person-${person.id}`}>
                                <rect x={person.x - 48} y={person.y - 22} width="96" height="44" fill="#141210" stroke={person.accent} />
                                <text x={person.x} y={person.y - 3} textAnchor="middle" className="fill-[#efe2bd] font-serif text-[12px]">
                                  {graphText(person.name, '项目成员')}
                                </text>
                                <text x={person.x} y={person.y + 13} textAnchor="middle" className="fill-[#7d6a49] font-mono text-[7px] uppercase tracking-widest">
                                  {graphText(person.role, '项目成员')}
                                </text>
                              </g>
                            ))}
                          </svg>
                        </div>
                      ) : (
                        <div className="border border-dashed border-[#2a2118] p-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                          {projectText('No connected employee recorded for this node.')}
                        </div>
                      )}
                    </div>
  
                    <div className="tl-detail-section">
                      <div className="tl-detail-section-title">{projectText('Evidence')}</div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          ['Chat', selectedChatProofIds.length],
                          ['Timeline', (selectedNode.timelineLogIds || []).length],
                          ['Ledger', (selectedNode.eventIds || []).length],
                        ].map(([label, value]) => (
                          <div key={label} className="border border-[#2a2118] bg-[#0d0c0b]/55 px-2 py-2">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText(label)}</div>
                            <div className="font-serif text-lg leading-tight">{value}</div>
                          </div>
                        ))}
                      </div>
                      <div data-testid="manager-flow-selected-proof-route-evidence" className="mt-3 border border-[#2a2118] bg-[#0d0c0b]/55 p-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{projectText('Proof Map / API Route')}</div>
                            <div className="mt-1 break-words font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">
                              {selectedNodeProofRoute || projectText('Backend proof route not linked yet')}
                            </div>
                            <div data-testid="manager-flow-selected-proof-map-coverage" className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                              {projectText('Coverage')}: {graphText(selectedNodeProofMapKey, '路由')} / {projectText('matches')} {selectedNodeProofMapRoutes.length} / {projectText('chat')} {selectedChatProofIds.length} / {projectText('timeline')} {(selectedNode.timelineLogIds || []).length} / {projectText('ledger')} {(selectedNode.eventIds || []).length}
                            </div>
                            {selectedNodeHasSubmissionRecord && (
                              <div data-testid="manager-flow-selected-submission-route-evidence" className="mt-1 break-words font-mono text-[7px] uppercase tracking-widest text-[#59684b]">
                                {projectText('Submission')}: {selectedNodeSubmissionRoute || `/projects/${activeProject.id}/submissions/${selectedNodeSubmissionId}`}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid="manager-flow-selected-submission-record-open-evidence"
                              onClick={openSelectedNodeSubmissionRecord}
                              disabled={!selectedNodeHasSubmissionRecord}
                              className="inline-flex items-center gap-1 border border-[#3a2a1c] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-40"
                            >
                              <FileText size={11} /> {projectText('Submission Record')}
                            </button>
                            <button
                              type="button"
                              data-testid="manager-flow-selected-proof-route-open-evidence"
                              onClick={openSelectedNodeProofMapRoute}
                              disabled={!selectedNodeProofRoute}
                              className="inline-flex items-center gap-1 border border-[#3a2a1c] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-40"
                            >
                              <Network size={11} /> {projectText('Proof Map')}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openProjectChatProof(activeProject, selectedChatProofIds, selectedNode.channelId || 'main')}
                          disabled={!selectedChatProofIds.length}
                          className="inline-flex items-center gap-1 border border-[#3a2a1c] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-40"
                        >
                          <MessageSquare size={11} /> {projectText('Chat Proof')}
                        </button>
                        <button
                          type="button"
                          onClick={() => openProjectTimelineProof(selectedNode.timelineLogIds || [])}
                          disabled={!(selectedNode.timelineLogIds || []).length}
                          className="inline-flex items-center gap-1 border border-[#3a2a1c] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-40"
                        >
                          <ScrollText size={11} /> {projectText('Timeline Proof')}
                        </button>
                      </div>
                    </div>
  
                    <div className="tl-detail-section">
                      <div className="tl-detail-section-title">{projectText('Relationships')}</div>
                      <div className="space-y-2">
                        {relatedEdges.map(edge => {
                          const otherId = edge.fromNodeId === selectedNode.id ? edge.toNodeId : edge.fromNodeId;
                          const otherNode = nodeMap[otherId];
                          return (
                            <button
                              type="button"
                              key={edge.id}
                              onClick={() => otherNode && setSelectedTimelineEventId(otherNode.id)}
                              className="w-full border border-[#2a2118] bg-[#0d0c0b]/45 p-2 text-left hover:border-[#7b6542]"
                            >
                              <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{graphText(edgeMeta[edge.type]?.label || edge.type, '关联')}</div>
                              <div className="font-serif text-sm leading-tight text-[#d8c99f]">{graphText(otherNode?.title || otherId, '关联流程记录')}</div>
                            </button>
                          );
                        })}
                        {!relatedEdges.length && (
                          <div className="border border-dashed border-[#2a2118] p-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                            {projectText('No visible relationship at this zoom level.')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 border-t border-[#2a2118] px-5 py-3">
                    <div className="mb-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                      {projectText('Confirmation')}: {selectedNode.confirmation?.confirmedAt ? graphTime(selectedNode.confirmation.confirmedAt) : projectText('not confirmed by user')}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => confirmManagerFlowNode(selectedNode.id, true)}
                        disabled={!backendCommandAvailable || backendStation.loading || selectedNode.status === 'confirmed'}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 border border-[#59684b] bg-[#59684b] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-white disabled:opacity-40"
                      >
                        <CheckCircle2 size={12} /> {projectText('Confirm Valid Work')}
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmManagerFlowNode(selectedNode.id, false)}
                        disabled={!backendCommandAvailable || backendStation.loading}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 border border-[#3a2a1c] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] hover:border-[#8f1e18] disabled:opacity-40"
                      >
                        <X size={12} /> {projectText('Supersede')}
                      </button>
                    </div>
                  </div>
                </>
            </aside>
            )}
          </div>
        </div>
      );
};

export default AdvancedProjectTimeline;
