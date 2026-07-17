import React from 'react';
import { RefreshCw, Users } from 'lucide-react';

export default function ProjectInitiationLobbyStep({
  activeLanguage = 'zh',
  projectName,
  intent,
  invitedMembers,
  participants,
  canStart,
  providerRunning,
  startState,
  onStartMeeting,
}) {
  const text = (chinese, english) => activeLanguage === 'zh' ? chinese : english;
  const startDisabled = !canStart || providerRunning || startState.running;

  return (
    <div className="max-w-5xl mx-auto">
      <section className="bg-[#efe2bd] text-[#251b13] border border-[#7b6542] p-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#8f1e18] mb-5">{text('第 4 步 / 会议准备', 'Step 04 / Meeting Lobby')}</div>
        <h2 className="font-serif text-5xl leading-none mb-5">{projectName}</h2>
        <p className="font-serif text-2xl leading-relaxed text-[#4d3c28] mb-8">{intent}</p>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            [text('会议目标', 'Meeting Goal'), text('确认项目是否继续，以及每项工作的负责人。', 'Confirm whether the project should proceed and who owns what.')],
            [text('参与成员', 'Participants'), `${invitedMembers.length + 1} ${text('人', 'people')}`],
            [text('进入条件', 'Entry Condition'), text('必须完成一次由模型生成的立项会议。', 'A model-generated kickoff meeting must complete.')],
          ].map(([label, value]) => (
            <div key={label} className="border border-[#b8a57d] p-4 bg-[#f7edcf]">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-2">{label}</div>
              <div className="font-serif text-xl">{value}</div>
            </div>
          ))}
        </div>
        <button
          data-testid="initiation-start-meeting"
          onClick={onStartMeeting}
          disabled={startDisabled}
          className="relative mt-7 w-full overflow-hidden bg-[#8f1e18] disabled:bg-[#3a2a1c] disabled:text-[#7d6a49] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors"
        >
          {startState.running && (
            <span className="absolute inset-y-0 left-0 w-2/3 animate-pulse bg-[#d9b56c]/30" aria-hidden="true" />
          )}
          <span className="relative z-10 flex items-center justify-center gap-3">
            {startState.running ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                {startState.label || text('正在准备会议', 'Preparing meeting')}
              </>
            ) : (
              <>
                {text('开始立项圆桌会议', 'Start Kickoff Roundtable')} <Users size={15} />
              </>
            )}
          </span>
        </button>
      </section>
      <aside className="hidden">
        <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#8f1e18] mb-5">Ready Room</div>
        <div className="space-y-3 mb-6">
          {participants.map(member => (
            <div key={member.id} className="flex items-center gap-3 border border-[#3a2a1c] bg-[#0d0c0b] p-3">
              <div className="h-9 w-9 rounded-full border border-[#7b6542] flex items-center justify-center font-serif">{member.name.charAt(0)}</div>
              <div>
                <div className="font-serif text-lg leading-none">{member.name}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{member.title}</div>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={onStartMeeting}
          disabled={startDisabled}
          className="relative w-full overflow-hidden bg-[#8f1e18] disabled:bg-[#3a2a1c] disabled:text-[#7d6a49] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors"
        >
          {startState.running && (
            <span className="absolute inset-y-0 left-0 w-2/3 animate-pulse bg-[#d9b56c]/30" aria-hidden="true" />
          )}
          <span className="relative z-10 flex items-center justify-center gap-3">
            {startState.running ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                {startState.label || 'Preparing meeting'}
              </>
            ) : (
              <>
                开始立项圆桌 <Users size={15} />
              </>
            )}
          </span>
        </button>
      </aside>
    </div>
  );
}
