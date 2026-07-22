const clean = (value = '') => String(value || '')
  .replace(/\s+/g, ' ')
  .replace(/^[\s:：,，;；.。-]+|[\s:：,，;；.。-]+$/g, '')
  .trim();

const completedStatus = value => /^(?:done|completed|complete|accepted|final)$/i.test(clean(value));

function languageFor(project = {}, language = '') {
  if (language === 'zh' || language === 'en') return language;
  const configured = String(project.language || '').toLowerCase();
  if (configured === 'zh' || configured === 'en') return configured;
  return /[\u3400-\u9fff]/u.test(`${project.name || ''}${project.objective || ''}`) ? 'zh' : 'en';
}

function projectTopic(project = {}, language = 'zh') {
  const source = clean(project.name || project.title || project.objective || (language === 'zh' ? '当前项目' : 'Project'));
  if (language !== 'zh') {
    return clean(source
      .replace(/^(?:research|study)\s+(?:on|of)\s+/i, '')
      .replace(/\b(?:research|study|project)\b[.!?]*$/i, '')) || 'Project';
  }
  return clean(source
    .replace(/^关于/u, '')
    .replace(/[“”"《》]/g, '')
    .replace(/他们/u, '')
    .replace(/心理健康指数/gu, '心理健康')
    .replace(/关联性/gu, '关系')
    .replace(/关联/gu, '关系')
    .replace(/关系的关系/gu, '关系')
    .replace(/(?:的)?(?:学习|研究课题|研究项目|项目)$/u, '')
    .replace(/的关系$/u, '关系')) || '当前项目';
}

function workKind(project = {}) {
  const signal = `${project.name || ''} ${project.objective || ''} ${project.brief || ''}`.toLowerCase();
  if (/研究|论文|报告|证据|调研|research|paper|study|evidence|report/.test(signal)) return 'research';
  if (/设计|品牌|界面|体验|原型|design|brand|interface|prototype|ux/.test(signal)) return 'design';
  if (/代码|软件|网站|应用|接口|修复|开发|登录|权限|测试|可运行|code|software|website|app|api|bug|build|test|login|permission/.test(signal)) return 'technical';
  if (/运营|流程|销售|增长|发布|operation|process|sales|growth|launch/.test(signal)) return 'operations';
  return 'general';
}

function roleKind(agent = {}) {
  const signal = `${agent.role || ''} ${agent.title || ''} ${agent.skill || ''}`.toLowerCase();
  if (agent.isLeader || /leader|director|负责人|主管|总监/.test(signal)) return 'leader';
  if (/review|evidence|qa|critic|审核|审查|审阅|证据|质量/.test(signal)) return 'reviewer';
  if (/risk|ethic|safety|crisis|风险|伦理|安全|合规/.test(signal)) return 'risk';
  if (/design|data|analyst|method|research|设计|数据|分析|方法|研究/.test(signal)) return 'specialist';
  return 'contributor';
}

const assetSuffixes = {
  zh: {
    research: {
      project: '研究论文',
      leader: '研究交付计划',
      reviewer: '证据与质量审查报告',
      risk: '风险与合规说明',
      specialist: '研究设计方案',
      contributor: '专题研究报告',
    },
    design: {
      project: '设计方案', leader: '设计交付计划', reviewer: '设计验收报告', risk: '风险与可用性说明', specialist: '设计方案', contributor: '设计成果',
    },
    technical: {
      project: '可运行版本', leader: '版本交付计划', reviewer: '测试验收报告', risk: '安全与上线说明', specialist: '功能实现', contributor: '可运行版本',
    },
    operations: {
      project: '运营改进方案', leader: '执行计划', reviewer: '效果验收报告', risk: '风险控制方案', specialist: '运营分析报告', contributor: '执行方案',
    },
    general: {
      project: '最终成果', leader: '交付计划', reviewer: '验收报告', risk: '风险说明', specialist: '专业方案', contributor: '工作成果',
    },
  },
  en: {
    research: { project: 'Research Paper', leader: 'Research Delivery Plan', reviewer: 'Evidence and Quality Review', risk: 'Risk and Compliance Note', specialist: 'Research Design', contributor: 'Research Report' },
    design: { project: 'Design Proposal', leader: 'Design Delivery Plan', reviewer: 'Design Acceptance Report', risk: 'Risk and Usability Note', specialist: 'Design Proposal', contributor: 'Design Deliverable' },
    technical: { project: 'Working Release', leader: 'Release Delivery Plan', reviewer: 'Test Acceptance Report', risk: 'Security and Release Note', specialist: 'Implemented Feature', contributor: 'Working Release' },
    operations: { project: 'Operations Improvement Plan', leader: 'Execution Plan', reviewer: 'Outcome Acceptance Report', risk: 'Risk Control Plan', specialist: 'Operations Analysis', contributor: 'Execution Plan' },
    general: { project: 'Final Deliverable', leader: 'Delivery Plan', reviewer: 'Acceptance Report', risk: 'Risk Note', specialist: 'Specialist Proposal', contributor: 'Work Deliverable' },
  },
};

function joinTitle(topic, suffix, language) {
  if (language === 'zh') return `${topic}${suffix}`;
  return `${topic}: ${suffix}`;
}

export function describeProjectOutcome(project = {}, language = '') {
  const currentLanguage = languageFor(project, language);
  const topic = projectTopic(project, currentLanguage);
  const kind = workKind(project);
  const title = joinTitle(topic, assetSuffixes[currentLanguage][kind].project, currentLanguage);
  return {
    title,
    topic,
    kind,
    purpose: currentLanguage === 'zh'
      ? `这是团队最终要交给用户审阅和使用的《${title}》。`
      : `This is the final ${title} the team will hand to the user for review and use.`,
  };
}

function explicitAssetTitle(task = {}) {
  const configured = clean(task.workDefinition?.artifactTitle || task.artifactTitle);
  if (configured) return configured.replace(/^[《“"]+|[》”"]+$/gu, '');
  const taskText = clean(task.text || task.title || task.label);
  const processOnly = /统筹|审查.*(?:范围|标准|门槛)|设计.*(?:框架|变量关系|交付结构)|伦理边界|正式工作产物|work product|coordinate deliverables|review the research scope/i.test(taskText);
  if (processOnly) return '';
  const quoted = taskText.match(/(?:完成|交付|编写|制作|提交)?\s*[《“"]([^》”"]+)[》”"]/u)?.[1];
  if (quoted) return clean(quoted);
  if (taskText) {
    return taskText.replace(/^(?:完成|交付|编写|制作|提交)\s*/u, '').replace(/[。.]$/u, '').replace(/^[《“"]+|[》”"]+$/gu, '');
  }
  return '';
}

function purposeFor({ title, kind, role, language }) {
  if (language !== 'zh') {
    if (role === 'leader') return `Make the owners, delivery order, deadlines, and acceptance decision for ${title} clear.`;
    if (role === 'reviewer') return `Tell the team which claims are supported, what is missing, and what must change before ${title} is accepted.`;
    if (role === 'risk') return `Explain the practical risks, constraints, and safeguards that must accompany ${title}.`;
    if (kind === 'research') return `Explain the research question, method, evidence plan, and analysis needed for ${title}.`;
    return `Produce the part of ${title} that this owner is accountable for.`;
  }
  if (role === 'leader') return `说明《${title}》由谁完成、按什么顺序交付、何时验收，以及哪些决定需要负责人拍板。`;
  if (role === 'reviewer') return `说明《${title}》中哪些结论有依据、还缺什么，以及通过验收前必须修改什么。`;
  if (role === 'risk') return `说明《${title}》可能造成的实际风险、适用限制和必须采用的保护措施。`;
  if (kind === 'research') return `说明研究问题、研究方法、证据来源和分析方式，回答这项研究将如何开展。`;
  return `完成《${title}》中由该负责人承担、可直接审阅和使用的部分。`;
}

export function describeTaskAsset({ project = {}, task = {}, agent = {}, language = '' } = {}) {
  const currentLanguage = languageFor(project, language);
  const outcome = describeProjectOutcome(project, currentLanguage);
  const role = roleKind(agent);
  const explicitTitle = explicitAssetTitle(task);
  const suffix = assetSuffixes[currentLanguage][outcome.kind][role];
  const title = explicitTitle || joinTitle(outcome.topic, suffix, currentLanguage);
  const configuredPurpose = clean(task.workDefinition?.artifactPurpose || task.artifactPurpose)
    .replace(/《{2,}/gu, '《')
    .replace(/》{2,}/gu, '》');
  const purpose = configuredPurpose || purposeFor({ title, kind: outcome.kind, role, language: currentLanguage });
  const fileName = clean(task.workDefinition?.artifactFileName || task.artifactFileName)
    || `${title.replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '-').replace(/[. ]+$/g, '')}.md`;
  return {
    title,
    purpose,
    fileName,
    role,
    kind: outcome.kind,
    taskText: currentLanguage === 'zh' ? `完成《${title}》` : `Complete “${title}”`,
    finalOutcomeTitle: outcome.title,
  };
}

function taskSubmissions(project = {}, task = {}) {
  return (project.agentSubmissions || [])
    .filter(item => String(item.taskId || '') === String(task.id || ''))
    .filter((item) => !/(?:worker cycle|backend agent worker|timeline proof|chat proof|event proof|coordination ledger|progress pulse|autonomous evidence packet|工作脉冲|协同台账|时间线证据|运行记录)/i.test(
      `${item.title || ''} ${item.summary || ''} ${item.body || item.content || ''}`,
    ))
    .sort((left, right) => Date.parse(right.updatedAt || right.createdAt || 0) - Date.parse(left.updatedAt || left.createdAt || 0));
}

export function taskAssetProgress({ project = {}, task = {} } = {}) {
  const submissions = taskSubmissions(project, task);
  const latest = submissions[0];
  const accepted = submissions.some(item => /^(?:accepted|approved)$/i.test(String(item.reviewStatus || item.status || '')));
  if (completedStatus(task.status) || accepted) return 100;
  if ((latest?.tags || []).includes('working-draft')) return 35;
  if (latest?.reviewStatus === 'changes-requested') return 75;
  if (latest) return 65;
  if ((task.attachments || []).length || (task.artifactPaths || []).length) return 35;
  if ((Number(task.workPulseCount) || 0) > 0 || task.lastTouchedAt) return 10;
  return 0;
}

const uniqueStrings = (values = []) => [...new Set(values.map(value => clean(value)).filter(Boolean))];

function memberName(team = [], reference = '', fallback = '') {
  const member = team.find(item => String(item.id || '') === String(reference || '') || String(item.name || '') === String(reference || ''));
  return clean(member?.name || fallback || reference);
}

function artifactIdentity({ descriptor = {}, latest = null } = {}) {
  const fileName = clean(latest?.artifact?.fileName || descriptor.fileName) || `${descriptor.title || 'deliverable'}.md`;
  const extensionMatch = fileName.match(/(\.[a-z0-9]{1,10})$/i);
  const extension = extensionMatch?.[1]?.toLowerCase() || '';
  const displayName = clean(descriptor.title || fileName.slice(0, extension ? -extension.length : undefined));
  const formatLabels = {
    '.md': 'Markdown', '.txt': 'Text', '.pdf': 'PDF', '.doc': 'Word', '.docx': 'Word',
    '.csv': 'CSV', '.xls': 'Excel', '.xlsx': 'Excel', '.ppt': 'PowerPoint', '.pptx': 'PowerPoint',
    '.png': 'Image', '.jpg': 'Image', '.jpeg': 'Image', '.gif': 'Image', '.webp': 'Image', '.svg': 'Image',
    '.html': 'Web page', '.htm': 'Web page', '.js': 'Code', '.jsx': 'Code', '.ts': 'Code', '.tsx': 'Code',
    '.json': 'Data', '.zip': 'Archive', '.7z': 'Archive', '.rar': 'Archive',
  };
  const fileKind = /^(?:\.csv|\.xls|\.xlsx)$/i.test(extension)
    ? 'spreadsheet'
    : /^(?:\.ppt|\.pptx)$/i.test(extension)
      ? 'presentation'
      : /^(?:\.png|\.jpe?g|\.gif|\.webp|\.svg)$/i.test(extension)
        ? 'image'
        : /^(?:\.html?|\.jsx?|\.tsx?|\.json)$/i.test(extension)
          ? 'code'
          : /^(?:\.zip|\.7z|\.rar)$/i.test(extension)
            ? 'archive'
            : 'document';
  return {
    displayName,
    extension,
    fileName: `${displayName}${extension}`,
    formatLabel: formatLabels[extension] || (extension ? extension.slice(1).toUpperCase() : 'File'),
    fileKind,
  };
}

function formatShortDate(value, language) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return '';
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: language === 'zh' ? 'long' : 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function durationLabel(startAt, dueAt, language) {
  const durationMinutes = Math.round((Date.parse(dueAt || '') - Date.parse(startAt || '')) / 60000);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return language === 'zh' ? '用时待负责人确认' : 'duration to be confirmed';
  if (durationMinutes < 60) return language === 'zh' ? `约 ${durationMinutes} 分钟` : `about ${durationMinutes} minutes`;
  if (durationMinutes < 24 * 60) {
    const hours = Math.max(1, Math.round(durationMinutes / 60));
    return language === 'zh' ? `约 ${hours} 小时` : `about ${hours} hours`;
  }
  const days = Math.max(1, Math.round(durationMinutes / (24 * 60)));
  return language === 'zh' ? `约 ${days} 天` : `about ${days} days`;
}

function assetStatus({ task = {}, latest = null, ownerName = '', authorNames = [], reviewerName = '', language = 'zh' } = {}) {
  const reviewStatus = clean(latest?.reviewStatus || latest?.status).toLowerCase();
  const completed = completedStatus(task.status) || /^(?:accepted|approved)$/.test(reviewStatus);
  const revising = reviewStatus === 'changes-requested';
  const workingDraft = (latest?.tags || []).includes('working-draft');
  const reviewing = Boolean(latest) && !workingDraft && !completed && !revising;
  const working = workingDraft
    || (!latest && (/^(?:in-progress|active|working)$/i.test(clean(task.status))
      || (Number(task.workPulseCount) || 0) > 0
      || (task.attachments || []).length > 0
      || (task.artifactPaths || []).length > 0));
  const authors = authorNames.length ? authorNames.join(language === 'zh' ? '、' : ', ') : ownerName;
  const plannedStartAt = task.plannedStartAt || task.assignedAt || task.deadlineSetAt || task.createdAt || '';
  const plannedStart = formatShortDate(plannedStartAt, language);
  const estimate = durationLabel(plannedStartAt, task.dueAt, language);

  if (completed) return {
    state: 'completed', label: language === 'zh' ? '已完成' : 'Completed',
    summary: language === 'zh' ? `作者：${authors}` : `By ${authors}`, detail: '',
  };
  if (revising) return {
    state: 'revising', label: language === 'zh' ? '修改中' : 'Revising',
    summary: language === 'zh' ? `${ownerName} 正在按审阅意见修改` : `${ownerName} is revising from review feedback`,
    detail: reviewerName ? (language === 'zh' ? `审阅人：${reviewerName}` : `Reviewer: ${reviewerName}`) : '',
  };
  if (reviewing) return {
    state: 'reviewing', label: language === 'zh' ? '审阅中' : 'In review',
    summary: reviewerName
      ? (language === 'zh' ? `${authors} 已完成初稿，${reviewerName} 正在审阅` : `${authors} finished the draft; ${reviewerName} is reviewing`)
      : (language === 'zh' ? `${authors} 已完成初稿，等待审阅` : `${authors} finished the draft; awaiting review`),
    detail: '',
  };
  if (working) return {
    state: 'working', label: language === 'zh' ? '制作中' : 'In progress',
    summary: language === 'zh' ? `${ownerName} 正在制作` : `${ownerName} is working on it`,
    detail: task.dueAt ? (language === 'zh' ? `计划 ${formatShortDate(task.dueAt, language)} 前完成` : `Planned completion: ${formatShortDate(task.dueAt, language)}`) : '',
  };
  return {
    state: 'planned', label: language === 'zh' ? '未开始' : 'Not started',
    summary: plannedStart
      ? (language === 'zh' ? `计划由 ${ownerName} 于 ${plannedStart} 开始` : `${ownerName} plans to start ${plannedStart}`)
      : (language === 'zh' ? `计划由 ${ownerName} 开始制作` : `${ownerName} is planned to start`),
    detail: language === 'zh' ? `预计${estimate}` : `Estimated ${estimate}`,
  };
}

export function buildProjectAssetCatalog(project = {}, language = '') {
  const currentLanguage = languageFor(project, language);
  const team = project.team || [];
  const rows = (project.tasks || []).map((task) => {
    const agent = team.find(member => String(member.id || '') === String(task.ownerId || '') || String(member.name || '') === String(task.assignee || '')) || {};
    const descriptor = describeTaskAsset({ project, task, agent, language: currentLanguage });
    const submissions = taskSubmissions(project, task);
    const latest = submissions[0];
    const progressPercent = taskAssetProgress({ project, task });
    const path = latest?.workspaceRelativePath
      || latest?.workspacePath
      || latest?.artifact?.workspaceRelativePath
      || latest?.artifact?.relativePath
      || task.artifactPaths?.at?.(-1)
      || `agent-artifacts/${descriptor.fileName}`;
    const authorNames = uniqueStrings([
      ...(latest?.committerIds || []).map(id => memberName(team, id)),
      ...(latest?.coAuthorIds || []).map(id => memberName(team, id)),
      memberName(team, latest?.agentId, latest?.agentName),
    ]);
    const ownerName = agent.name || task.ownerName || task.assignee || (currentLanguage === 'zh' ? '待分配' : 'Unassigned');
    const reviewerName = memberName(team, latest?.requestedReviewAgentId, latest?.requestedReviewAgentName);
    const status = assetStatus({ task, latest, ownerName, authorNames, reviewerName, language: currentLanguage });
    const identity = artifactIdentity({ descriptor, latest });
    const fileAvailable = Boolean(latest || (task.attachments || []).length || (task.artifactPaths || []).length);
    return {
      id: task.id || `asset-${descriptor.fileName}`,
      taskId: task.id || null,
      taskIds: [task.id].filter(Boolean),
      title: descriptor.title,
      ...identity,
      purpose: descriptor.purpose,
      ownerId: agent.id || task.ownerId || null,
      ownerName,
      authorNames: authorNames.length ? authorNames : status.state === 'completed' ? [ownerName] : [],
      reviewerName,
      statusLabel: status.label,
      statusState: status.state,
      statusSummary: status.summary,
      statusDetail: status.detail,
      progressPercent,
      fileAvailable,
      path: String(path || '').replace(/\\/g, '/'),
      submissionId: latest?.id || null,
      reviewStatus: latest?.reviewStatus || null,
      plannedStartAt: task.plannedStartAt || task.assignedAt || task.deadlineSetAt || task.createdAt || null,
      dueAt: task.dueAt || null,
      updatedAt: latest?.updatedAt || latest?.createdAt || task.updatedAt || task.createdAt || null,
    };
  });

  const byFile = new Map();
  rows.forEach((row) => {
    const key = `${clean(row.displayName).toLowerCase()}|${row.extension}`;
    const current = byFile.get(key);
    if (!current) {
      byFile.set(key, row);
      return;
    }
    const rank = item => (item.fileAvailable ? 100 : 0)
      + ({ completed: 50, reviewing: 40, revising: 35, working: 25, planned: 10 }[item.statusState] || 0)
      + (Date.parse(item.updatedAt || '') || 0) / 1e15;
    const preferred = rank(row) > rank(current) ? row : current;
    const other = preferred === row ? current : row;
    byFile.set(key, {
      ...preferred,
      taskIds: uniqueStrings([...(preferred.taskIds || []), ...(other.taskIds || [])]),
      authorNames: preferred.authorNames.length ? preferred.authorNames : other.authorNames,
    });
  });
  return [...byFile.values()];
}

export function isControlPlaneActivity(record = {}) {
  const eventType = clean(record.eventType || record.subtype || record.type).toLowerCase();
  const source = clean(record.source).toLowerCase();
  return /(?:work-pulse|progress-pulse|management-check-in|peer-management-check-in|project-settings-updated|agent-heartbeat|runtime|scheduler|queue|receipt)/.test(`${eventType} ${source}`);
}
