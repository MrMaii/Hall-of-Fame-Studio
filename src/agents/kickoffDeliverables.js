const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

const safeFileStem = value => clean(value)
  .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '-')
  .replace(/[. ]+$/g, '');

const extensionFor = (value = '') => {
  const match = clean(value).match(/(\.[a-z0-9]{1,10})$/i);
  return match?.[1]?.toLowerCase() || '';
};

const formatLabels = {
  '.md': 'Markdown',
  '.pdf': 'PDF',
  '.docx': 'Word',
  '.xlsx': 'Excel',
  '.csv': 'CSV',
  '.pptx': 'PowerPoint',
  '.html': 'Web page',
  '.png': 'Image',
  '.jpg': 'Image',
  '.jpeg': 'Image',
};

function resolveOwner(team = [], deliverable = {}, fallbackOwnerId = '') {
  return team.find(member => member.id === deliverable.ownerId || member.name === deliverable.ownerName || member.name === deliverable.assignee)
    || team.find(member => member.id === fallbackOwnerId || member.isLeader)
    || team[0]
    || null;
}

export function normalizeKickoffDeliverables({
  deliverables = [],
  team = [],
  fallbackOwnerId = '',
  language = 'en',
} = {}) {
  const currentLanguage = language === 'zh' ? 'zh' : 'en';
  return (Array.isArray(deliverables) ? deliverables : [deliverables])
    .map((source, index) => {
      const row = typeof source === 'string' ? { title: source } : source || {};
      const configuredFileName = clean(row.fileName || row.filename || row.path || row.workDefinition?.artifactFileName);
      const configuredTitle = clean(row.title || row.name || row.artifactTitle || row.workDefinition?.artifactTitle || row.text);
      const configuredExtension = extensionFor(configuredFileName || row.extension || row.format) || '.md';
      const title = clean(configuredTitle.replace(/\.[a-z0-9]{1,10}$/i, ''));
      if (!title) return null;
      const fileName = configuredFileName && extensionFor(configuredFileName)
        ? configuredFileName.split(/[\\/]/).at(-1)
        : `${safeFileStem(title)}${configuredExtension}`;
      const extension = extensionFor(fileName) || configuredExtension;
      const owner = resolveOwner(team, row, fallbackOwnerId);
      const acceptanceCriteria = (Array.isArray(row.acceptanceCriteria)
        ? row.acceptanceCriteria
        : [row.acceptanceCriteria || row.acceptance || row.doneWhen])
        .map(clean)
        .filter(Boolean);
      return {
        id: clean(row.id) || `kickoff_deliverable_${index + 1}`,
        title,
        fileName,
        extension,
        formatLabel: clean(row.formatLabel || row.format) || formatLabels[extension] || extension.slice(1).toUpperCase(),
        ownerId: owner?.id || clean(row.ownerId) || null,
        ownerName: owner?.name || clean(row.ownerName || row.assignee) || null,
        purpose: clean(row.purpose || row.description) || (currentLanguage === 'zh'
          ? `作为项目正式交付的《${title}》。`
          : `The formal project deliverable “${title}”.`),
        acceptanceCriteria: acceptanceCriteria.length ? acceptanceCriteria : [currentLanguage === 'zh'
          ? '文件可以打开，内容满足项目目标，并由指定审阅人确认。'
          : 'The file opens, serves the project goal, and is confirmed by the assigned reviewer.'],
        status: clean(row.status) || 'planned',
      };
    })
    .filter(Boolean)
    .filter((row, index, rows) => rows.findIndex(candidate => candidate.fileName.toLowerCase() === row.fileName.toLowerCase()) === index);
}

export function defaultKickoffDeliverables({ output = '', team = [], ownerId = '', language = 'en' } = {}) {
  const title = clean(output) || (language === 'zh' ? '项目最终交付物' : 'Final Project Deliverable');
  return normalizeKickoffDeliverables({
    deliverables: [{ title }],
    team,
    fallbackOwnerId: ownerId,
    language,
  });
}

export function buildKickoffDeliverableResolution({
  deliverables = [],
  team = [],
  selectedLeaderId = '',
  managerConfirmed = false,
  now = new Date().toISOString(),
  source = 'kickoff-meeting-deliverables',
  language = 'en',
} = {}) {
  const rows = normalizeKickoffDeliverables({
    deliverables,
    team,
    fallbackOwnerId: selectedLeaderId,
    language,
  });
  const incompleteDeliverableIds = rows
    .filter(row => !row.title || !row.fileName || !row.extension || !row.ownerId || !row.acceptanceCriteria.length)
    .map(row => row.id);
  const complete = rows.length > 0 && incompleteDeliverableIds.length === 0;
  const confirmed = Boolean(managerConfirmed && complete);
  return {
    schemaVersion: 'kickoff-deliverable-resolution/v1',
    status: confirmed ? 'manager-confirmed' : complete ? 'awaiting-manager-confirmation' : 'incomplete',
    managerConfirmed: confirmed,
    confirmedAt: confirmed ? now : null,
    source,
    deliverableCount: rows.length,
    deliverableIds: rows.map(row => row.id),
    incompleteDeliverableIds,
    deliverables: rows,
  };
}

export function kickoffDeliverablesReady(resolution = {}) {
  return resolution.schemaVersion === 'kickoff-deliverable-resolution/v1'
    && resolution.managerConfirmed === true
    && resolution.deliverableCount > 0
    && (resolution.incompleteDeliverableIds || []).length === 0;
}

export function kickoffDeliverablesToTasks(resolution = {}, { language = 'en' } = {}) {
  return (resolution.deliverables || []).map((deliverable, index) => ({
    id: deliverable.taskId || deliverable.id || `deliverable_task_${index + 1}`,
    text: language === 'zh' ? `完成《${deliverable.title}》` : `Complete “${deliverable.title}”`,
    ownerId: deliverable.ownerId,
    ownerName: deliverable.ownerName,
    assignee: deliverable.ownerName || deliverable.ownerId,
    status: 'pending',
    source: 'kickoff-deliverable-resolution',
    workDefinition: {
      artifactTitle: deliverable.title,
      artifactFileName: deliverable.fileName,
      artifactPurpose: deliverable.purpose,
      acceptanceCriteria: deliverable.acceptanceCriteria,
      deliverableId: deliverable.id,
    },
  }));
}
