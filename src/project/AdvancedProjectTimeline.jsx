import { useLayoutEffect, useRef } from 'react';

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
    graphTime,
    handleGraphMouseDown,
    handleGraphMouseMove,
    handleGraphWheel,
    handleGraphZoomChange,
    isProofFocused,
    managerFlowGraph,
    managerFlowGraphSourceLabel,
    laneGuides,
    nodeCommitters,
    nodeLayout,
    nodeMap,
    openProjectChatProof,
    openProjectTimelineProof,
    projectText,
    openSelectedNodeProofMapRoute,
    openSelectedNodeSubmissionRecord,
    relatedEdges,
    relatedNodeIds,
    relationshipGraph,
    renderAutonomousActionDecision,
    resetGraphView,
    rulerHeight,
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
    timeTicks,
    timelineViewportRef,
    tlDragging,
    tlPan,
    tlZoom,
    visibleEdges,
    visibleNodes,
    visibleNodesByPosition,
    visibleTimelineProofCount,
    xOffset,
    zoomDetail,
    zoomScale,
  } = view;

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

  const previousZoomScaleRef = useRef(zoomScale);
  useLayoutEffect(() => {
    if (previousZoomScaleRef.current === zoomScale) return;
    previousZoomScaleRef.current = zoomScale;
    const targetNode = selectedNode || [...visibleNodes].sort((a, b) => (
      (Date.parse(b.time) || 0) - (Date.parse(a.time) || 0) || (b.sequence || 0) - (a.sequence || 0)
    ))[0];
    if (targetNode) focusGraphNode(targetNode.id);
  }, [zoomScale]);

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
                  <span className="text-[#efe2bd]">Manager Flow Graph</span>
                  <span className="ml-3 text-[#7d6a49]">Single-Axis Timeline</span>
                </div>
              </div>
              <div className="flex max-w-[70%] flex-wrap items-center justify-end gap-2">
                <span
                  data-testid="manager-flow-source-label"
                  className={`node-status-tag ${managerFlowGraph.frontendMockSuppressed ? 'bg-[#8f1e18] text-white' : managerFlowGraph.dataSource === 'frontend-fallback' ? 'bg-[#b9782b] text-white' : 'bg-[#59684b] text-white'}`}
                >
                  {managerFlowGraphSourceLabel}
                </span>
                <button
                  type="button"
                  onClick={() => syncBackendManagerFlowGraph({ silent: false })}
                  disabled={!backendCommandAvailable || backendStation.loading}
                  className="inline-flex items-center gap-1.5 border border-[#3a2a1c] px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-40"
                >
                  <Database size={12} /> Sync Graph
                </button>
                <label className="flex items-center gap-2 border border-[#3a2a1c] bg-[#141210]/85 px-3 py-1.5">
                  <span className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">Zoom</span>
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
                  <span className="w-16 text-right font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">{Math.round(tlZoom * 100)}% / {projectText(scaleProfiles[zoomScale]?.label)}</span>
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
                  Reset
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
                    {meta.label}
                  </span>
                );
              })}
            </div>
            <div data-testid="manager-flow-semantic-scale-guide" className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#2a2118] pt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
              <span className="text-[#bcae86]">{projectText(`${scaleProfiles[zoomScale]?.label} View`)}</span>
              <span>{scaleProfiles[zoomScale]?.description}</span>
              <span>{visibleNodes.length} / {(managerFlowGraph.nodes || []).length} nodes visible</span>
            </div>
          </div>
  
          <div className="relative z-10 flex-1 flex overflow-hidden">
            <div
              className={`relative flex-1 overflow-hidden ${tlDragging ? '' : 'tl-canvas-grab'}`}
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
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                    <div className="font-serif text-xl leading-tight">{value}</div>
                  </div>
                ))}
              </div>
              {focusedTimelineProofIds.length > 0 && (
                <div data-testid="timeline-evidence-detail" className="absolute left-5 top-[118px] z-40 border border-[#b9782b] bg-[#251b13]/95 px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#efe2bd] shadow-lg">
                  Timeline proof focus: {visibleTimelineProofCount}/{focusedTimelineProofIds.length}
                  <span className="sr-only">Source Channel Receipts Direct Targets</span>
                  <button type="button" onClick={() => setFocusedTimelineProofIds([])} className="ml-3 text-[#bcae86] hover:text-white">Clear</button>
                </div>
              )}
              {managerFlowGraph.frontendMockSuppressed && (
                <div data-testid="manager-flow-backend-required" className="absolute left-5 top-[118px] z-40 max-w-xl border border-[#8f1e18] bg-[#251b13]/95 px-4 py-3 shadow-lg">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#efe2bd]">Backend flow graph missing</div>
                  <div className="mt-2 font-serif text-sm leading-relaxed text-[#d8c99f]">
                    This real project is connected to the backend, so frontend-generated flow nodes are suppressed until `/manager-flow-graph` returns a read model.
                  </div>
                  <button
                    type="button"
                    data-testid="manager-flow-backend-required-sync"
                    onClick={() => syncBackendManagerFlowGraph({ silent: false })}
                    disabled={!backendCommandAvailable || backendStation.loading}
                    className="mt-3 inline-flex items-center gap-1.5 border border-[#8f1e18] px-3 py-1.5 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:border-[#d8c99f] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Database size={11} /> Sync Graph
                  </button>
                </div>
              )}
  
              <div
                className="relative"
                data-testid="manager-flow-graph"
                style={{
                  width: canvasW,
                  height: canvasH,
                  transform: `translate(${tlPan.x}px, ${tlPan.y}px) scale(${tlZoom})`,
                  transformOrigin: '0 0',
                  transition: tlDragging ? 'none' : 'transform 0.24s cubic-bezier(0.25,0.8,0.25,1)',
                }}
              >
                <div data-testid="manager-flow-time-ruler" className="absolute left-0 right-0 top-0 border-b border-[#3a2a1c] bg-[#0d0c0b]/88" style={{ height: rulerHeight }}>
                  <div className="absolute left-5 top-5 font-mono text-[9px] uppercase tracking-[0.24em] text-[#bcae86]">{projectText('Commit Timeline')}</div>
                  <div className="absolute border-t border-[#7b6542]/75" style={{ left: xOffset - 32, top: 72, width: canvasW - xOffset + 4 }} />
                  {timeTicks.map(tick => (
                    <div key={`flow-time-tick-${tick.key}`} className="absolute" style={{ left: tick.x, top: 66 }}>
                      <div className="h-3 border-l border-[#7b6542]" />
                      <div className="mt-1 -translate-x-1/2 whitespace-nowrap border border-[#3a2a1c] bg-[#141210]/92 px-2 py-1 text-center font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">
                        <span className="block text-[#efe2bd]">{tick.dateLabel} · {tick.timeLabel}</span>
                        <span className="block text-[#7d6a49]">{tick.count} {projectText('commits')}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div data-testid="manager-flow-timeline-lanes" className="absolute inset-0 pointer-events-none">
                  {laneGuides.map(lane => (
                    <div key={`timeline-lane-${lane.id}`} className="absolute left-0 right-0 border-t border-[#2a2118]/85" style={{ top: lane.y, height: lane.height }}>
                      <div className="absolute left-5 top-3 w-44 border-l-2 border-[#7b6542] bg-[#141210]/82 px-3 py-2 font-mono text-[8px] uppercase tracking-[0.2em] text-[#bcae86]">
                        {projectText(lane.label)}
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
                  {visibleEdges.map(edge => {
                    const anchor = getAnchor(edge);
                    if (!anchor) return null;
                    const isSelected = selectedNode && (edge.fromNodeId === selectedNode.id || edge.toNodeId === selectedNode.id);
                    const meta = edgeMeta[edge.type] || edgeMeta.task_dependency;
                    return (
                      <g key={edge.id}>
                        <path
                          d={anchor.path}
                          fill="none"
                          stroke={isSelected ? meta.color : '#3a2a1c'}
                          strokeWidth={isSelected ? 2 : 1}
                          strokeDasharray={edge.type === 'evidence' ? '5 5' : undefined}
                          markerEnd="url(#flow-arrow)"
                          opacity={selectedNode && !isSelected ? 0.18 : 0.78}
                        />
                        {isSelected && (
                          <circle r="3" fill="#efe2bd" opacity="0.85">
                            <animateMotion dur="2.6s" repeatCount="indefinite" path={anchor.path} />
                          </circle>
                        )}
                      </g>
                    );
                  })}
                </svg>
  
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
                  const commitMessage = compactText(node.commitMessage || node.summary || node.title, zoomDetail === 'compact' ? 72 : zoomDetail === 'medium' ? 92 : 118);
                  const fullCommitMessage = node.commitMessage || node.summary || node.title;
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
                      data-timeline-proof-ids={JSON.stringify([
                        node.id,
                        ...(node.proofIds || []),
                        ...(node.timelineLogIds || []),
                        ...(node.eventIds || []),
                      ])}
                      onClick={() => setSelectedTimelineEventId(isSelected ? null : node.id)}
                      title={fullCommitMessage}
                      className={`absolute flex flex-col overflow-hidden text-left border bg-[#141210]/96 shadow-[7px_7px_0_rgba(0,0,0,0.22)] transition-all ${isSelected ? 'z-30 border-[#efe2bd]' : isRelated ? 'z-20 border-[#7b6542]' : 'z-10 border-[#3a2a1c]'} ${isDimmed ? 'opacity-35' : 'opacity-100'} ${isFocused ? 'ring-2 ring-[#b9782b] ring-offset-2 ring-offset-[#0d0c0b]' : ''}`}
                      style={{ left: box.x, top: box.y, width: box.w, height: box.h, borderColor: isSelected ? '#efe2bd' : meta.color }}
                    >
                      <div className="flex h-7 shrink-0 items-center justify-between gap-2 px-3 font-mono text-[8px] uppercase tracking-widest text-white" style={{ background: meta.color }}>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span data-testid={`manager-flow-node-logo-${node.id}`} className="inline-flex shrink-0"><Icon size={13} /></span>
                          <span className="truncate">{compactText(node.categoryLabel || meta.label, 18)}</span>
                        </span>
                        {node.clusterCount > 1 ? (
                          <span data-testid={`manager-flow-cluster-count-${node.id}`} className="shrink-0 border border-white/45 px-1.5 py-0.5">{node.clusterCount} {projectText('commits')}</span>
                        ) : (
                          <span className="max-w-[46%] shrink-0 truncate opacity-85">{compactText(node.subtype, 24)}</span>
                        )}
                      </div>
                      <div className="min-h-0 flex-1 overflow-hidden px-3 py-1.5">
                        <div className="max-h-[34px] overflow-hidden break-words font-serif text-sm leading-snug text-[#efe2bd]">{projectText(commitMessage)}</div>
                        <div data-testid={`manager-flow-node-time-${node.id}`} className="mt-1 truncate font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">
                          {graphTime(node.time)}
                        </div>
                        {showDetail && (
                          <div className="mt-1 truncate font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                            {compactText(node.title, 38)} / {node.status}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#2a2118] bg-[#0d0c0b]/78 px-3 py-1.5">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">{committersLabel(node)}</div>
                          <div className="truncate font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                            {artifactTypeLabel ? `${artifactTypeLabel} / ` : ''}{projectText(primarySubmitter.role)} / {attachmentCount} {projectText('ATTACHMENTS')}
                          </div>
                        </div>
                        <span className={`node-status-tag shrink-0 ${node.status === 'blocked' ? 'bg-[#8f1e18] text-white' : node.status === 'confirmed' ? 'bg-green-700 text-white' : node.status === 'resolved' ? 'bg-[#59684b] text-white' : 'bg-[#3a2a1c] text-[#bcae86]'}`}>
                          {projectText(node.importance)}
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
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">{projectText(selectedNode.categoryLabel || selectedNode.category)} / {projectText(selectedNode.subtype)}</div>
                          <h3 className="mt-2 font-serif text-2xl leading-tight text-[#efe2bd]">{projectText(selectedNode.title)}</h3>
                        </div>
                      </div>
                      <button type="button" data-testid="manager-flow-detail-close" onClick={() => setSelectedTimelineEventId(null)} className="text-[#7d6a49] hover:text-[#efe2bd]"><X size={16} /></button>
                    </div>
                    <div data-testid="timeline-node-agent-description" className="border-l-2 pl-3" style={{ borderColor: selectedNode.visual?.color || selectedNodeMeta.color }}>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                        Agent Description / {selectedNode.descriptionSource === 'runtime-fallback' ? 'runtime fallback' : 'agent authored'}
                      </div>
                      <p className="mt-1 font-serif text-sm leading-relaxed text-[#bcae86]">{projectText(selectedNode.description || selectedNode.summary)}</p>
                    </div>
  
                    <div data-testid="timeline-node-metadata-detail" className="tl-detail-section">
                      <div className="tl-detail-section-title">Node Metadata</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {[
                          ['ID', selectedNode.id],
                          ['Status', selectedNode.status],
                          ['Importance', selectedNode.importance],
                          ['Semantic Level', selectedNode.semanticLabel || selectedNode.semanticLevel],
                          ['Submitted By', committersLabel(selectedNode)],
                          ['Submitter Role', nodeCommitters(selectedNode)[0]?.role || 'Project'],
                          ['Task', selectedNode.taskId || 'none'],
                          ['Source', selectedNode.source],
                          ['Source Channel', channelNameById[selectedNode.sourceChannelId] || selectedNode.sourceChannelId || 'timeline'],
                          ['Receipts', selectedNode.receiptCount ? `${selectedNode.receiptCount} seen` : 'no receipt count'],
                          ['Direct Targets', (selectedNode.directTargetIds || []).map(id => activeProject.team.find(agent => agent.id === id)?.name || id).join(' / ') || 'none'],
                          ['Time', graphTime(selectedNode.time)],
                          ['Proof IDs', (selectedNode.proofIds || []).length],
                        ].map(([label, value]) => (
                          <div key={label} className="min-w-0">
                            <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{projectText(label)}</div>
                            <div className="font-mono text-[9px] uppercase tracking-widest text-[#bcae86] break-words">{projectText(value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
  
                    <div data-testid="manager-flow-selected-proof-route" className="tl-detail-section border border-[#2a2118] bg-[#0d0c0b]/55 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">Proof Map / API Route</div>
                          <div className="mt-1 break-words font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">
                            {selectedNodeProofRoute || 'Backend proof route not linked yet'}
                          </div>
                          <div data-testid="manager-flow-selected-proof-map-coverage" className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                            Coverage: {selectedNodeProofMapKey} / matches {selectedNodeProofMapRoutes.length} / chat {selectedChatProofIds.length} / timeline {(selectedNode.timelineLogIds || []).length} / ledger {(selectedNode.eventIds || []).length}
                          </div>
                          {selectedNodeHasSubmissionRecord && (
                            <div data-testid="manager-flow-selected-submission-route" className="mt-1 break-words font-mono text-[7px] uppercase tracking-widest text-[#59684b]">
                              Submission: {selectedNodeSubmissionRoute || `/projects/${activeProject.id}/submissions/${selectedNodeSubmissionId}`}
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
                            <FileText size={11} /> Submission Record
                          </button>
                          <button
                            type="button"
                            data-testid="manager-flow-selected-proof-route-open"
                            onClick={openSelectedNodeProofMapRoute}
                            disabled={!selectedNodeProofRoute}
                            className="inline-flex items-center gap-1 border border-[#3a2a1c] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-40"
                          >
                            <Network size={11} /> Proof Map
                          </button>
                        </div>
                      </div>
                    </div>
  
                    <div className="tl-detail-section">
                      <div className="tl-detail-section-title">Submission Packet</div>
                      <div data-testid="timeline-node-submission-quality" className="mb-3 grid grid-cols-2 gap-2">
                        <div className="border border-[#2a2118] bg-[#0d0c0b]/45 p-3">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">Completeness</div>
                          <div className="mt-1 font-serif text-2xl text-[#efe2bd]">{selectedSubmissionQuality?.completenessScore ?? 0}%</div>
                          <div className={`mt-1 font-mono text-[8px] uppercase tracking-widest ${selectedSubmissionQuality?.readyForTimeline ? 'text-[#59684b]' : 'text-[#8f1e18]'}`}>
                            {selectedSubmissionQuality?.readyForTimeline ? 'Ready for Timeline' : 'Needs fields'}
                          </div>
                        </div>
                        <div data-testid="timeline-node-authorship-mode" className="border border-[#2a2118] bg-[#0d0c0b]/45 p-3">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">Authorship</div>
                          <div className="mt-1 font-serif text-lg capitalize text-[#efe2bd]">{selectedSubmissionQuality?.authorshipMode || 'projected'}</div>
                          <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                            {(selectedSubmissionQuality?.missingFieldIds || []).join(' / ') || 'all required fields filled'}
                          </div>
                        </div>
                      </div>
                      <div className="border border-[#2a2118] bg-[#0d0c0b]/45 p-3">
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">Agent Intent</div>
                        <p className="mt-1 font-serif text-sm leading-relaxed text-[#d8c99f]">
                          {projectText(selectedNode.submission?.intent || 'Agent submitted this workflow commit for manager review.')}
                        </p>
                        {selectedContributionIntent && (
                          <div data-testid="timeline-node-contribution-intent" className="mt-3 border border-[#3a2a1c] bg-[#141210]/75 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">Publication Decision</div>
                              <span className={`node-status-tag ${selectedContributionIntent.decision === 'submit' ? 'bg-[#59684b] text-white' : selectedContributionIntent.decision === 'defer' ? 'bg-[#b9782b] text-white' : 'bg-[#3a2a1c] text-[#bcae86]'}`}>
                                {selectedContributionIntent.decision || 'projected'}
                              </span>
                            </div>
                            <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">
                              {selectedContributionIntent.reasonCode || 'runtime-publication'}
                            </div>
                            <p className="mt-2 font-serif text-sm leading-relaxed text-[#d8c99f]">
                              {selectedContributionIntent.whyNow || 'No explicit publication rationale was recorded.'}
                            </p>
                            <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                              <span>Value: {selectedContributionIntent.expectedValue || 'not recorded'}</span>
                              <span>Duplicate risk: {selectedContributionIntent.duplicationRisk?.level || 'not evaluated'}</span>
                            </div>
                            {(selectedContributionIntent.evidencePlan || []).length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {selectedContributionIntent.evidencePlan.map(item => (
                                  <span key={item} className="border border-[#3a2a1c] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">
                                    {item}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="mt-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">Commit Message</div>
                        <p className="mt-1 font-serif text-sm leading-relaxed text-[#efe2bd]">
                          {projectText(selectedNode.submission?.commitMessage || selectedNode.commitMessage || selectedNode.summary)}
                        </p>
                        {selectedThinkingFrame && (
                          <div className="mt-3 border-t border-[#2a2118] pt-3">
                            <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">Thinking Framework</div>
                            <div className="mt-1 font-serif text-sm leading-tight text-[#d8c99f]">
                              {selectedThinkingFrame.routineLabel || selectedThinkingFrame.routineId || 'Agent work routine'}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(selectedThinkingFrame.checklist || []).slice(0, 5).map(item => (
                                <span key={item} className="border border-[#3a2a1c] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="border border-[#2a2118] bg-[#0d0c0b]/45 p-2">
                          <div className="mb-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">Filled By Agent</div>
                          <div className="space-y-1">
                            {(selectedNode.submission?.requiredFields || []).map(field => (
                              <div key={field.id} className="flex items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-widest">
                                <span className="truncate text-[#bcae86]">{projectText(field.label)}</span>
                                <span className={field.status === 'missing' ? 'text-[#8f1e18]' : 'text-[#59684b]'}>{projectText(field.status)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="border border-[#2a2118] bg-[#0d0c0b]/45 p-2">
                          <div className="mb-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">Auto Generated</div>
                          <div className="space-y-1">
                            {(selectedNode.submission?.autoFields || []).map(field => (
                              <div key={field.id} className="flex items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-widest">
                                <span className="truncate text-[#bcae86]">{projectText(field.label)}</span>
                                <span className="text-[#59684b]">{projectText(field.status)}</span>
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
                                  <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{projectText(attachment.type)}</div>
                                  <div className="mt-1 font-serif text-sm leading-tight text-[#efe2bd]">{projectText(attachment.title)}</div>
                                </div>
                                <span className={`node-status-tag shrink-0 ${attachment.autoGenerated ? 'bg-[#3a2a1c] text-[#bcae86]' : 'bg-[#59684b] text-white'}`}>
                                  {projectText(attachment.autoGenerated ? 'auto' : 'agent')}
                                </span>
                              </div>
                              <p className="mt-2 font-serif text-xs leading-relaxed text-[#bcae86]">{projectText(attachment.summary)}</p>
                              {renderAutonomousActionDecision(attachment.autonomousActionDecision, {
                                testId: `manager-flow-autonomous-action-decision-${String(attachment.id || attachment.type || 'attachment').replace(/[^a-zA-Z0-9_-]/g, '-')}`,
                                dark: true,
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
                                        Open artifact
                                      </button>
                                      <button
                                        type="button"
                                        data-testid={`flow-locate-artifact-${attachment.id}`}
                                        onClick={() => navigator.clipboard?.writeText(attachment.absolutePath || attachment.path || attachment.relativePath || attachment.route || '')}
                                        className="border border-[#3a2a1c] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd]"
                                      >
                                        Locate artifact
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
                                      <MessageSquare size={9} /> Transcript proof
                                    </button>
                                  )}
                                </div>
                              )}
                              {attachment.providerEvidenceTranscriptRoute && (
                                <div className="mt-2 break-words font-mono text-[7px] uppercase tracking-widest text-[#59684b]">
                                  Transcript route: {attachment.providerEvidenceTranscriptRoute}
                                </div>
                              )}
                              <div className="mt-2 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                                proof {(attachment.proofIds || []).length} / timeline {(attachment.timelineLogIds || []).length} / ledger {(attachment.eventIds || []).length}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
  
                    <div data-testid="timeline-node-relationship-graph" className="tl-detail-section">
                      <div className="tl-detail-section-title">Task Relationship Graph</div>
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
                                    {projectText(person.relation)}
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
                                {projectText(selectedNode.category)}
                              </text>
                            </g>
                            {relationshipGraph.people.map(person => (
                              <g key={`relation-person-${person.id}`}>
                                <rect x={person.x - 48} y={person.y - 22} width="96" height="44" fill="#141210" stroke={person.accent} />
                                <text x={person.x} y={person.y - 3} textAnchor="middle" className="fill-[#efe2bd] font-serif text-[12px]">
                                  {person.name}
                                </text>
                                <text x={person.x} y={person.y + 13} textAnchor="middle" className="fill-[#7d6a49] font-mono text-[7px] uppercase tracking-widest">
                                  {projectText(person.role)}
                                </text>
                              </g>
                            ))}
                          </svg>
                        </div>
                      ) : (
                        <div className="border border-dashed border-[#2a2118] p-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                          No connected employee recorded for this node.
                        </div>
                      )}
                    </div>
  
                    <div className="tl-detail-section">
                      <div className="tl-detail-section-title">Evidence</div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          ['Chat', selectedChatProofIds.length],
                          ['Timeline', (selectedNode.timelineLogIds || []).length],
                          ['Ledger', (selectedNode.eventIds || []).length],
                        ].map(([label, value]) => (
                          <div key={label} className="border border-[#2a2118] bg-[#0d0c0b]/55 px-2 py-2">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                            <div className="font-serif text-lg leading-tight">{value}</div>
                          </div>
                        ))}
                      </div>
                      <div data-testid="manager-flow-selected-proof-route-evidence" className="mt-3 border border-[#2a2118] bg-[#0d0c0b]/55 p-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">Proof Map / API Route</div>
                            <div className="mt-1 break-words font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">
                              {selectedNodeProofRoute || 'Backend proof route not linked yet'}
                            </div>
                            <div data-testid="manager-flow-selected-proof-map-coverage" className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                              Coverage: {selectedNodeProofMapKey} / matches {selectedNodeProofMapRoutes.length} / chat {selectedChatProofIds.length} / timeline {(selectedNode.timelineLogIds || []).length} / ledger {(selectedNode.eventIds || []).length}
                            </div>
                            {selectedNodeHasSubmissionRecord && (
                              <div data-testid="manager-flow-selected-submission-route-evidence" className="mt-1 break-words font-mono text-[7px] uppercase tracking-widest text-[#59684b]">
                                Submission: {selectedNodeSubmissionRoute || `/projects/${activeProject.id}/submissions/${selectedNodeSubmissionId}`}
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
                              <FileText size={11} /> Submission Record
                            </button>
                            <button
                              type="button"
                              data-testid="manager-flow-selected-proof-route-open-evidence"
                              onClick={openSelectedNodeProofMapRoute}
                              disabled={!selectedNodeProofRoute}
                              className="inline-flex items-center gap-1 border border-[#3a2a1c] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-40"
                            >
                              <Network size={11} /> Proof Map
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
                          <MessageSquare size={11} /> Chat Proof
                        </button>
                        <button
                          type="button"
                          onClick={() => openProjectTimelineProof(selectedNode.timelineLogIds || [])}
                          disabled={!(selectedNode.timelineLogIds || []).length}
                          className="inline-flex items-center gap-1 border border-[#3a2a1c] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-40"
                        >
                          <ScrollText size={11} /> Timeline Proof
                        </button>
                      </div>
                    </div>
  
                    <div className="tl-detail-section">
                      <div className="tl-detail-section-title">Relationships</div>
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
                              <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{projectText(edgeMeta[edge.type]?.label || edge.type)}</div>
                              <div className="font-serif text-sm leading-tight text-[#d8c99f]">{projectText(otherNode?.title || otherId)}</div>
                            </button>
                          );
                        })}
                        {!relatedEdges.length && (
                          <div className="border border-dashed border-[#2a2118] p-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                            No visible relationship at this zoom level.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 border-t border-[#2a2118] px-5 py-3">
                    <div className="mb-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                      Confirmation: {selectedNode.confirmation?.confirmedAt ? graphTime(selectedNode.confirmation.confirmedAt) : 'not confirmed by user'}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => confirmManagerFlowNode(selectedNode.id, true)}
                        disabled={!backendCommandAvailable || backendStation.loading || selectedNode.status === 'confirmed'}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 border border-[#59684b] bg-[#59684b] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-white disabled:opacity-40"
                      >
                        <CheckCircle2 size={12} /> Confirm Valid Work
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmManagerFlowNode(selectedNode.id, false)}
                        disabled={!backendCommandAvailable || backendStation.loading}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 border border-[#3a2a1c] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] hover:border-[#8f1e18] disabled:opacity-40"
                      >
                        <X size={12} /> Supersede
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
