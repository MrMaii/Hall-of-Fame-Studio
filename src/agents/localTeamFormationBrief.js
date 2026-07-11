import { createHash } from 'node:crypto';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

function checksum(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

const NEED_SIGNALS = [
  ['deployment-change', /deploy|release|rollout|上线|发布|部署/],
  ['data-migration', /migrat|database|schema|数据库|迁移/],
  ['security-sensitive', /security|secret|permission|auth|安全|权限|密钥/],
  ['evidence-intensive', /research|evidence|source|citation|研究|证据|引用/],
  ['academic-integrity-sensitive', /exam|homework|thesis|paper|考试|作业|论文/],
  ['personal-data-sensitive', /pii|personal data|student data|隐私|个人信息/],
  ['rights-sensitive', /copyright|license|brand|版权|授权|品牌/],
  ['accessibility-sensitive', /accessib|disability|accommodation|无障碍|残障/],
];

function objectiveSignals(objective = '') {
  const normalized = String(objective || '').normalize('NFKC').toLowerCase();
  return NEED_SIGNALS.filter(([, pattern]) => pattern.test(normalized)).map(([id]) => id);
}

function payloadForBrief(brief = {}) {
  const payload = { ...brief };
  delete payload.checksum;
  delete payload.generatedAt;
  delete payload.integrity;
  delete payload.status;
  return payload;
}

export function buildLocalTeamFormationBrief({ workModeTeam = null, now = new Date().toISOString() } = {}) {
  if (workModeTeam?.schemaVersion !== 'super-agent-work-mode-team/v1') {
    throw new Error('team-formation-work-mode-contract-required');
  }
  const objective = String(workModeTeam.objective || '');
  const roleCoverage = (workModeTeam.roles || []).map((role) => {
    const ownedArtifactTypes = (workModeTeam.taskNodes || [])
      .filter((task) => task.ownerRoleId === role.id)
      .map((task) => task.artifactType);
    const reviewedArtifactTypes = (workModeTeam.taskNodes || [])
      .filter((task) => task.reviewerRoleId === role.id)
      .map((task) => task.artifactType);
    const ownedRiskIds = (workModeTeam.escalationPlan || [])
      .filter((risk) => risk.ownerRoleId === role.id)
      .map((risk) => risk.id);
    return {
      roleId: role.id,
      requiredLane: role.lane,
      status: role.status,
      personaSlug: role.personaSlug || null,
      capabilityScore: Number(role.capabilityScore || 0),
      realWorldEdge: role.realWorldEdge || null,
      leadershipResponsibility: role.id.includes('lead'),
      independentReviewResponsibility: role.id.includes('reviewer'),
      ownedArtifactTypes,
      reviewedArtifactTypes,
      ownedRiskIds,
      selectionRationale: role.personaSlug
        ? `${role.personaSlug} is the highest available unassigned persona meeting the ${role.lane} lane threshold with score ${role.capabilityScore}.`
        : `No available persona met the ${role.lane} lane threshold for ${role.id}.`,
    };
  });
  const riskRows = [
    ...(workModeTeam.escalationPlan || []).map((risk) => ({
      id: risk.id,
      type: 'work-mode-escalation',
      status: risk.status,
      ownerRoleId: risk.ownerRoleId || null,
      ownerPersonaSlug: risk.ownerPersonaSlug || null,
      blockingWhenTriggered: true,
    })),
    {
      id: 'reviewer-independence',
      type: 'structural-governance',
      status: workModeTeam.reviewerIndependence?.satisfied ? 'controlled' : 'blocking',
      ownerRoleId: roleCoverage.find((role) => role.leadershipResponsibility)?.roleId || null,
      ownerPersonaSlug: roleCoverage.find((role) => role.leadershipResponsibility)?.personaSlug || null,
      blockingWhenTriggered: true,
    },
    {
      id: 'dependency-cycle',
      type: 'structural-governance',
      status: workModeTeam.dependencyDag?.acyclic ? 'controlled' : 'blocking',
      ownerRoleId: roleCoverage.find((role) => role.leadershipResponsibility)?.roleId || null,
      ownerPersonaSlug: roleCoverage.find((role) => role.leadershipResponsibility)?.personaSlug || null,
      blockingWhenTriggered: true,
    },
  ];
  const blockingGaps = [
    ...(workModeTeam.coverageGaps || []).map((roleId) => ({ type: 'role-coverage-gap', roleId, severity: 'blocking' })),
    ...roleCoverage.filter((role) => role.personaSlug && role.capabilityScore < 75)
      .map((role) => ({ type: 'low-confidence-role-match', roleId: role.roleId, capabilityScore: role.capabilityScore, severity: 'blocking' })),
    ...(workModeTeam.blockers || [])
      .filter((blocker) => !String(blocker).startsWith('role-coverage-gap:'))
      .map((blocker) => ({ type: String(blocker), severity: 'blocking' })),
  ];
  const delegationReady = Boolean(
    workModeTeam.readyForKickoff
    && workModeTeam.reviewerIndependence?.satisfied
    && workModeTeam.dependencyDag?.acyclic
    && roleCoverage.every((role) => role.personaSlug && role.capabilityScore >= 75)
    && blockingGaps.length === 0
  );
  const base = {
    schemaVersion: 'local-team-formation-brief/v1',
    workMode: workModeTeam.workMode,
    objective: {
      checksum: checksum(objective),
      length: objective.length,
      storesRawContent: false,
    },
    objectiveNeedSignalIds: objectiveSignals(objective),
    roleCoverage,
    riskRows,
    dependencySummary: {
      acyclic: Boolean(workModeTeam.dependencyDag?.acyclic),
      nodeCount: workModeTeam.dependencyDag?.nodeCount || 0,
      edgeCount: workModeTeam.dependencyDag?.edgeCount || 0,
      reviewerIndependent: Boolean(workModeTeam.reviewerIndependence?.satisfied),
    },
    delegationPlan: (workModeTeam.taskNodes || []).map((task) => ({
      artifactType: task.artifactType,
      ownerRoleId: task.ownerRoleId,
      ownerPersonaSlug: task.ownerPersonaSlug,
      reviewerRoleId: task.reviewerRoleId,
      reviewerPersonaSlug: task.reviewerPersonaSlug,
      dependsOn: task.dependsOn || [],
      acceptanceCheckIds: (task.acceptanceChecks || []).map((check) => check.id),
    })),
    blockingGaps,
    delegationReady,
    nextActions: delegationReady ? [{ id: 'start-governed-kickoff' }] : [
      ...(blockingGaps.some((gap) => gap.type === 'role-coverage-gap') ? [{ id: 'add-missing-specialists' }] : []),
      ...(blockingGaps.some((gap) => gap.type === 'low-confidence-role-match') ? [{ id: 'improve-role-confidence' }] : []),
      ...(workModeTeam.dependencyDag?.acyclic ? [] : [{ id: 'repair-dependency-cycle' }]),
      ...(!workModeTeam.reviewerIndependence?.satisfied ? [{ id: 'assign-independent-reviewer' }] : []),
    ],
    readyForProduction: false,
  };
  return { ...base, generatedAt: now, checksum: checksum(base) };
}

export function verifyLocalTeamFormationBrief(brief = {}) {
  const checksumValid = Boolean(brief.checksum) && brief.checksum === checksum(payloadForBrief(brief));
  const structureValid = brief.schemaVersion === 'local-team-formation-brief/v1'
    && Array.isArray(brief.roleCoverage)
    && Array.isArray(brief.blockingGaps);
  return { valid: checksumValid && structureValid, checksumValid, structureValid };
}

export function publicLocalTeamFormationBrief(brief = {}) {
  const integrity = verifyLocalTeamFormationBrief(brief);
  return {
    ...brief,
    integrity,
    status: !integrity.valid ? 'integrity-invalid' : brief.delegationReady ? 'delegation-ready' : 'team-formation-blocked',
    delegationReady: integrity.valid && Boolean(brief.delegationReady),
  };
}
