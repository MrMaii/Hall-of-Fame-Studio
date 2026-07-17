import { getPersonSkill } from '../skills/personSkillSystem.js';
import AgentMarketScene from './AgentMarketScene.jsx';

export default function AgentMarketRouteView({ view }) {
  const {
    LEGENDARY_AGENTS,
    PantheonAvatar,
    activeLanguage,
    continueInitiationFromMarket,
    generateBarcode,
    getAgentDeploymentWindow,
    getDossierProfile,
    initiationInviteIds,
    initiationTalentMembers,
    isDecrypting,
    marketCategory,
    marketMode,
    marketSearch,
    openMarketDossier,
    recruitedIds,
    renderKnownName,
    setActiveRoute,
    setInitiationStep,
    setMarketCategory,
    setMarketSearch,
  } = view;

  const categories = ['All', 'Visionary', 'Strategy', 'Analytical', 'Science', 'Creative', 'Psychology', 'Finance', 'Operations'];
  const isInitiationMarket = marketMode === 'initiation';
  const signedMarketIds = isInitiationMarket ? initiationInviteIds : recruitedIds;
  const signedInitiationNames = initiationTalentMembers.map(member => member.name).join(' / ');
  const rows = LEGENDARY_AGENTS.filter(agent => {
    const query = marketSearch.toLowerCase();
    const matchesSearch = agent.name.toLowerCase().includes(query)
      || agent.role.toLowerCase().includes(query)
      || agent.desc.toLowerCase().includes(query)
      || (agent.primaryIdentity && agent.primaryIdentity.toLowerCase().includes(query));
    return matchesSearch && (marketCategory === 'All' || agent.category === marketCategory);
  }).map((agent) => {
    const profile = getDossierProfile(agent, activeLanguage);
    return {
      agent,
      isRecruited: signedMarketIds.includes(agent.id),
      deploymentWindow: getAgentDeploymentWindow(agent, profile, activeLanguage),
      skillActive: Boolean(getPersonSkill(agent.id)),
    };
  });

  return (
    <AgentMarketScene
      isDecrypting={isDecrypting}
      isInitiationMarket={isInitiationMarket}
      signedInitiationNames={signedInitiationNames}
      initiationTalentMemberCount={initiationTalentMembers.length}
      marketSearch={marketSearch}
      onMarketSearch={setMarketSearch}
      categories={categories}
      marketCategory={marketCategory}
      onMarketCategory={setMarketCategory}
      rows={rows}
      onOpenDossier={openMarketDossier}
      onBackToInvite={() => { setInitiationStep('invite'); setActiveRoute('project_initiation'); }}
      onContinueInitiation={continueInitiationFromMarket}
      AvatarComponent={PantheonAvatar}
      renderKnownName={renderKnownName}
      generateBarcode={generateBarcode}
      activeLanguage={activeLanguage}
    />
  );
}
