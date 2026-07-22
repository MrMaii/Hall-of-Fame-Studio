import { CheckCircle2, ChevronLeft, FileText, Users } from 'lucide-react';

export default function ProjectMeetingSetup({
  activeLanguage = 'zh',
  project = {},
  draft = {},
  error = '',
  starting = false,
  onBack,
  onChange,
  onToggleParticipant,
  onStart,
}) {
  const text = (chinese, english) => activeLanguage === 'zh' ? chinese : english;
  const team = project.team || [];
  const selectedIds = draft.participantIds || [];
  const minimumParticipants = team.length > 1 ? 2 : 1;
  const ready = String(draft.agenda || '').trim()
    && selectedIds.length >= minimumParticipants
    && selectedIds.includes(draft.recorderId);

  return (
    <div data-testid="project-meeting-setup" className="min-h-screen overflow-y-auto bg-[#efe2bd] px-6 py-8 text-[#251b13]">
      <div className="mx-auto max-w-5xl">
        <button type="button" data-testid="project-meeting-setup-back" onClick={onBack} className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#7d6a49] hover:text-[#251b13]">
          <ChevronLeft size={15} /> {text('返回项目', 'Back to project')}
        </button>

        <div className="mt-8 border-y border-[#7b6542] py-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#8f1e18]">{text('召开项目会议', 'Start Project Meeting')}</div>
          <h1 className="mt-3 font-serif text-5xl leading-none">{text('先把人和议题确认清楚', 'Confirm the people and agenda first')}</h1>
          <p className="mt-4 max-w-3xl font-serif text-xl leading-relaxed text-[#5f4a32]">
            {text('确认后，所有参会智能体都会听取你的发言、分别形成判断、彼此回应并由最后一位发言者收敛。会议结束时，记录负责人会生成本地会议纪要并按项目流程提交。', 'After confirmation, every attendee will hear you, form an independent view, respond to peers, and converge. At the end, the recorder will create local minutes and submit them through the project workflow.')}
          </p>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
          <section className="border border-[#7b6542] bg-[#f7edcf] p-5">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#8f1e18]"><FileText size={15} /> 01 · {text('确认会议议题', 'Confirm agenda')}</div>
            <label className="mt-4 block font-serif text-lg" htmlFor="project-meeting-agenda">{text('这次会议必须解决什么？', 'What must this meeting resolve?')}</label>
            <textarea
              id="project-meeting-agenda"
              data-testid="project-meeting-agenda"
              value={draft.agenda || ''}
              onChange={(event) => onChange('agenda', event.target.value)}
              rows={5}
              placeholder={text('例如：确认当前版本是否可以交付，并明确每个人下一步负责什么。', 'Example: Decide whether the current version can ship and assign each person’s next work.')}
              className="mt-2 w-full resize-none border border-[#7b6542] bg-[#fff9e8] px-4 py-3 font-serif text-lg outline-none focus:border-[#8f1e18]"
            />
          </section>

          <section className="border border-[#7b6542] bg-[#f7edcf] p-5">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#8f1e18]"><Users size={15} /> 02 · {text('选择参会人', 'Choose attendees')}</div>
            <p className="mt-3 text-sm text-[#5f4a32]">{text(`至少选择 ${minimumParticipants} 人。只有确认参会的人会进入会议、听取发言并形成意图。`, `Choose at least ${minimumParticipants}. Only confirmed attendees enter, hear the discussion, and form intentions.`)}</p>
            <div className="mt-4 grid gap-2">
              {team.map((member) => {
                const selected = selectedIds.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    data-testid={`project-meeting-participant-${member.id}`}
                    aria-pressed={selected}
                    onClick={() => onToggleParticipant(member.id)}
                    className={`flex items-center justify-between border px-3 py-3 text-left ${selected ? 'border-[#8f1e18] bg-[#efe2bd]' : 'border-[#b8a57d] bg-[#fff9e8]'}`}
                  >
                    <span><span className="font-serif text-lg">{member.name}</span><span className="ml-2 font-mono text-[9px] uppercase text-[#7d6a49]">{member.role || member.title}</span></span>
                    {selected && <CheckCircle2 size={17} className="text-[#8f1e18]" />}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <section className="mt-5 border border-[#7b6542] bg-[#251b13] p-5 text-[#efe2bd]">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#d8c99f]">03 · {text('指定会议记录负责人', 'Assign the meeting recorder')}</div>
          <p className="mt-2 text-sm text-[#bcae86]">{text('记录负责人必须参会。结束时由此人主动承诺、生成本地纪要并提交。', 'The recorder must attend. This person will make the closing commitment, create the local minutes, and submit them.')}</p>
          <select
            data-testid="project-meeting-recorder"
            value={draft.recorderId || ''}
            onChange={(event) => onChange('recorderId', event.target.value)}
            className="mt-4 w-full border border-[#7b6542] bg-[#1a130e] px-4 py-3 font-serif text-lg text-[#efe2bd] outline-none focus:border-[#efe2bd]"
          >
            <option value="">{text('选择记录负责人', 'Choose recorder')}</option>
            {team.filter((member) => selectedIds.includes(member.id)).map((member) => (
              <option key={member.id} value={member.id}>{member.name} · {member.role || member.title}</option>
            ))}
          </select>
        </section>

        {error && <div data-testid="project-meeting-setup-error" role="alert" className="mt-4 border border-[#8f1e18] bg-[#f4d6c7] px-4 py-3 text-sm text-[#8f1e18]">{error}</div>}

        <button
          type="button"
          data-testid="project-meeting-confirm-start"
          disabled={!ready || starting}
          onClick={onStart}
          className="mt-5 w-full border border-[#251b13] bg-[#251b13] px-5 py-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[#efe2bd] disabled:cursor-not-allowed disabled:opacity-35"
        >
          {starting ? text('正在召集参会人…', 'Inviting attendees…') : text(`确认并召开会议 · ${selectedIds.length} 人`, `Confirm and start · ${selectedIds.length} attendees`)}
        </button>
      </div>
    </div>
  );
}
