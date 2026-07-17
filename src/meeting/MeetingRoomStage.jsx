const avatarPosition = (index, total) => {
  const centerX = 50;
  const centerY = 52;
  const radiusX = 36;
  const radiusY = 22;
  const angleStep = Math.PI / (total + 1);
  const angle = Math.PI + (index + 1) * angleStep;
  return {
    left: `${centerX + radiusX * Math.cos(angle)}%`,
    top: `${centerY + radiusY * Math.sin(angle)}%`,
  };
};

export default function MeetingRoomStage({ project, speakerId, transcript }) {
  const team = Array.isArray(project?.team) ? project.team : [];
  const speakerAgent = speakerId ? team.find((agent) => agent.id === speakerId) : null;
  const speakerEntry = speakerId
    ? transcript.slice().reverse().find((entry) => {
      if (speakerId === 'director') return entry.speaker === 'Director';
      return speakerAgent && entry.speaker === speakerAgent.name;
    })
    : null;

  return (
    <section data-testid="project-meeting-room-stage" className={`relative hidden border border-[#3a2a1c] bg-[#1a130e]/80 rounded overflow-hidden dotgrid-bg--dark meeting-glow lg:block ${speakerId ? 'meeting-glow--active' : ''}`}>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg className="w-[70%] max-w-[700px] aspect-[1.8]" viewBox="0 0 700 390" fill="none" aria-hidden="true">
          <ellipse cx="350" cy="195" rx="320" ry="170" stroke="#7b6542" strokeWidth="1.5" opacity="0.3" style={{ fill: 'url(#woodGrain)' }} />
          <ellipse cx="350" cy="195" rx="240" ry="125" stroke="#bcae86" strokeWidth="0.8" strokeDasharray="6 4" className="meeting-ellipse-inner" opacity="0.2" />
          <defs>
            <pattern id="woodGrain" patternUnits="userSpaceOnUse" width="30" height="30">
              <rect width="30" height="30" fill="#251b13" opacity="0.5" />
              <line x1="0" y1="15" x2="30" y2="15" stroke="#3a2a1c" strokeWidth="0.5" opacity="0.3" />
            </pattern>
          </defs>
          {speakerAgent && (() => {
            const position = avatarPosition(team.indexOf(speakerAgent), team.length);
            const startX = parseFloat(position.left) / 100 * 700;
            const startY = parseFloat(position.top) / 100 * 390;
            return <line x1={startX} y1={startY} x2="350" y2="195" className="link-active" style={{ stroke: '#8f1e18', strokeWidth: 1.5 }} />;
          })()}
        </svg>
      </div>

      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        {!speakerId ? (
          <div className="w-[min(480px,42%)] bg-[#1a130e] border border-[#3a2a1c] p-6 text-center pointer-events-auto">
            <div className="font-mono text-xs uppercase tracking-[0.28em] text-[#7d6a49] mb-3">会议待命</div>
            <div className="font-serif text-xl leading-relaxed text-[#bcae86] mb-3">{transcript.length <= 1 ? '输入一条消息以开始讨论。' : '上一轮已完成，可以继续发言。'}</div>
            <div className="w-12 h-0.5 bg-[#3a2a1c] mx-auto"><div className="w-4 h-full bg-[#8f1e18] animate-pulse" /></div>
          </div>
        ) : speakerEntry ? (
          <div className={`absolute bottom-6 left-1/2 w-[min(620px,80%)] -translate-x-1/2 max-h-[170px] overflow-y-auto border p-5 text-center pointer-events-auto ${speakerAgent ? 'bg-[#1a130e] border-[#7b6542]' : 'bg-[#1a130e] border-[#8f1e18]'}`}>
            <div className="font-mono text-xs uppercase tracking-[0.28em] text-[#8f1e18] mb-2">当前发言</div>
            <div className="font-serif text-2xl leading-none mb-3 text-[#efe2bd]">{speakerEntry.speaker}</div>
            {speakerEntry.role && speakerEntry.role !== 'User' && <div className="font-mono text-xs uppercase tracking-widest text-[#7d6a49] mb-3">{speakerEntry.role}</div>}
            <p className="font-serif text-lg leading-relaxed text-[#d8c99f]">{speakerEntry.text}</p>
          </div>
        ) : null}
      </div>

      {team.map((agent, index) => {
        const position = avatarPosition(index, team.length);
        const speaking = speakerId === agent.id;
        return (
          <div key={agent.id} className="absolute flex flex-col items-center z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-300" style={{ left: position.left, top: position.top }}>
            <div className={`meeting-avatar w-16 h-16 rounded-full border-2 flex items-center justify-center font-serif text-2xl transition-all duration-300 ${speaking ? 'bg-[#efe2bd] text-[#8f1e18] border-[#efe2bd] scale-110' : 'bg-[#251b13] text-[#efe2bd] border-[#7b6542]'}`}>{agent.name.charAt(0)}</div>
            <div className="flex items-end gap-[2px] h-4 mt-1">
              {[0, 1, 2].map((bar) => <div key={bar} className={`sound-bar ${speaking ? 'sound-bar--active' : ''}`} style={{ height: speaking ? undefined : '3px' }} />)}
            </div>
            <div className="mt-1 text-center">
              <div className={`font-serif text-sm transition-colors ${speaking ? 'text-[#efe2bd]' : 'text-[#bcae86]'}`}>{agent.name}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{agent.role}</div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
