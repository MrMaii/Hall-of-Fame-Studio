import React from 'react';
import { ChevronRight } from 'lucide-react';

export default function ProjectInitiationInviteStep({
  activeLanguage = 'zh',
  invitedMembers,
  onOpenTalentMarket,
  onContinue,
}) {
  const text = (chinese, english) => activeLanguage === 'zh' ? chinese : english;

  return (
    <div className="max-w-5xl mx-auto">
      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#bcae86] mb-4">
          {text('第 3 步 / 从同一个人才市场选择成员', 'Step 03 / Sign from the same Talent Market')}
        </div>
        <div className="border border-[#7b6542] bg-[#1a130e]/88 p-8">
          <h2 className="font-serif text-5xl leading-none mb-5">{text('从人才市场选择立项参与成员', 'Choose kickoff participants from Talent Market')}</h2>
          <p className="font-serif text-xl leading-relaxed text-[#d8c99f] mb-6">
            {text('这里使用与首页相同的人才市场。选择成员后，他们会直接加入本次立项团队。', 'This uses the same Talent Market as the homepage. Signing adds the talent directly to this initiation team.')}
          </p>
          <div data-testid="initiation-signed-team" className="mb-5 border-t border-[#3a2a1c] pt-4 font-serif text-xl">
            {text('已选团队', 'Signed team')}: {invitedMembers.map(member => member.name).join(' / ') || text('尚未选择', 'None yet')}
          </div>
          <button
            type="button"
            data-testid="initiation-open-talent-market"
            onClick={onOpenTalentMarket}
            className="w-full bg-[#efe2bd] px-5 py-4 font-mono text-[10px] uppercase tracking-widest text-[#251b13] hover:bg-white"
          >
            {text('打开人才市场', 'Open Talent Market')} <ChevronRight size={15} className="inline-block ml-2" />
          </button>
        </div>
        <button data-testid="initiation-next-lobby" onClick={onContinue} disabled={invitedMembers.length === 0} className="mt-7 w-full bg-[#8f1e18] disabled:bg-[#3a2a1c] disabled:text-[#7d6a49] hover:bg-[#a62a22] text-white px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
          {text('进入会议准备', 'Enter Meeting Prep')} <ChevronRight size={15} />
        </button>
      </section>
      <aside className="hidden">
        <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#8f1e18] mb-4">Meeting List</div>
        <div className="space-y-3 mb-6">
          {invitedMembers.map(member => (
            <div key={member.id} className="border border-[#b8a57d] bg-[#f7edcf] px-4 py-3">
              <div className="font-serif text-xl">{member.name}</div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{member.title}</div>
            </div>
          ))}
        </div>
        <button onClick={onContinue} disabled={invitedMembers.length === 0} className="w-full bg-[#251b13] disabled:bg-[#b8a57d] disabled:text-[#7d6a49] text-[#efe2bd] px-5 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors">
          Enter Meeting Prep <ChevronRight size={15} />
        </button>
      </aside>
    </div>
  );
}
