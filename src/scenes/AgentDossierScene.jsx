import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Crosshair,
  FileSignature,
  PackageCheck,
  Shield,
} from 'lucide-react';

export default function AgentDossierScene({
  agent,
  isInitiationMarket,
  isRecruited,
  isStamping,
  profile,
  deploymentWindow,
  skill,
  avatar,
  imageSrc,
  evidenceStrips,
  dossierText,
  personSkillCount,
  personSkillDocCount,
  RadarChartComponent,
  agentCardInitial,
  onClose,
  onStartContract,
}) {
  const windowText = {
    title: 'Deployment Window',
    useWhen: 'Use When',
    strongestAxis: 'Strongest Axis',
    firstOutput: 'First Output',
    starterBrief: 'Starter Brief',
  };

  return (
    <div className="archive-stage relative h-screen overflow-hidden text-[#251b13]">
      <div className="archive-table absolute inset-x-0 bottom-0 h-[78vh] origin-bottom skew-y-[-2deg] scale-110" />
      <div className="archive-vignette absolute inset-0 pointer-events-none z-40" />

      <button
        onClick={onClose}
        className="absolute top-7 left-7 z-50 bg-[#e8ddbf] text-[#221812] border border-[#5c4933] shadow-[6px_6px_0_rgba(0,0,0,0.24)] px-4 py-3 font-mono text-[10px] uppercase tracking-widest flex items-center gap-3 hover:-translate-y-0.5 hover:bg-[#f3e8c8] transition-transform"
      >
        <ArrowLeft size={15} />
        {dossierText('Refile Archive')}
      </button>

      <div className="absolute top-7 right-7 z-50 flex items-center gap-3 text-[#e8ddbf] font-mono text-[10px] uppercase tracking-widest">
        <span className="border border-[#8d7a58] px-3 py-2 bg-black/20">{dossierText('Skills')}: {personSkillCount} / {dossierText('Docs')}: {personSkillDocCount}</span>
        <span className="border border-[#8d7a58] px-3 py-2 bg-black/20">{dossierText('Clearance')}: {dossierText('Director')}</span>
        <span className="border border-red-900/70 text-red-200 px-3 py-2 bg-red-950/25">{dossierText('Live Dossier')}</span>
      </div>

      <div className="relative z-30 h-full min-h-0 flex items-center justify-center px-5 py-20">
        <div className={`archive-dossier dossier-scroll-field relative w-full max-w-6xl max-h-[calc(100vh-120px)] overflow-y-auto lg:h-[min(760px,calc(100vh-120px))] lg:min-h-0 lg:overflow-hidden border border-[#765f3e] grid grid-cols-12 ${isStamping ? 'dossier-impact' : ''}`}>
          <div className="absolute -top-4 left-10 right-24 h-12 bg-[#c8b688] border border-[#755f3f] -rotate-1 shadow-lg" />
          <div className="absolute top-8 right-10 border-[5px] border-[#8f1e18] text-[#8f1e18] font-mono text-2xl font-bold uppercase tracking-[0.22em] px-5 py-2 rotate-[10deg] opacity-80 mix-blend-multiply pointer-events-none">
            {dossierText(isRecruited ? 'Contracted' : 'Pending')}
          </div>
          {isStamping && (
            <>
              <div className="absolute inset-0 z-50 pointer-events-none contract-stamp-theater" />
              <div className="absolute left-1/2 top-[57%] z-[70] pointer-events-none stamp-device">
                <div className="stamp-handle w-20 h-40 rounded-t-[38px] rounded-b-xl border border-[#8d6d48] mx-auto relative" />
                <div className="stamp-head w-56 h-24 rounded-md border-2 border-[#3f0f0e] -mt-2 flex items-center justify-center">
                  <div className="border-4 border-[#e8ddbf] text-[#e8ddbf] font-mono text-xl font-black uppercase tracking-[0.26em] px-5 py-2 rotate-[-4deg]">{dossierText('APPROVED')}</div>
                </div>
              </div>
            </>
          )}

          <section className="dossier-scroll-field col-span-12 lg:col-span-4 min-h-0 border-r border-[#b8a57d] p-8 bg-[#d9c797]/45 relative overflow-y-auto">
            <div className="relative z-10">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#6b241e] mb-4 ink-reveal">{dossierText('Personnel Visual Record')}</div>
              <div className="bg-[#241b14] p-3 rotate-[-1.6deg] shadow-2xl mb-7">
                <div className="aspect-[4/5] bg-[#eee1bd] overflow-hidden border border-[#675139]">
                  {imageSrc ? <img src={imageSrc} alt={dossierText(agent.name)} className="archive-photo w-full h-full object-cover object-top" /> : (
                    <div className="w-full h-full flex items-center justify-center text-[#241b14] font-serif text-7xl">{avatar?.mark || agentCardInitial(agent)}</div>
                  )}
                </div>
                <div className="pt-3 flex justify-between items-center text-[#e8ddbf] font-mono text-[8px] uppercase tracking-widest"><span>{dossierText(agent.id)}</span><span>{dossierText(avatar?.license || 'Symbolic')}</span></div>
              </div>
              <h1 className="font-serif text-5xl leading-none tracking-tight text-[#201610] mb-3 ink-reveal">{agent.name}</h1>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#6d5a3d] mb-6 ink-reveal">{dossierText(profile.codename)}</div>
              <div className="space-y-3">
                {evidenceStrips.map((item, index) => (
                  <div key={item.label} className="border-l-4 border-[#8f1e18] bg-[#f5ebcc]/65 p-3 shadow-sm ink-reveal" style={{ animationDelay: `${0.1 + index * 0.08}s` }}>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] mb-1">{dossierText(item.label)}</div>
                    <div className="font-serif text-base leading-snug">{dossierText(item.value)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="dossier-scroll-cue" aria-hidden="true" />
          </section>

          <section className="dossier-scroll-field col-span-12 lg:col-span-5 min-h-0 p-8 border-r border-[#b8a57d] relative overflow-y-auto">
            <div className="flex items-center justify-between mb-6"><div><div className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#6b241e]">{dossierText('Five-Axis Capability Map')}</div><div className="font-serif text-3xl text-[#201610]">{dossierText('Operational Shape')}</div></div><Crosshair size={26} className="text-[#8f1e18]" /></div>
            <div className="grid md:grid-cols-[280px_1fr] gap-6 items-center">
              <RadarChartComponent points={profile.scores} language={profile.language} />
              <div className="space-y-3">{profile.scores.map((item, index) => (<div key={item.label} className="ink-reveal" style={{ animationDelay: `${0.12 + index * 0.06}s` }}><div className="flex justify-between font-mono text-[9px] uppercase tracking-widest mb-1"><span>{dossierText(item.label)}</span><span>{item.value}</span></div><div className="h-2 bg-[#c8b688] border border-[#a28c63] overflow-hidden"><div className="h-full bg-[#8f1e18]" style={{ width: `${item.value}%` }} /></div></div>))}</div>
            </div>
            <div className="grid md:grid-cols-2 gap-5 mt-8">
              <div className="bg-[#f6ebca]/70 border border-[#b8a57d] p-5 shadow-sm"><div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-[#8f1e18] mb-3"><Shield size={14} /> {dossierText('Strength')}</div><p className="font-serif text-lg leading-relaxed text-[#2a1e15]">{dossierText(profile.strength)}</p></div>
              <div className="bg-[#f6ebca]/70 border border-[#b8a57d] p-5 shadow-sm"><div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-[#8f1e18] mb-3"><Briefcase size={14} /> {dossierText('Usage Advice')}</div><p className="font-serif text-lg leading-relaxed text-[#2a1e15]">{dossierText(profile.advice)}</p></div>
            </div>
            {(profile.realWorldEdge || profile.signatureSkills?.length) && <div className="mt-5 bg-[#f6ebca]/70 border border-[#b8a57d] p-5 shadow-sm"><div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-[#8f1e18] mb-3"><PackageCheck size={14} /> {dossierText('Composable Skill Layer')}</div>{profile.realWorldEdge && <p className="font-serif text-lg leading-relaxed text-[#2a1e15] mb-4">{dossierText(profile.realWorldEdge)}</p>}{profile.signatureSkills?.length > 0 && <div className="flex flex-wrap gap-2">{profile.signatureSkills.map(item => <span key={item} className="border border-[#a28c63] bg-[#eadfbd] px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-[#5c251f]">{dossierText(item)}</span>)}</div>}</div>}
            <div className="mt-6 bg-[#211812] text-[#eadfbd] border border-[#5c4933] p-5 shadow-lg"><div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-red-200 mb-3"><BookOpen size={14} /> {dossierText('Summary')}</div><p className="font-serif text-xl leading-relaxed">{dossierText(profile.summary)}</p>{profile.motto && <p className="mt-4 border-l-4 border-[#8f1e18] pl-4 font-serif text-lg leading-relaxed text-[#f3dfad]">{dossierText(profile.motto)}</p>}</div>
            <div className="dossier-scroll-cue" aria-hidden="true" />
          </section>

          <aside className="dossier-scroll-field col-span-12 lg:col-span-3 min-h-0 p-8 bg-[#251b13] text-[#eadfbd] relative overflow-y-auto">
            <div className="relative z-10 flex flex-col h-full">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-red-200 mb-4">{dossierText('Director Decision')}</div>
              <div className="border border-[#7b6542] p-5 mb-6 bg-black/18"><div className="font-mono text-[9px] uppercase tracking-widest text-[#bcae86] mb-2">{dossierText(windowText.title)}</div><div className="font-serif text-2xl leading-tight mb-4">{dossierText(deploymentWindow.title)}</div><div className="font-mono text-[8px] uppercase tracking-widest text-red-200 mb-2">{dossierText(windowText.useWhen)}</div><p className="font-serif text-sm leading-relaxed text-[#efe2bd]">{dossierText(deploymentWindow.summary)}</p><div className="mt-5 grid grid-cols-2 gap-3"><div className="border border-[#59472e] p-3 bg-black/15"><div className="font-mono text-[8px] uppercase tracking-widest text-[#8d7a58] mb-1">{dossierText(windowText.strongestAxis)}</div><div className="font-serif text-sm leading-tight">{dossierText(deploymentWindow.strongestAxis)}</div></div><div className="border border-[#59472e] p-3 bg-black/15"><div className="font-mono text-[8px] uppercase tracking-widest text-[#8d7a58] mb-1">{dossierText(windowText.firstOutput)}</div><div className="font-serif text-sm leading-tight">{dossierText(deploymentWindow.shortLabel)}</div></div></div></div>
              <div className="space-y-4 font-mono text-[10px] uppercase tracking-widest text-[#cdbf98] mb-5"><div className="flex justify-between border-b border-[#59472e] pb-2"><span>{dossierText('Archive Chain')}</span><span>{dossierText('Clean')}</span></div><div className="flex justify-between border-b border-[#59472e] pb-2"><span>{dossierText('Identity Use')}</span><span>{dossierText('Style Agent')}</span></div><div className="flex justify-between border-b border-[#59472e] pb-2"><span>{dossierText('Status')}</span><span>{dossierText(isRecruited ? 'Secured' : 'Awaiting')}</span></div></div>
              <div className="mb-5 border border-[#59472e] bg-black/12 p-4"><div className="font-mono text-[9px] uppercase tracking-widest text-red-200 mb-3">{dossierText(windowText.starterBrief)}</div><div className="space-y-2">{deploymentWindow.starterSteps.map((step, index) => <div key={`${step}-${index}`} className="flex gap-3 text-[#d8c99f]"><span className="mt-0.5 font-mono text-[9px] text-[#8d7a58]">{String(index + 1).padStart(2, '0')}</span><span className="font-serif text-sm leading-snug">{dossierText(step)}</span></div>)}</div></div>
              <div className="sticky bottom-0 -mx-1 space-y-3 bg-[#251b13]/95 pt-3 pb-1 backdrop-blur-sm"><button data-testid={isInitiationMarket ? `initiation-contract-${agent.id}` : `market-contract-${agent.id}`} onClick={() => onStartContract(agent.id)} disabled={isStamping} className={`w-full flex items-center justify-center gap-3 px-5 py-4 font-mono text-[10px] uppercase tracking-widest border transition-all ${isStamping ? 'border-[#8f1e18] text-red-100 bg-[#8f1e18] cursor-wait' : 'border-[#e8ddbf] bg-[#e8ddbf] text-[#251b13] hover:-translate-y-0.5 hover:shadow-[7px_7px_0_rgba(143,30,24,0.55)]'}`}>{isRecruited ? <CheckCircle2 size={15} /> : <FileSignature size={15} />}{dossierText(isStamping ? 'Stamping Contract' : isInitiationMarket ? (isRecruited ? 'Signed for Kickoff' : 'Sign for Kickoff') : (isRecruited ? 'Assign to Project' : 'Authorize Contract'))}</button><button onClick={onClose} className="w-full flex items-center justify-center gap-3 px-5 py-4 font-mono text-[10px] uppercase tracking-widest border border-[#7b6542] text-[#e8ddbf] hover:bg-[#34271b] transition-colors"><ArrowLeft size={15} />{dossierText('Return to Market')}</button></div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
