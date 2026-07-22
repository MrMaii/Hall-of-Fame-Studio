import {
  CheckCircle2,
  FileSignature,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { localizeText } from '../i18n/index.jsx';

export default function AgentMarketScene({
  isInitiationMarket,
  signedInitiationNames,
  initiationTalentMemberCount,
  marketSearch,
  onMarketSearch,
  categories,
  marketCategory,
  onMarketCategory,
  rows,
  onOpenDossier,
  onBackToInvite,
  onContinueInitiation,
  AvatarComponent,
  renderKnownName,
  generateBarcode,
  activeLanguage = 'zh',
}) {
  const text = (chinese, english) => activeLanguage === 'en' ? english : chinese;

  return (
    <div className="flex-1 overflow-y-auto fade-in bg-[#f5f4f0] flex flex-col relative">
      <div className="sticky top-0 z-40 bg-[#f5f4f0] border-b border-[#d1d0c9] px-6 py-7 pt-8 shadow-[0_10px_30px_rgba(245,244,240,0.9)] md:px-12 md:py-8 md:pt-12">
        {isInitiationMarket && (
          <div data-testid="initiation-talent-market" className="mb-6 border border-[#1a1a1a] bg-[#1a1a1a] px-4 py-3 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-xs uppercase tracking-widest text-[#d8c99f]">{text('立项团队选择', 'Project team selection')}</div>
                <div data-testid="initiation-signed-team" className="font-serif text-xl leading-tight truncate">
                  {text('已选团队：', 'Selected team: ')}{signedInitiationNames || text('尚未选择', 'Not selected yet')}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={onBackToInvite} className="border border-[#7b6542] px-3 py-2 font-mono text-xs uppercase tracking-widest text-[#efe2bd] hover:border-[#efe2bd]">
                  {text('返回', 'Back')}
                </button>
                <button type="button" data-testid="initiation-next-lobby" onClick={onContinueInitiation} disabled={initiationTalentMemberCount === 0} className="bg-[#8f1e18] px-4 py-2 font-mono text-xs uppercase tracking-widest text-white disabled:bg-[#3a2a1c] disabled:text-[#bcae86]">
                  {text('下一步：准备会议', 'Next: Prepare meeting')}
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-serif text-6xl tracking-tight mb-2 decrypt-text">{text('人才市场', 'Talent Market')}</h1>
            <div className="flex items-center gap-3 font-mono text-xs text-gray-600 uppercase tracking-widest mt-3">
              <span>{text('选择适合当前工作的专业成员', 'Choose specialists for the current work')}</span>
            </div>
          </div>
          <div className="flex w-full items-center border-b-2 border-[#d1d0c9] pb-2 transition-colors focus-within:border-black lg:w-80">
            <Search size={18} className="text-gray-400 mr-3" />
            <input type="text" value={marketSearch} onChange={(event) => onMarketSearch(event.target.value)} placeholder={text('搜索姓名、角色或能力...', 'Search name, role, or capability...')} aria-label={text('搜索人才', 'Search talent')} className="bg-transparent border-none outline-none font-mono text-sm w-full placeholder-gray-400 tracking-wider" />
          </div>
        </div>
        <div className="flex items-center gap-6 overflow-x-auto pb-2 -mb-2">
          <SlidersHorizontal size={18} className="text-gray-400 shrink-0" />
          <div className="flex gap-2">
            {categories.map((category) => (
              <button key={category} onClick={() => onMarketCategory(category)} className={`font-mono text-xs uppercase tracking-widest px-3 py-1.5 transition-all whitespace-nowrap border ${marketCategory === category ? 'bg-black text-white border-black' : 'bg-transparent text-gray-600 border-[#d1d0c9] hover:border-black hover:text-black'}`}>
                {category}
              </button>
            ))}
          </div>
          <span className="ml-auto font-mono text-xs text-gray-600 uppercase tracking-widest shrink-0 border-l border-[#d1d0c9] pl-6">
            {rows.length} {text('位候选成员', 'candidates')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 md:p-12 lg:grid-cols-3 2xl:grid-cols-4">
        {rows.map(({ agent, isRecruited, deploymentWindow, skillActive }) => (
          <article key={agent.id} className="dossier-card group flex flex-col">
            <div className="px-5 py-3 border-b border-[#d1d0c9] bg-[#ebe9e0] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-black rounded-full opacity-30" />
                <span className="font-mono text-xs uppercase tracking-widest text-gray-600">{text('候选成员', 'Candidate')}</span>
              </div>
            </div>
            <div className="p-6 border-b border-[#ebe9e0] flex gap-4 items-start relative">
              <AvatarComponent agent={agent} accessibleName={localizeText(agent.name, activeLanguage)} />
              <div className="flex flex-col pt-1 min-w-0">
                <h3 className="font-serif text-2xl font-bold leading-tight tracking-tight mb-1.5 break-words">
                  {activeLanguage === 'zh' ? localizeText(agent.name, activeLanguage) : renderKnownName(agent.knownName)}
                </h3>
                <div className="mb-2 border-l-[3px] border-red-600/35 pl-2.5">
                  <span className="font-mono text-xs uppercase tracking-widest text-gray-600 block mb-0.5">{text('主要经历', 'Primary experience')}</span>
                  <p className="font-serif text-[13px] text-gray-800 leading-snug line-clamp-2">{localizeText(agent.primaryIdentity, activeLanguage)}</p>
                </div>
                <span className="font-mono text-xs uppercase tracking-widest text-gray-600 bg-gray-100 px-1.5 py-0.5 self-start border border-gray-200">{localizeText(agent.role, activeLanguage)}</span>
              </div>
              {isRecruited && <div className="absolute top-4 right-4 stamp-active pointer-events-none z-20 flex items-center justify-center"><div className="border-4 border-[#1a1a1a] text-[#1a1a1a] font-mono text-sm font-bold uppercase tracking-widest px-2 py-1 transform rotate-[-15deg] mix-blend-multiply opacity-90">{text('已加入', 'Joined')}</div></div>}
            </div>
            <div className="p-6 flex-1 bg-[#fdfdfc] border-b border-[#ebe9e0] relative">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-block px-2 py-0.5 bg-[#1a1a1a] text-white font-mono text-xs uppercase tracking-widest">{text('专长：', 'Specialty: ')}{localizeText(agent.category, activeLanguage)}</span>
                {skillActive && <span className="inline-block px-2 py-0.5 bg-[#8f1e18] text-white font-mono text-xs uppercase tracking-widest">{text('能力已就绪', 'Capability ready')}</span>}
              </div>
              <p className="font-serif text-gray-800 text-[15px] leading-relaxed relative z-10">{localizeText(agent.desc, activeLanguage)}</p>
            </div>
            <div className="p-4 flex items-center justify-between border-t border-[#1a1a1a] bg-white">
              <div className="min-w-0 border-l-2 border-[#8f1e18] pl-3 pr-3">
                <div className="font-mono text-xs uppercase tracking-widest text-gray-600">{text('最适合', 'Best for')}</div>
                <div className="max-w-[11rem] truncate font-serif text-sm leading-tight text-gray-800">{localizeText(deploymentWindow.shortLabel, activeLanguage)}</div>
              </div>
              <button data-testid={`market-open-${agent.id}`} onClick={(event) => { event.stopPropagation(); onOpenDossier(agent.id); }} className={`flex items-center gap-2 font-mono text-xs uppercase tracking-widest px-4 py-2 transition-colors ${isRecruited ? 'bg-transparent text-gray-600 border border-gray-300' : 'bg-black text-white hover:bg-gray-800'}`}>
                {isRecruited ? <CheckCircle2 size={12} /> : <FileSignature size={12} />}
                {isRecruited ? text('查看成员', 'Review File') : isInitiationMarket ? text('查看并选择', 'Review and select') : text('打开档案', 'Open File')}
              </button>
            </div>
          </article>
        ))}
        {rows.length === 0 && (
          <div className="col-span-full py-32 flex flex-col items-center justify-center text-gray-400">
            <Search size={48} className="mb-6 opacity-20" />
            <p className="font-serif text-3xl mb-2 text-gray-800">{text('没有找到合适的成员', 'No suitable members found')}</p>
            <p className="font-mono text-xs uppercase tracking-widest">{text('请调整分类或搜索词', 'Adjust the category or search terms')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
