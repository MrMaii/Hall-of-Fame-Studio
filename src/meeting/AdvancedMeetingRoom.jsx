import { ChevronLeft, Clock, Mic2 } from 'lucide-react';
import { meetingDraftClaimsFloor } from './meetingFloorControl.js';
import { meetingMessageStatusLabel } from './meetingMessageState.js';

export default function AdvancedMeetingRoom({
  sceneTransition,
  meetingProject,
  closeMeeting,
  meetingTitle,
  isAnySpeaking,
  completeMeeting,
  canCompleteMeeting,
  formatTime,
  meetingElapsed,
  hideMeetingTelemetry,
  speakerAgent,
  getMeetingAvatarPos,
  teamCount,
  roomSpeaker,
  roomTranscript,
  speakerEntry,
  activeIntention,
  visibleQueue,
  usesCustomMeetingSubmit,
  initiationMeetingSession,
  projectMeetingCompletion,
  projectMeetingSession,
  projectMeetingSetupError,
  backendMeetingSendRequired,
  setSettingsTab,
  setSettingsOpen,
  speechRecognitionSupported,
  roomVoiceStatus,
  toggleRoomVoiceInput,
  roomInput,
  roomUserIntentActive,
  setRoomUserIntentActive,
  setRoomInput,
  canSendMeeting,
  submitMeetingInput,
  localizeText,
  activeLanguage,
}) {
  const text = (chinese, english) => activeLanguage === 'zh' ? chinese : english;
  const intentStatusText = (status) => status === 'listening' ? text('正在听取并形成判断', 'Listening and forming a view') : (
    status === 'speaking'
      ? text('发言中', 'Speaking')
      : status === 'yielded'
        ? text('已结束', 'Yielded')
        : text('排队中', 'Queued')
  );
  const intentTargetText = (target) => target === 'start the kickoff conversation'
    ? text('开始立项讨论', 'Start the kickoff conversation')
    : String(target || '');
  const interactionIntentText = (intent) => ({
    listen: text('听取', 'Listen'),
    consider: text('形成判断', 'Consider'),
    commit: text('承诺提交', 'Commit to submit'),
    support: text('支持', 'Support'),
    challenge: text('质疑', 'Challenge'),
    clarify: text('澄清', 'Clarify'),
    compete: text('竞选', 'Compete'),
    synthesize: text('综合', 'Synthesize'),
    escalate: text('上报', 'Escalate'),
    yield: text('让出发言', 'Yield'),
  }[intent] || localizeText(intent || '', activeLanguage));
  return (
      <div data-testid="project-meeting-room-stage" className="project-room relative h-screen overflow-hidden text-[#efe2bd]">
        {sceneTransition && <div className="absolute right-16 top-1/2 z-50 w-32 h-32 -translate-y-1/2 bg-[#8f1e18] scene-bubble" />}

        <div className="relative z-10 h-full flex flex-col">
          {/* Breadcrumb + Timer */}
          <header className="px-8 pt-5 pb-3 flex items-center justify-between shrink-0 z-40">
            <div className="flex items-center gap-4">
              <button data-testid="project-scene-back" aria-label={text('返回项目', 'Back to project')} onClick={closeMeeting}
                className="text-[#bcae86] hover:text-[#efe2bd] transition-colors"><ChevronLeft size={18} /></button>
              <div className="breadcrumb-bar text-[#bcae86]">
                <span>{meetingProject.name}</span>
                <span className="sep">/</span>
                <span className="text-[#efe2bd]">{meetingTitle}</span>
                <span className="sep">/</span>
                <span className={isAnySpeaking ? 'text-[#8f1e18]' : 'text-[#59684b]'}>{isAnySpeaking ? text('会议进行中', 'Meeting active') : text('等待中', 'Standing by')}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {completeMeeting && (
                <button
                  data-testid="project-meeting-complete"
                  onClick={completeMeeting}
                  disabled={!canCompleteMeeting}
                  title={!canCompleteMeeting ? text('至少完成一轮讨论，并等待所有参会者发言结束。', 'Complete one discussion round and wait for every attendee to finish.') : ''}
                  className="font-mono text-[10px] uppercase tracking-widest border border-[#8f1e18] bg-[#8f1e18] px-3 py-1.5 text-white hover:bg-[#a62a22] transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {text('结束会议', 'End Meeting')}
                </button>
              )}
              <div className="meeting-timer font-mono text-sm text-[#bcae86] border border-[#3a2a1c] px-3 py-1.5 rounded bg-[#1a130e]/60">
                <Clock size={12} className="inline mr-2 opacity-60" />{formatTime(meetingElapsed)}
              </div>
            </div>
          </header>

          <div className={`flex-1 grid gap-4 px-8 pb-6 min-h-0 ${hideMeetingTelemetry ? 'grid-cols-[1fr_380px]' : 'grid-cols-[1fr_320px]'}`}>
            {/* Main Roundtable Area */}
            <section className={`relative border border-[#3a2a1c] bg-[#1a130e]/80 rounded overflow-hidden dotgrid-bg--dark meeting-glow ${isAnySpeaking ? 'meeting-glow--active' : ''}`}>
              {/* Double SVG Ellipse Table */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg className="w-[70%] max-w-[700px] aspect-[1.8]" viewBox="0 0 700 390" fill="none">
                  <ellipse cx="350" cy="195" rx="320" ry="170" stroke="#7b6542" strokeWidth="1.5" opacity="0.3"
                    style={{ fill: 'url(#woodGrain)' }} />
                  <ellipse cx="350" cy="195" rx="240" ry="125" stroke="#bcae86" strokeWidth="0.8" strokeDasharray="6 4"
                    className="meeting-ellipse-inner" opacity="0.2" />
                  <defs>
                    <pattern id="woodGrain" patternUnits="userSpaceOnUse" width="30" height="30">
                      <rect width="30" height="30" fill="#251b13" opacity="0.5" />
                      <line x1="0" y1="15" x2="30" y2="15" stroke="#3a2a1c" strokeWidth="0.5" opacity="0.3" />
                    </pattern>
                  </defs>

                  {/* Link lines from speaking agent to center */}
                  {speakerAgent && (() => {
                    const idx = meetingProject.team.indexOf(speakerAgent);
                    const pos = getMeetingAvatarPos(idx, teamCount);
                    const sx = parseFloat(pos.left) / 100 * 700;
                    const sy = parseFloat(pos.top) / 100 * 390;
                    return <line x1={sx} y1={sy} x2="350" y2="195" className="link-active" style={{ stroke: '#8f1e18', strokeWidth: 1.5 }} />;
                  })()}
                </svg>
              </div>

              {/* Central Speaker Card 鈥?3 states */}
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                {!roomSpeaker && roomTranscript.length <= 1 ? (
                  /* IDLE state */
                  <div className="w-[min(480px,42%)] bg-[#1a130e] border border-[#3a2a1c] p-6 text-center pointer-events-auto">
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7d6a49] mb-3">{text('圆桌会议等待中', 'Roundtable Standby')}</div>
                    <div className="font-serif text-2xl leading-relaxed text-[#bcae86] mb-3">{text('输入内容后开始会议讨论。', 'Enter a message to begin the meeting discussion.')}</div>
                    <div className="w-12 h-0.5 bg-[#3a2a1c] mx-auto">
                      <div className="w-4 h-full bg-[#8f1e18] animate-pulse" />
                    </div>
                  </div>
                ) : roomSpeaker && speakerEntry ? (
                  /* Speaking state */
                  <div className={`w-[min(640px,48%)] max-h-[220px] overflow-y-auto border p-6 text-center pointer-events-auto ${speakerAgent ? 'bg-[#1a130e] border-[#7b6542]' : 'bg-[#1a130e] border-[#8f1e18]'}`}>
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#8f1e18] mb-2">{text('当前发言人', 'Current Speaker')}</div>
                    <div className="font-serif text-3xl leading-none mb-3 text-[#efe2bd]">{speakerEntry.speaker}</div>
                    {speakerEntry.role && speakerEntry.role !== 'User' && (
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-3">{speakerEntry.role}</div>
                    )}
                    <p className="font-serif text-lg leading-relaxed text-[#d8c99f]">{speakerEntry.text}</p>
                  </div>
                ) : (
                  /* Last speaker faded */
                  <div className="w-[min(480px,42%)] bg-[#1a130e]/60 border border-[#3a2a1c] p-6 text-center pointer-events-auto opacity-60">
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#7d6a49] mb-3">{text('上一条发言', 'Last Statement')}</div>
                    <p className="font-serif text-lg leading-relaxed text-[#bcae86]">{roomTranscript[roomTranscript.length - 1]?.text}</p>
                  </div>
                )}
              </div>

              {/* Agent Avatars 鈥?dynamic arc positioning */}
              {meetingProject.team.map((agent, index) => {
                const pos = getMeetingAvatarPos(index, teamCount);
                const speaking = roomSpeaker === agent.id;
                return (
                  <div key={agent.id} className="absolute flex flex-col items-center z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                    style={{ left: pos.left, top: pos.top }}>
                    <div className={`meeting-avatar w-16 h-16 rounded-full border-2 flex items-center justify-center font-serif text-2xl transition-all duration-300 ${speaking ? 'bg-[#efe2bd] text-[#8f1e18] border-[#efe2bd] scale-110' : 'bg-[#251b13] text-[#efe2bd] border-[#7b6542]'}`}>
                      {agent.name.charAt(0)}
                    </div>
                    {/* Sound wave bars */}
                    <div className="flex items-end gap-[2px] h-4 mt-1">
                      <div className={`sound-bar ${speaking ? 'sound-bar--active' : ''}`} style={{ height: speaking ? undefined : '3px' }} />
                      <div className={`sound-bar ${speaking ? 'sound-bar--active' : ''}`} style={{ height: speaking ? undefined : '3px' }} />
                      <div className={`sound-bar ${speaking ? 'sound-bar--active' : ''}`} style={{ height: speaking ? undefined : '3px' }} />
                    </div>
                    <div className="mt-1 text-center">
                      <div className={`font-serif text-sm transition-colors ${speaking ? 'text-[#efe2bd]' : 'text-[#bcae86]'}`}>{agent.name}</div>
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{agent.role}</div>
                    </div>
                  </div>
                );
              })}
            </section>

              {/* Right Sidebar */}
            <aside className="flex flex-col gap-3 min-h-0">
              {projectMeetingSession && !usesCustomMeetingSubmit && (
                <div data-testid="project-meeting-session-context" className="border border-[#7b6542] bg-[#251b13] p-4 shrink-0">
                  <div className="font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">{text('本次会议', 'This meeting')}</div>
                  <div className="mt-2 font-serif text-lg leading-snug text-[#efe2bd]">{projectMeetingSession.agenda}</div>
                  <div className="mt-3 flex flex-wrap gap-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                    <span>{projectMeetingSession.participantIds?.length || 0} {text('位参会者', 'attendees')}</span>
                    <span>·</span>
                    <span>{text('记录负责人', 'Recorder')}：{projectMeetingSession.recorderName}</span>
                  </div>
                </div>
              )}
              {hideMeetingTelemetry && (
                <div data-testid="project-meeting-intent-panel" className="bg-[#1a130e]/80 border border-[#3a2a1c] rounded p-4 shrink-0">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span data-no-localize="" className="node-id-tag bg-[#8f1e18]">INT</span>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">{text('智能体发言意图', 'Agent Intent')}</span>
                    </div>
                    <span className="font-mono text-[8px] uppercase tracking-widest text-[#59684b]">{visibleQueue.length} {text('位排队中', 'queued')}</span>
                  </div>
                  {activeIntention ? (
                    <div className="border-l-[3px] border-[#8f1e18] bg-[#0d0c0b]/50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-serif text-lg leading-tight text-[#efe2bd]">{activeIntention.name}</span>
                        <span className="font-mono text-[8px] text-[#7d6a49]">{intentStatusText(activeIntention.status)}</span>
                      </div>
                      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest leading-relaxed text-[#7d6a49]">
                        {intentTargetText(activeIntention.target)}
                      </div>
                    </div>
                  ) : (
                    <p className="font-serif text-sm leading-relaxed text-[#7d6a49]">{text('下一轮会议开始后，智能体会进入发言队列。', 'Agents will queue speaking intent after the next meeting turn.')}</p>
                  )}
                  {visibleQueue.length > 1 && (
                    <div className="mt-3 grid gap-2">
                      {visibleQueue.slice(0, 3).map((intent, index) => (
                        <div key={intent.id} className="flex items-center justify-between gap-3 border border-[#3a2a1c] bg-[#0d0c0b]/45 px-3 py-2">
                          <span className="truncate font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">{index + 1}. {intent.name}</span>
                          <span className="shrink-0 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{intentStatusText(intent.status)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!hideMeetingTelemetry && <div className="bg-[#1a130e]/80 border border-[#3a2a1c] rounded p-4 shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <span data-no-localize="" className="node-id-tag bg-[#8f1e18]">INT</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">{text('发言意图', 'Speaking Intent')}</span>
                </div>
                {activeIntention ? (
                  <div className="border-l-[3px] border-[#8f1e18] bg-[#0d0c0b]/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-serif text-lg leading-tight text-[#efe2bd]">{activeIntention.name}</span>
                      <span className="font-mono text-[8px] text-[#7d6a49]">{activeIntention.score}/10</span>
                    </div>
                    <div className="mt-2 font-mono text-[8px] uppercase tracking-widest leading-relaxed text-[#7d6a49]">
                      {intentTargetText(activeIntention.target)}
                    </div>
                  </div>
                ) : (
                  <p className="font-serif text-sm leading-relaxed text-[#7d6a49]">{text('等待用户输入后生成智能体发言意图。', 'Waiting for user input before generating Agent intent scores.')}</p>
                )}
              </div>}

              {/* Queue */}
              {!hideMeetingTelemetry && <div className="bg-[#1a130e]/80 border border-[#3a2a1c] rounded p-4 max-h-[24%] overflow-y-auto shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="node-id-tag bg-[#8f1e18]">QUE</span>
                  <span className="sr-only">{text('发言队列', 'Intent Queue')}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">{text('发言队列', 'Intent Queue')}</span>
                </div>
                {visibleQueue.length === 0 ? (
                  <p className="font-serif text-sm text-[#7d6a49]">{text('等待用户输入后生成智能体发言意图。', 'Waiting for user input to generate Agent intent scores.')}</p>
                ) : visibleQueue.map((intent, idx) => {
                  const statusColor = intent.status === 'speaking' ? '#8f1e18' : intent.status === 'yielded' ? '#59684b' : '#b9782b';
                  const statusLabel = intentStatusText(intent.status);
                  return (
                    <div key={intent.id} className={`border-l-[3px] p-3 mb-2 transition-opacity ${intent.status === 'yielded' ? 'opacity-50' : ''}`}
                      style={{ borderColor: statusColor, background: 'rgba(26,19,14,0.5)' }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span data-no-localize="" className="node-id-tag" style={{ fontSize: '7px' }}>INT-{String(idx + 1).padStart(2, '0')}</span>
                          <span className="font-mono text-[9px] text-[#bcae86]">{intent.name}</span>
                        </div>
                        <span className="node-status-tag text-white" style={{ background: statusColor, fontSize: '7px' }}>{statusLabel}</span>
                      </div>
                      <div className="h-1 bg-[#3a2a1c] rounded-full mb-1.5">
                        <div className="h-full rounded-full transition-all" style={{ width: `${intent.score * 10}%`, background: statusColor }} />
                      </div>
                      <div className="flex justify-between font-mono text-[8px] text-[#7d6a49]">
                        <span>{intent.target}</span><span>{intent.score}/10</span>
                      </div>
                    </div>
                  );
                })}
              </div>}

              {/* Transcript */}
              <div className="bg-[#1a130e]/80 border border-[#3a2a1c] rounded p-4 flex-1 overflow-y-auto min-h-0">
                <div className="flex items-center gap-2 mb-3">
                  <span data-no-localize="" className="node-id-tag bg-[#8f1e18]">LOG</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">{localizeText('Meeting Transcript', activeLanguage)}</span>
                </div>
                <div className="space-y-3">
                   {roomTranscript.slice(-8).map((log, idx) => {
                     const isSystem = log.speaker === 'System';
                     const isDirector = log.speaker === 'Director';
                     const replyTargetName = meetingProject.team.find(agent => agent.id === log.targetSpeakerId)?.name
                       || (log.targetSpeakerId === 'director' ? 'Director' : log.targetSpeakerId);
                     return (
                      <div key={log.id} className={`border-l-[3px] pl-3 py-1 ${isDirector ? 'border-[#efe2bd]' : isSystem ? 'border-[#3a2a1c]' : 'border-[#8f1e18]'}`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span data-no-localize="" className="node-id-tag" style={{ fontSize: '7px' }}>LOG-{String(idx + 1).padStart(2, '0')}</span>
                          <span className={`font-mono text-[9px] uppercase tracking-widest ${isDirector ? 'text-[#efe2bd]' : 'text-[#bcae86]'}`}>{log.speaker}</span>
                          {log.score > 0 && <span className="font-mono text-[8px] text-[#7d6a49] ml-auto">{log.score}/10</span>}
                         </div>
                         {log.replyToTurnId && log.interactionIntent && (
                           <div data-testid="meeting-peer-reply-context" className="mb-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                             {text('回应', 'Replying to')} {replyTargetName || text('上一位发言人', 'previous speaker')} · {interactionIntentText(log.interactionIntent)}
                           </div>
                         )}
                         <div className="font-serif text-sm leading-relaxed text-[#d8c99f]">{log.text}</div>
                         {isDirector && log.deliveryStatus && (
                           <div data-testid={`meeting-message-status-${log.id}`} className="mt-1 font-mono text-xs text-[#bcae86]">
                             {meetingMessageStatusLabel(log.deliveryStatus, activeLanguage)}
                           </div>
                         )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {usesCustomMeetingSubmit && initiationMeetingSession && (
                <div data-testid="initiation-meeting-session-proof" className="border border-[#7b6542] bg-[#0d0c0b] px-4 py-2 shrink-0">
                  <div className="font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">{text('后端会议记录', 'Backend Meeting Session')}</div>
                  <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd]">
                    {initiationMeetingSession.id} / {localizeText(initiationMeetingSession.status, activeLanguage)} / {initiationMeetingSession.evidence?.transcriptIds?.length || (initiationMeetingSession.transcript || []).length} {text('条会议记录', 'transcript proofs')}
                  </div>
                </div>
              )}

              {projectMeetingCompletion && (
                <div data-testid="project-meeting-completion" className="border border-[#59684b] bg-[#1d2618] px-4 py-3 shrink-0">
                  <div className="font-mono text-[8px] uppercase tracking-widest text-[#b9d18f]">{text('会议纪要已提交', 'Meeting minutes submitted')}</div>
                  <div className="mt-2 font-serif text-sm text-[#efe2bd]">{projectMeetingCompletion.report?.recorderName}</div>
                  <div data-testid="project-meeting-summary-path" data-no-localize="" className="mt-1 break-all font-mono text-[8px] text-[#bcae86]">{projectMeetingCompletion.report?.workspaceRelativePath}</div>
                </div>
              )}
              {projectMeetingSetupError && (
                <div role="alert" className="border border-[#8f1e18] bg-[#251b13] px-4 py-3 text-sm text-[#e7b3ae]">{projectMeetingSetupError}</div>
              )}

              {/* Input */}
              {backendMeetingSendRequired && (
                <div data-testid="backend-meeting-send-required" className="border border-[#8f1e18] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] leading-relaxed">
                  <div>{text('发送真实会议内容前需要配置本地后端；当前项目已禁用本地模拟会议。', 'Backend target required before sending real War Room meeting turns; local meeting simulation is disabled for this project.')}</div>
                  <button
                    type="button"
                    data-testid="backend-meeting-send-open-deployment"
                    onClick={() => { setSettingsTab('deployment'); setSettingsOpen(true); }}
                    className="mt-2 inline-flex items-center gap-1 border border-[#7b6542] px-2 py-1 text-[#efe2bd] hover:border-[#efe2bd]"
                  >
                    {text('打开本地服务设置', 'Open Settings Deployment')}
                  </button>
                </div>
              )}
              <div className="bg-[#251b13] border border-[#3a2a1c] rounded-lg p-3 flex items-end gap-3 shrink-0">
                <button
                  type="button"
                  data-testid="project-meeting-voice"
                  onClick={toggleRoomVoiceInput}
                  disabled={!speechRecognitionSupported || roomVoiceStatus === 'unsupported'}
                  aria-pressed={roomVoiceStatus === 'listening'}
                  title={roomVoiceStatus === 'unsupported' ? text('当前浏览器不支持语音输入', 'Voice input is not supported in this browser') : text('开始语音输入', 'Mark voice input')}
                  className={`shrink-0 rounded border px-3 py-3 font-mono text-[8px] uppercase tracking-widest transition-colors ${
                    roomVoiceStatus === 'listening'
                      ? 'border-[#8f1e18] bg-[#8f1e18] text-white'
                      : 'border-[#3a2a1c] bg-[#1a130e] text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-40'
                  }`}
                >
                  <Mic2 size={17} className={roomVoiceStatus === 'listening' ? 'animate-pulse' : ''} />
                  <span className="mt-1 block">{text('语音', 'Voice')}</span>
                </button>
                <textarea
                  data-testid="project-meeting-input"
                  value={roomInput}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setRoomInput(nextValue);
                    setRoomUserIntentActive(meetingDraftClaimsFloor(nextValue));
                  }}
                  onCompositionEnd={(event) => setRoomUserIntentActive(meetingDraftClaimsFloor(event.currentTarget.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (canSendMeeting) submitMeetingInput(meetingProject);
                    }
                  }}
                  placeholder={text('输入会议发言…', 'Enter meeting remarks...')}
                  className="min-h-[76px] flex-1 resize-none bg-transparent py-1 outline-none text-[#efe2bd] font-serif text-lg leading-relaxed placeholder-[#7d6a49]/60"
                />
                <button data-testid="project-meeting-send" onClick={() => submitMeetingInput(meetingProject)}
                  disabled={!canSendMeeting}
                  title={backendMeetingSendRequired ? text('发送真实会议内容前请配置本地后端地址。', 'Configure the backend URL before sending real War Room meeting turns.') : text('发送会议发言', 'Send meeting remarks')}
                  className="shrink-0 bg-[#8f1e18] hover:bg-[#a62a22] text-white px-5 py-3 rounded flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {text('发言', 'Speak')}
                </button>
              </div>
              <div data-testid="project-meeting-director-precedence" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">
                {roomUserIntentActive ? text('总监正在输入，智能体发言已暂停', 'Director has the floor — Agent turns paused') : text('智能体发言队列已就绪', 'Agent intent queue ready')}
              </div>
              <div className="hidden">
                <div className={`p-2 rounded ${isAnySpeaking ? 'bg-[#8f1e18]/20' : 'bg-[#3a2a1c]'}`}>
                  <Mic2 size={16} className={`${isAnySpeaking ? 'text-[#8f1e18] animate-pulse' : 'text-[#7d6a49]'}`} />
                </div>
                <input
                  data-testid="project-meeting-input-legacy"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && canSendMeeting) submitMeetingInput(meetingProject); }}
                  placeholder="Enter a meeting message..."
                  className="flex-1 bg-transparent outline-none text-[#efe2bd] font-serif text-base placeholder-[#7d6a49]/60"
                />
                <button data-testid="project-meeting-send-legacy" onClick={() => submitMeetingInput(meetingProject)}
                  disabled={!canSendMeeting}
                  className="bg-[#8f1e18] hover:bg-[#a62a22] text-white px-4 py-1.5 rounded flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Send
                </button>
                <span className="font-mono text-[8px] text-[#7d6a49] px-1">Enter</span>
              </div>
            </aside>
          </div>
        </div>
      </div>
  );
}
