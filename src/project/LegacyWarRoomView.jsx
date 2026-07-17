import { CornerDownRight, Fingerprint, StopCircle } from 'lucide-react';

export default function LegacyWarRoomView({
  project,
  speakingAgent = null,
  targetNodeIds = [],
  onTargetNodeIdsChange,
  meetingState = 'idle',
  meetingLogs = [],
  transcriptEndRef,
  onEndMeeting,
  onStartMeeting,
  backendTargetMissing = false,
  onOpenDeploymentSettings,
  terminalInput = '',
  onTerminalInputChange,
  onTerminalKeyDown,
} = {}) {
  if (!project) return null;

  const cx = 400;
  const cy = 350;
  const radius = 250;
  const team = Array.isArray(project.team) ? project.team : [];
  const getPosition = (index, total) => {
    const angleStep = Math.PI / (total + 1);
    const angle = Math.PI + (index + 1) * angleStep;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  };

  return (
    <div className="flex-1 bg-[var(--warroom-bg)] text-[var(--warroom-text)] flex flex-col fade-in h-screen">
      <div className="h-[45vh] border-b border-[#333] relative overflow-hidden flex justify-center items-center bg-[#080808]">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        <svg width="800" height="400" className="absolute bottom-0 overflow-visible z-10">
          {team.map((agent, index) => {
            const position = getPosition(index, team.length);
            const isSpeaking = speakingAgent === agent.id;
            const isUserSpeaking = speakingAgent === 'user';
            const isTargeted = targetNodeIds.includes(agent.id);
            const isLineActive = isSpeaking || (isUserSpeaking && (targetNodeIds.length === 0 || isTargeted));
            return (
              <line
                key={`line-${agent.id}`}
                x1={cx}
                y1={cy}
                x2={position.x}
                y2={position.y}
                stroke={isTargeted ? '#555' : '#333'}
                strokeWidth="1"
                className={isLineActive ? 'link-active' : ''}
              />
            );
          })}

          <path d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`} fill="none" stroke="#222" strokeWidth="2" strokeDasharray="5 5" />

          {team.map((agent, index) => {
            const position = getPosition(index, team.length);
            const isSpeaking = speakingAgent === agent.id;
            const isTargeted = targetNodeIds.includes(agent.id);
            const toggleTarget = () => {
              onTargetNodeIdsChange?.(
                isTargeted
                  ? targetNodeIds.filter(id => id !== agent.id)
                  : [...targetNodeIds, agent.id],
              );
            };
            return (
              <g key={`node-${agent.id}`} transform={`translate(${position.x}, ${position.y})`} onClick={toggleTarget} className="cursor-pointer group">
                {isTargeted && <circle r="26" fill="none" stroke="#888" strokeWidth="1" strokeDasharray="3 3" />}
                <circle r="20" fill={isTargeted ? '#222' : '#111'} stroke={isSpeaking ? '#fff' : (isTargeted ? '#aaa' : '#444')} strokeWidth={isSpeaking ? '3' : '2'} className="transition-all duration-300 group-hover:stroke-[#888]" />
                <text y="-35" fill={isSpeaking || isTargeted ? '#fff' : '#888'} fontSize="12" fontFamily="Space Mono" textAnchor="middle" className="tracking-widest transition-colors">{agent.name.toUpperCase()}</text>
                <text y="-50" fill={isTargeted ? '#888' : '#555'} fontSize="8" fontFamily="Space Mono" textAnchor="middle" className="tracking-widest transition-colors">{agent.role.toUpperCase()}</text>
              </g>
            );
          })}

          <g transform={`translate(${cx}, ${cy})`}>
            <rect x="-30" y="-30" width="60" height="60" fill="#111" stroke={speakingAgent === 'user' ? '#fff' : '#555'} strokeWidth={speakingAgent === 'user' ? '3' : '2'} rx="8" className="transition-all duration-300" />
            <text y="5" fill={speakingAgent === 'user' ? '#fff' : '#aaa'} fontSize="14" fontFamily="Space Mono" textAnchor="middle" fontWeight="bold">YOU</text>
            <text y="20" fill="#555" fontSize="8" fontFamily="Space Mono" textAnchor="middle" className="tracking-widest">DIRECTOR</text>
          </g>
        </svg>

        <div className="absolute top-6 left-6 z-20">
          <h2 className="font-serif text-2xl text-white tracking-widest uppercase opacity-80">Session Room</h2>
          <p className="font-mono text-[10px] text-gray-500 tracking-widest mt-1">SECURE CONNECTION ESTABLISHED</p>
        </div>

        <button
          data-testid="legacy-war-room-end-meeting"
          onClick={onEndMeeting}
          disabled={backendTargetMissing}
          title={backendTargetMissing ? 'Configure the backend URL before closing a real War Room session.' : 'End protocol'}
          className="absolute top-6 right-6 font-mono text-xs border border-red-900 text-red-500 px-4 py-2 hover:bg-red-900 hover:text-white transition-colors flex items-center gap-2 z-20 bg-[#0d0c0b] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <StopCircle size={14} /> End Protocol
        </button>
      </div>

      <div className="flex-1 flex flex-col h-[55vh] max-w-5xl mx-auto w-full px-8 relative">
        <div className="flex-1 overflow-y-auto py-8 warroom-scrollbar pr-4 flex flex-col gap-6">
          {meetingState === 'idle' ? (
            <button
              type="button"
              data-testid="legacy-war-room-start-meeting"
              className="h-full flex flex-col items-center justify-center text-gray-600 group cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
              onClick={onStartMeeting}
              disabled={backendTargetMissing}
              title={backendTargetMissing ? 'Configure the backend URL before starting a real War Room session.' : 'Start War Room session'}
            >
              <Fingerprint size={48} className="mb-4 opacity-30 group-hover:opacity-100 transition-opacity group-hover:text-white" />
              <p className="font-mono text-xs tracking-widest uppercase">Awaiting Director Authentication to Start</p>
              {backendTargetMissing && (
                <span className="mt-4 border border-[#8f1e18] bg-[#251b13] px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-[#bcae86]">Backend target required</span>
              )}
            </button>
          ) : (
            meetingLogs.map(log => {
              if (log.type === 'system') {
                return (
                  <div key={log.id} className="text-center w-full my-4">
                    <span className="font-mono text-[10px] bg-[#222] text-[#888] px-3 py-1 border border-[#333] tracking-widest uppercase">{log.text}</span>
                  </div>
                );
              }
              const isUser = log.type === 'user';
              return (
                <div key={log.id} className={`flex flex-col w-full ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    {!isUser && <span className="font-mono text-[10px] text-[#aaa] tracking-widest border border-[#333] px-1 bg-[#1a1a1a]">{log.agent.role.toUpperCase()}</span>}
                    {isUser && log.targetNames && (
                      <span className="font-mono text-[10px] text-[#888] tracking-widest border border-[#333] px-1 bg-[#1a1a1a]">TO: @{log.targetNames.join(', @')}</span>
                    )}
                    <span className={`font-mono text-[11px] uppercase tracking-widest ${isUser ? 'text-[#fff]' : 'text-[#888]'}`}>{isUser ? 'DIRECTOR' : log.agent.name}</span>
                  </div>
                  <div className={`max-w-[80%] border-l-2 p-4 bg-[#111] ${isUser ? 'border-[#fff] text-white' : 'border-[#555] text-[#ccc]'}`}>
                    <p className="font-serif text-xl leading-relaxed tracking-wide">{log.text}</p>
                  </div>
                </div>
              );
            })
          )}
          {speakingAgent && speakingAgent !== 'user' && (
            <div className="flex items-start w-full opacity-50">
              <div className="font-mono text-[10px] text-[#888] tracking-widest border-l-2 border-[#555] p-4 bg-[#111] animate-pulse">[ NODE PROCESSING DIRECTIVE... ]</div>
            </div>
          )}
          <div ref={transcriptEndRef} />
        </div>

        {meetingState === 'active' && (
          <div className="py-6 border-t border-[#333] bg-[var(--warroom-bg)] relative z-20 flex flex-col">
            {backendTargetMissing && (
              <div data-testid="legacy-war-room-backend-required" className="mb-3 border border-[#8f1e18] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] leading-relaxed">
                <div>Backend target required before sending real legacy War Room directives; local route simulation is disabled for this project.</div>
                <button type="button" data-testid="legacy-war-room-open-deployment" onClick={onOpenDeploymentSettings} className="mt-2 inline-flex items-center gap-1 border border-[#7b6542] px-2 py-1 text-[#efe2bd] hover:border-[#efe2bd]">Open Settings Deployment</button>
              </div>
            )}

            <div className="mb-3 flex items-center gap-2">
              <span className="font-mono text-[10px] text-[#555] tracking-widest">DIRECTIVE TARGET:</span>
              {targetNodeIds.length === 0 ? (
                <span className="font-mono text-[11px] bg-[#222] text-[#fff] px-2 py-0.5 border border-[#444] rounded-sm tracking-widest">@ALL</span>
              ) : (
                targetNodeIds.map(id => {
                  const agent = team.find(member => member.id === id);
                  return agent ? (
                    <span key={id} className="font-mono text-[11px] bg-[#fff] text-[#000] px-2 py-0.5 border border-[#fff] rounded-sm font-bold tracking-widest">@{agent.name.toUpperCase()}</span>
                  ) : null;
                })
              )}
            </div>

            <div className="flex items-center gap-4 bg-[#111] border border-[#333] p-2 focus-within:border-[#fff] transition-colors">
              <div className="bg-[#fff] p-2"><CornerDownRight size={16} className="text-black" /></div>
              <input
                data-testid="legacy-war-room-terminal-input"
                autoFocus
                type="text"
                value={terminalInput}
                onChange={(event) => onTerminalInputChange(event.target.value)}
                onKeyDown={onTerminalKeyDown}
                disabled={backendTargetMissing}
                className="flex-1 bg-transparent border-none outline-none text-white font-serif text-xl placeholder-[#444]"
                placeholder="Enter your directive for the board..."
                autoComplete="off"
              />
              <span className="font-mono text-[10px] text-[#555] pr-4 tracking-widest">PRESS ENTER</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
