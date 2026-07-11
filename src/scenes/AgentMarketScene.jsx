import {
  CheckCircle2,
  FileSignature,
  Fingerprint,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { localizeText } from '../i18n/index.jsx';

export default function AgentMarketScene({
  isDecrypting,
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
  activeLanguage,
}) {
  return (
    <div className="flex-1 overflow-y-auto fade-in bg-[#f5f4f0] flex flex-col relative">
      {isDecrypting && (
        <div className="absolute inset-0 bg-[#f5f4f0] z-50 flex flex-col items-center justify-center font-mono text-xs uppercase tracking-widest text-black">
          <Fingerprint size={48} className="mb-4 animate-pulse" />
          <span>Decrypting Pantheon Archives...</span>
          <span className="text-gray-400 mt-2">Clearance Level: Director</span>
        </div>
      )}

      <div className="sticky top-0 z-40 bg-[#f5f4f0] border-b border-[#d1d0c9] px-12 py-8 pt-12 shadow-[0_10px_30px_rgba(245,244,240,0.9)]">
        {isInitiationMarket && (
          <div data-testid="initiation-talent-market" className="mb-6 border border-[#1a1a1a] bg-[#1a1a1a] px-4 py-3 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-widest text-[#d8c99f]">Initiation Talent Market</div>
                <div data-testid="initiation-signed-team" className="font-serif text-xl leading-tight truncate">
                  Signed team: {signedInitiationNames || 'None yet'}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={onBackToInvite} className="border border-[#7b6542] px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-[#efe2bd] hover:border-[#efe2bd]">
                  Back
                </button>
                <button type="button" data-testid="initiation-next-lobby" onClick={onContinueInitiation} disabled={initiationTalentMemberCount === 0} className="bg-[#8f1e18] px-4 py-2 font-mono text-[9px] uppercase tracking-widest text-white disabled:bg-[#3a2a1c] disabled:text-[#7d6a49]">
                  Next: Meeting Prep
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="font-serif text-6xl tracking-tight mb-2 decrypt-text">The Pantheon.</h1>
            <div className="flex items-center gap-3 font-mono text-[10px] text-gray-500 uppercase tracking-widest mt-3">
              <span className="bg-[#1a1a1a] text-white px-2 py-0.5">TOP SECRET</span>
              <span>Global Talent Archives</span>
            </div>
          </div>
          <div className="flex items-center border-b-2 border-[#d1d0c9] w-80 pb-2 focus-within:border-black transition-colors">
            <Search size={18} className="text-gray-400 mr-3" />
            <input type="text" value={marketSearch} onChange={(event) => onMarketSearch(event.target.value)} placeholder="Query archives..." className="bg-transparent border-none outline-none font-mono text-sm w-full placeholder-gray-400 uppercase tracking-wider" />
          </div>
        </div>
        <div className="flex items-center gap-6 overflow-x-auto pb-2 -mb-2">
          <SlidersHorizontal size={18} className="text-gray-400 shrink-0" />
          <div className="flex gap-2">
            {categories.map((category) => (
              <button key={category} onClick={() => onMarketCategory(category)} className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 transition-all whitespace-nowrap border ${marketCategory === category ? 'bg-black text-white border-black' : 'bg-transparent text-gray-500 border-[#d1d0c9] hover:border-black hover:text-black'}`}>
                {category}
              </button>
            ))}
          </div>
          <span className="ml-auto font-mono text-[10px] text-gray-400 uppercase tracking-widest shrink-0 border-l border-[#d1d0c9] pl-6">
            {rows.length} Records Found
          </span>
        </div>
      </div>

      <div className="p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {rows.map(({ agent, isRecruited, deploymentWindow, skillActive }) => (
          <div key={agent.id} role="button" tabIndex={0} onClick={() => onOpenDossier(agent.id)} onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') onOpenDossier(agent.id);
          }} className="dossier-card group flex flex-col cursor-pointer focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-4 focus:ring-offset-[#f5f4f0]">
            <div className="px-5 py-3 border-b border-[#d1d0c9] bg-[#ebe9e0] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-black rounded-full opacity-30" />
                <span className="font-mono text-[9px] uppercase tracking-widest text-gray-600">ID:{agent.id}</span>
              </div>
              <div className="h-4 flex items-center opacity-40">{generateBarcode(agent.id)}</div>
            </div>
            <div className="p-6 border-b border-[#ebe9e0] flex gap-4 items-start relative">
              <AvatarComponent agent={agent} />
              <div className="flex flex-col pt-1 min-w-0">
                <h3 className="font-serif text-2xl font-bold leading-tight tracking-tight mb-1.5 break-words">{renderKnownName(agent.knownName)}</h3>
                <div className="mb-2 border-l-[3px] border-red-600/35 pl-2.5">
                  <span className="font-mono text-[8px] uppercase tracking-widest text-gray-400 block mb-0.5">Primary identity</span>
                  <p className="font-serif text-[13px] text-gray-800 leading-snug line-clamp-2">{agent.primaryIdentity}</p>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-gray-500 bg-gray-100 px-1.5 py-0.5 self-start border border-gray-200">{agent.role}</span>
              </div>
              {isRecruited && <div className="absolute top-4 right-4 stamp-active pointer-events-none z-20 flex items-center justify-center"><div className="border-4 border-[#1a1a1a] text-[#1a1a1a] font-mono text-sm font-bold uppercase tracking-widest px-2 py-1 transform rotate-[-15deg] mix-blend-multiply opacity-90">CONTRACTED</div></div>}
            </div>
            <div className="p-6 flex-1 bg-[#fdfdfc] border-b border-[#ebe9e0] relative">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-block px-2 py-0.5 bg-[#1a1a1a] text-white font-mono text-[8px] uppercase tracking-widest">CLASS: {agent.category}</span>
                {skillActive && <span className="inline-block px-2 py-0.5 bg-[#8f1e18] text-white font-mono text-[8px] uppercase tracking-widest">SKILL ACTIVE</span>}
              </div>
              <p className="font-serif text-gray-800 text-[15px] leading-relaxed relative z-10">{agent.desc}</p>
            </div>
            <div className="p-4 flex items-center justify-between border-t border-[#1a1a1a] bg-white">
              <div className="min-w-0 border-l-2 border-[#8f1e18] pl-3 pr-3">
                <div className="font-mono text-[8px] uppercase tracking-widest text-gray-400">Best Window</div>
                <div className="max-w-[11rem] truncate font-serif text-sm leading-tight text-gray-800">{localizeText(deploymentWindow.shortLabel, activeLanguage)}</div>
              </div>
              <button data-testid={`market-open-${agent.id}`} onClick={(event) => { event.stopPropagation(); onOpenDossier(agent.id); }} className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest px-4 py-2 transition-colors ${isRecruited ? 'bg-transparent text-gray-500 border border-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}>
                {isRecruited ? <CheckCircle2 size={12} /> : <FileSignature size={12} />}
                {isRecruited ? 'Review File' : 'Open File'}
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="col-span-full py-32 flex flex-col items-center justify-center text-gray-400">
            <Search size={48} className="mb-6 opacity-20" />
            <p className="font-serif text-3xl mb-2 text-gray-800">No classified records found.</p>
            <p className="font-mono text-xs uppercase tracking-widest">Adjust clearance filters or query parameters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
