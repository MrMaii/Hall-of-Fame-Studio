import {
  PERSON_SKILL_COUNT,
  PERSON_SKILL_DOC_COUNT,
} from '../skills/personSkillSystem.js';
import { localizeText } from '../i18n/index.jsx';
import AgentDossierScene from './AgentDossierScene.jsx';

export default function AgentDossierRouteView({ view }) {
  const {
    LEGENDARY_AGENTS,
    RadarChart,
    activeLanguage,
    agentCardInitial,
    closeMarketDossier,
    getAgentDeploymentWindow,
    getDossierProfile,
    initiationInviteIds,
    marketMode,
    pantheonAvatarMeta,
    pantheonAvatarSrc,
    recruitedIds,
    selectedMarketAgent,
    signingAgentId,
    startContractStamp,
  } = view;

  const agent = selectedMarketAgent || LEGENDARY_AGENTS[0];
  const isInitiationMarket = marketMode === 'initiation';
  const isRecruited = isInitiationMarket ? initiationInviteIds.includes(agent.id) : recruitedIds.includes(agent.id);
  const profile = getDossierProfile(agent, activeLanguage);
  const deploymentWindow = getAgentDeploymentWindow(agent, profile, activeLanguage);
  const skill = profile.skill || null;
  const evidenceStrips = [
    { label: 'Primary Identity', value: agent.primaryIdentity },
    { label: 'Operational Class', value: agent.category },
    { label: 'Best Window', value: deploymentWindow.shortLabel },
    ...(skill ? [
      { label: 'Skill Runtime', value: profile.skillStats || `Registered / ${skill.defaultFormat.length} steps` },
      ...(profile.professionalSkillRuntime ? [{ label: 'Callable Skills', value: profile.professionalSkillRuntime }] : []),
      ...(profile.realWorldEdge ? [{ label: 'Reality Edge', value: profile.realWorldEdge }] : []),
      ...(profile.skillLoaded ? [{ label: 'Skill File', value: profile.skillPath }] : []),
    ] : []),
  ];

  return (
    <AgentDossierScene
      agent={agent}
      isInitiationMarket={isInitiationMarket}
      isRecruited={isRecruited}
      isStamping={signingAgentId === agent.id}
      profile={{ ...profile, language: activeLanguage }}
      deploymentWindow={deploymentWindow}
      skill={skill}
      avatar={pantheonAvatarMeta(agent.id)}
      imageSrc={pantheonAvatarSrc(agent.id)}
      evidenceStrips={evidenceStrips}
      dossierText={(value) => localizeText(value, activeLanguage)}
      personSkillCount={PERSON_SKILL_COUNT}
      personSkillDocCount={PERSON_SKILL_DOC_COUNT}
      RadarChartComponent={RadarChart}
      agentCardInitial={agentCardInitial}
      onClose={closeMarketDossier}
      onStartContract={startContractStamp}
    />
  );
}
