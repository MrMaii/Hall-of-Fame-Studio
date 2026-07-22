const WORK_KIND_POLICY = Object.freeze({
  research: {
    requiredTools: ['search', 'analysis', 'workspace'],
    providerRequired: true,
    minimumSources: 3,
    acceptanceCriteria: [
      'Use traceable provider-backed sources and record conflicting evidence.',
      'Produce a task-specific synthesis that states limitations and a testable conclusion.',
      'Obtain an independent accepted review before task completion.',
    ],
  },
  'technical-delivery': {
    requiredTools: ['workspace', 'test', 'build'],
    providerRequired: false,
    minimumSources: 0,
    acceptanceCriteria: [
      'Produce a concrete code or configuration delta linked to the task.',
      'Attach fresh test or runtime verification evidence.',
      'Obtain an accepted review before task completion.',
    ],
  },
  creative: {
    requiredTools: ['workspace', 'evaluation'],
    providerRequired: false,
    minimumSources: 0,
    acceptanceCriteria: [
      'Produce at least two materially different alternatives.',
      'Evaluate the selected alternative against the project objective.',
      'Obtain an accepted review before task completion.',
    ],
  },
  operations: {
    requiredTools: ['inspection', 'workspace', 'verification'],
    providerRequired: false,
    minimumSources: 0,
    acceptanceCriteria: [
      'Record the inspected state before making a change.',
      'Record the exact approved change and recovery boundary.',
      'Attach fresh post-change verification and obtain accepted review.',
    ],
  },
  general: {
    requiredTools: ['workspace', 'verification'],
    providerRequired: false,
    minimumSources: 0,
    acceptanceCriteria: [
      'Produce a task-specific durable deliverable.',
      'Attach verification evidence and obtain accepted review.',
    ],
  },
});

const COORDINATION_ONLY_PATTERNS = [
  /continue (?:the )?next work pulse/i,
  /publish timeline evidence/i,
  /coordination (?:ledger|update)/i,
  /received[,.]? i will continue/i,
  /report (?:material )?progress/i,
  /继续(?:下一个|下一).*工作/i,
  /协调(?:台账|更新)/i,
  /收到.*(?:继续|推进|汇报)/i,
];

function text(value) {
  return String(value || '').trim();
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function projectText(project = {}) {
  return [
    project.name,
    project.objective,
    project.currentObjective,
    project.brief,
    project.summary,
    ...(project.tasks || []).flatMap((task) => [task.text, task.title, task.workDefinition?.deliverable]),
  ].filter(Boolean).join(' ').toLowerCase();
}

function classifyWorkCorpus(corpus = '') {
  if (/\b(code|software|api|bug|build|deploy|implementation|test)\b|代码|软件|接口|修复|构建|部署|测试/.test(corpus)) {
    return 'technical-delivery';
  }
  if (/\b(inspect|incident|production health|operate|operations|recovery|runbook)\b|巡检|生产健康|运维|事故|恢复|运行手册/.test(corpus)) {
    return 'operations';
  }
  if (/\b(research|study|paper|literature|citation)\b|研究|学习|论文|文献|引用/.test(corpus)) {
    return 'research';
  }
  if (/\b(design|creative|campaign|visual|brand|prototype)\b|设计|创意|视觉|品牌|原型/.test(corpus)) {
    return 'creative';
  }
  if (/\b(evidence|source|analysis)\b|证据|来源|分析/.test(corpus)) {
    return 'research';
  }
  return 'general';
}

export function classifyProjectWork(project = {}) {
  const workMode = text(project.workModeContract?.workMode || project.workMode).toLowerCase();
  const explicitWorkModes = {
    'technical-delivery': 'technical-delivery',
    'creative-studio': 'creative',
    'academic-writing': 'research',
    investigation: 'research',
    learning: 'research',
  };
  if (explicitWorkModes[workMode]) {
    return { kind: explicitWorkModes[workMode], source: 'work-mode' };
  }

  const primaryKind = classifyWorkCorpus(projectText({ ...project, tasks: [] }));
  if (primaryKind !== 'general') return { kind: primaryKind, source: 'project-intent' };

  const aggregateKind = classifyWorkCorpus(projectText(project));
  return aggregateKind === 'general'
    ? { kind: 'general', source: 'default' }
    : { kind: aggregateKind, source: 'project-task-intent' };
}

export function classifyTaskWork({ project = {}, task = {}, agent = {} } = {}) {
  const roleSignal = text(`${agent.role || ''} ${agent.title || ''} ${agent.skill || ''}`).toLowerCase();
  const taskSignal = text(`${task.text || ''} ${task.title || ''} ${task.workDefinition?.deliverable || ''}`).toLowerCase();
  const managementRole = /\b(leader|director|manager|supervisor|coordinator|chief of staff|project lead)\b|负责人|总监|经理|主管|统筹|协调/.test(roleSignal);
  const managementTask = /\b(coordinate|manage|supervise|approve|assign|schedule|status report|delivery plan|deadline|dependency)\b|统筹|协调|监督|审批|分配|排期|进度报告|交付计划|截止时间|依赖/.test(taskSignal);
  const specialistTask = /\b(research|evidence|study|paper|literature|source|citation|analysis|code|software|api|bug|build|deploy|test|design|creative|campaign|visual|prototype|inspect|incident|recovery|runbook)\b|研究|证据|论文|文献|来源|引用|分析|代码|软件|接口|修复|构建|部署|测试|设计|创意|视觉|原型|巡检|事故|恢复|运行手册/.test(taskSignal);

  if (managementRole && managementTask && !specialistTask) {
    return { kind: 'general', source: 'role-task-intent' };
  }
  const taskClassification = classifyProjectWork({
    name: task.text || task.title || '',
    objective: task.workDefinition?.deliverable || '',
  });
  return taskClassification.kind === 'general'
    ? classifyProjectWork(project)
    : { ...taskClassification, source: 'task-intent' };
}

export function normalizeOutcomeWorkContract({ project = {}, task = {}, agent = {} } = {}) {
  const classification = classifyTaskWork({ project, task, agent });
  const policy = WORK_KIND_POLICY[classification.kind] || WORK_KIND_POLICY.general;
  const workDefinition = task.workDefinition || {};
  const candidateReviewerAgentId = task.reviewerAgentId
    || project.kickoffCharter?.governance?.reviewerId
    || project.initiation?.kickoffCharter?.governance?.reviewerId
    || project.governance?.reviewerId
    || (project.team || []).find((member) => member.id !== (task.ownerId || agent.id) && /review|critic|evidence|risk|审查|评审/i.test(`${member.role || ''} ${member.title || ''}`))?.id
    || null;
  const ownerId = task.ownerId || task.assigneeId || agent.id || null;
  const team = project.team || [];
  const candidateReviewer = team.find((member) => member.id === candidateReviewerAgentId || member.name === candidateReviewerAgentId);
  const reviewerAgentId = candidateReviewer && String(candidateReviewer.id) !== String(ownerId)
    ? candidateReviewer.id
    : team.find((member) => String(member.id) !== String(ownerId) && /review|critic|evidence|risk/i.test(`${member.role || ''} ${member.title || ''}`))?.id
      || team.find((member) => String(member.id) !== String(ownerId))?.id
      || null;
  const acceptanceCriteria = unique([
    ...(workDefinition.acceptanceCriteria || []),
    ...policy.acceptanceCriteria,
  ]);

  return {
    schemaVersion: 'outcome-work-contract/v1',
    projectId: project.id || null,
    taskId: task.id || null,
    ownerId,
    reviewerAgentId,
    actionType: classification.kind,
    deliverable: text(workDefinition.deliverable || task.deliverable || task.text || task.title || 'Task-specific durable deliverable'),
    requiredTools: unique([...(workDefinition.requiredTools || []), ...policy.requiredTools]),
    evidencePolicy: {
      providerRequired: Boolean(policy.providerRequired),
      minimumSources: policy.minimumSources,
      fallbackCountsAsEvidence: false,
      acceptedReviewRequired: true,
    },
    acceptanceCriteria,
    dueAt: task.dueAt || null,
    handoffTargetId: reviewerAgentId,
    source: classification.source,
  };
}

function substantiveText(value = '', task = {}) {
  const candidate = text(value);
  if (candidate.length < 120) return false;
  if (COORDINATION_ONLY_PATTERNS.some((pattern) => pattern.test(candidate))) return false;
  const taskCorpus = text(`${task.text || ''} ${task.title || ''} ${task.workDefinition?.deliverable || ''}`).toLowerCase();
  const wordTerms = taskCorpus
    .toLowerCase()
    .split(/[\s,.;:!?，。；：！？、/\\()[\]{}"']+/)
    .filter((term) => term.length >= 3)
    .slice(0, 16);
  const hanTerms = [...taskCorpus.matchAll(/[\p{Script=Han}]{2,}/gu)]
    .flatMap(([sequence]) => Array.from({ length: Math.max(0, sequence.length - 1) }, (_, index) => sequence.slice(index, index + 2)))
    .slice(0, 32);
  const taskTerms = unique([...wordTerms, ...hanTerms]);
  if (!taskTerms.length) return true;
  const lowered = candidate.toLowerCase();
  return taskTerms.some((term) => lowered.includes(term));
}

function providerBackedEvidence(record = {}, minimumSources = 1) {
  const provider = text(record.provider).toLowerCase();
  const mode = text(record.searchMode).toLowerCase();
  const localOrManual = !provider
    || ['manual', 'agent-recorded', 'agent-autonomous-worker', 'deterministic'].includes(provider)
    || /fallback|worker-local|manual/.test(mode);
  return !localOrManual
    && record.status !== 'failed'
    && (record.sources || []).filter((source) => source?.url || source?.id || source?.title).length >= minimumSources;
}

function submissionProofTypes(submission = {}) {
  return new Set([
    ...(submission.sourceRefs || []).map((reference) => text(reference?.type).toLowerCase()),
    ...(submission.verificationEvidence || []).map((reference) => text(reference?.type || reference).toLowerCase()),
  ].filter(Boolean));
}

function countCreativeAlternatives(value = '') {
  const matches = text(value).match(/(?:^|\n|[.;。；])\s*(?:#{1,4}\s*)?(?:alternative|option|concept|方案|选项|概念)\s*[a-z0-9一二三四五六七八九十]+\b/gim) || [];
  return new Set(matches.map((match) => match.trim().toLowerCase())).size;
}

export function evaluateMaterialOutcome({
  project = {},
  task = {},
  agent = {},
  artifact = null,
  evidenceSearches = project.evidenceSearches || [],
  submissions = project.agentSubmissions || [],
  reviews = project.submissionReviews || [],
} = {}) {
  const contract = normalizeOutcomeWorkContract({ project, task, agent });
  const taskSubmissions = submissions.filter((submission) => !task.id || String(submission.taskId || '') === String(task.id));
  const latestSubmission = taskSubmissions[0] || null;
  const artifactText = text(artifact?.content || artifact?.body || latestSubmission?.body || latestSubmission?.description);
  const workingDraftOnly = (latestSubmission?.tags || []).includes('working-draft');
  const substantiveArtifact = !workingDraftOnly && Boolean(artifact || latestSubmission) && substantiveText(artifactText, task);
  const providerEvidence = evidenceSearches.filter((record) => (
    (!task.id || !record.taskId || String(record.taskId) === String(task.id))
    && providerBackedEvidence(record, contract.evidencePolicy.minimumSources || 1)
  ));
  const evidenceReady = !contract.evidencePolicy.providerRequired || providerEvidence.length > 0;
  const acceptedReview = reviews.find((review) => (
    review.verdict === 'accepted'
    && (!latestSubmission || String(review.submissionId || '') === String(latestSubmission.id))
    && (!task.id || !review.taskId || String(review.taskId) === String(task.id))
  )) || null;
  const proofTypes = submissionProofTypes(latestSubmission || {});
  const technicalProofReady = contract.actionType !== 'technical-delivery' || (
    [...proofTypes].some((type) => /workspace-change|code-diff|commit/.test(type))
    && [...proofTypes].some((type) => /test|build|runtime-verification/.test(type))
  );
  const operationsProofReady = contract.actionType !== 'operations' || (
    [...proofTypes].some((type) => /inspection|state-before/.test(type))
    && [...proofTypes].some((type) => /approved-change|workspace-change|operation/.test(type))
    && [...proofTypes].some((type) => /verification|health-check|state-after/.test(type))
  );
  const creativeProofReady = contract.actionType !== 'creative' || countCreativeAlternatives(artifactText) >= 2;
  const blockers = [
    contract.evidencePolicy.providerRequired && !evidenceReady ? 'provider-evidence-required' : null,
    !substantiveArtifact ? 'substantive-artifact-required' : null,
    !technicalProofReady ? 'technical-change-and-verification-proof-required' : null,
    !operationsProofReady ? 'inspection-change-and-verification-proof-required' : null,
    !creativeProofReady ? 'two-creative-alternatives-required' : null,
    !latestSubmission ? 'reviewable-submission-required' : null,
    !acceptedReview ? 'accepted-review-required' : null,
  ].filter(Boolean);
  const material = Boolean(substantiveArtifact && evidenceReady && technicalProofReady && operationsProofReady && creativeProofReady && latestSubmission);
  const accepted = Boolean(material && acceptedReview);
  const checksum = artifact?.checksum
    || artifact?.artifactChecksum
    || artifact?.contentChecksum
    || latestSubmission?.checksum
    || latestSubmission?.artifactChecksum
    || latestSubmission?.artifactStorageProofChecksum
    || null;
  const version = Number(artifact?.version || artifact?.contentVersion || latestSubmission?.version || 1);

  return {
    schemaVersion: 'material-outcome-evaluation/v1',
    contract,
    material,
    accepted,
    status: accepted ? 'accepted' : material ? 'review-required' : 'blocked-no-material-outcome',
    blockers,
    providerEvidenceSearchIds: providerEvidence.map((record) => record.id).filter(Boolean),
    submissionId: latestSubmission?.id || null,
    acceptedReviewId: acceptedReview?.id || null,
    handoff: material ? {
      schemaVersion: 'material-handoff/v1',
      artifactId: artifact?.id || latestSubmission?.artifactId || latestSubmission?.id || null,
      submissionId: latestSubmission?.id || null,
      version,
      checksum,
      evidenceSearchIds: providerEvidence.map((record) => record.id).filter(Boolean),
      openQuestions: unique(latestSubmission?.openQuestions || []),
      nextOwnerId: contract.handoffTargetId,
      reviewId: acceptedReview?.id || null,
    } : null,
  };
}

export function calculateOutcomeProgress(project = {}) {
  const tasks = project.tasks || [];
  if (!tasks.length) return 0;
  const acceptedCount = tasks.filter((task) => task.outcome?.accepted === true).length;
  return Math.round((acceptedCount / tasks.length) * 100);
}

export function buildNoMaterialDeltaState({ previous = null, material = false, now = new Date().toISOString() } = {}) {
  const consecutiveNoMaterialCycles = material ? 0 : Number(previous?.consecutiveNoMaterialCycles || 0) + 1;
  return {
    schemaVersion: 'no-material-delta-state/v1',
    status: material
      ? 'productive'
      : consecutiveNoMaterialCycles >= 2
        ? 'STALLED_NO_MATERIAL_DELTA'
        : 'watching',
    consecutiveNoMaterialCycles,
    lastMaterialAt: material ? now : previous?.lastMaterialAt || null,
    lastCheckedAt: now,
    recoveryAction: !material && consecutiveNoMaterialCycles >= 2
      ? 'stop-coordination-and-run-provider-preflight-or-replan'
      : null,
  };
}

export { WORK_KIND_POLICY };
