import { buildProjectExecutionPlan } from './projectExecutionPlan.js';
import { buildProjectAssetCatalog, describeProjectOutcome, isControlPlaneActivity } from './workOutputSemantics.js';

const cleanText = (value = '') => String(value || '')
  .replace(/\s+/g, ' ')
  .replace(/^[\s:：,，;；.-]+|[\s:：,，;；.-]+$/g, '')
  .trim();

const clampSentence = (value = '', maxLength = 118) => {
  const text = cleanText(value);
  if (!text) return '';
  const firstSentence = text.split(/(?<=[。！？.!?])\s*/).filter(Boolean)[0] || text;
  return firstSentence.length > maxLength
    ? `${firstSentence.slice(0, maxLength).replace(/[，,、;；\s]+$/g, '')}…`
    : firstSentence;
};

const isoTime = (value) => {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const statusMeta = (row = {}, language = 'zh') => {
  const status = cleanText(row.state?.status || row.status || row.loopState || '').toLowerCase();
  const nextText = cleanText(row.state?.currentPlan?.next || row.next || row.nextStep || '').toLowerCase();
  if (/block|error|fail|阻塞|失败/.test(`${status} ${nextText}`)) {
    return { key: 'blocked', label: language === 'zh' ? '受阻' : 'Blocked' };
  }
  if (/review|复核|审核/.test(`${status} ${nextText}`)) {
    return { key: 'reviewing', label: language === 'zh' ? '复核中' : 'Reviewing' };
  }
  if (/wait|idle|pending|等待/.test(status)) {
    return { key: 'waiting', label: language === 'zh' ? '等待反馈' : 'Waiting' };
  }
  if (/complete|done|完成/.test(status)) {
    return { key: 'completed', label: language === 'zh' ? '已完成' : 'Completed' };
  }
  return { key: 'active', label: language === 'zh' ? '进行中' : 'In progress' };
};

const agentWorkSentence = (row = {}, language = 'zh') => {
  const agentName = row.agent?.name || row.name || (language === 'zh' ? '成员' : 'Team member');
  const work = clampSentence(
    row.currentTaskText
      || row.currentTask?.text
      || row.state?.currentPlan?.focus
      || row.focus
      || row.latestWorklog?.summary
      || row.latestWorklog?.text
      || row.latestWorker?.summary
      || row.latestWorker?.reason,
    72,
  );
  if (work) return language === 'zh' ? `正在${work.replace(/^正在/, '')}` : work;
  return language === 'zh'
    ? `${agentName} 正在关注当前负责的项目工作。`
    : `${agentName} is monitoring their current project responsibilities.`;
};

const updateIsMeaningful = (event = {}) => /approved|complete|completed|review|revision|release|version|updated|submitted|milestone|decision|修订|更新|完成|通过|提交|发布|决策|评审|复核/i.test(
  `${event.eventType || ''} ${event.type || ''} ${event.title || ''}`,
);

const updateIsInternalRecord = (event = {}) => /(?:system|project|agent|manager|workflow|timeline|runtime|worker|scheduler|settings)\s+(?:record|log|pulse|update)|(?:系统|项目|智能体|管理|流程|运行)(?:记录|日志)|项目设置|工作脉冲|时间线证据/i.test(
  `${event.eventType || ''} ${event.type || ''} ${event.source || ''} ${event.title || ''} ${event.summary || ''} ${event.log || ''}`,
);

const buildUpdates = (events = [], language = 'zh') => {
  const sorted = [...events].sort((left, right) => (
    isoTime(right.timestamp || right.time) - isoTime(left.timestamp || left.time)
  ));
  const source = sorted.filter(event => updateIsMeaningful(event) && !updateIsInternalRecord(event) && !isControlPlaneActivity(event));
  const seen = new Set();
  return source.reduce((updates, event, index) => {
    const title = clampSentence(event.title || event.summary || event.log, 68);
    const normalized = title.toLowerCase();
    if (!title || seen.has(normalized) || updates.length >= 3) return updates;
    seen.add(normalized);
    updates.push({
      ...event,
      id: event.id || `project-update-${index}`,
      title,
      detail: clampSentence(event.detail || event.summary || event.title || event.log, 120),
      contributor: event.contributor || event.actor || (language === 'zh' ? '项目团队' : 'Project team'),
      timestamp: event.timestamp || event.time || null,
    });
    return updates;
  }, []);
};

const projectStage = ({ project = {}, openTasks = [], pendingReviews = [], language = 'zh' }) => {
  if (project.status === 'completed') return language === 'zh' ? '项目已完成' : 'Completed';
  if (project.leaderWorkPlan?.status !== 'submitted' && project.initiation) return language === 'zh' ? '制定工作计划' : 'Work planning';
  if (pendingReviews.length) return language === 'zh' ? '质量复核' : 'Quality review';
  if (openTasks.length) return language === 'zh' ? '项目执行' : 'Execution';
  if (project.initiation) return language === 'zh' ? '交付确认' : 'Delivery confirmation';
  return language === 'zh' ? '项目准备' : 'Project setup';
};

export function buildProjectDashboardBriefing({
  project = {},
  agentRows = [],
  recentEvents = [],
  language = 'zh',
} = {}) {
  const team = Array.isArray(project.team) ? project.team : [];
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const openTasks = tasks.filter(task => !['done', 'completed', 'cancelled'].includes(String(task.status || '').toLowerCase()));
  const pendingReviews = (project.submissionReviews || []).filter(review => !['approved', 'accepted'].includes(String(review.verdict || review.status || '').toLowerCase()));
  const outcome = describeProjectOutcome(project, language);
  const assetCatalog = buildProjectAssetCatalog(project, language);
  const leader = team.find(member => member.id === project.leaderWorkPlan?.leaderId || member.isLeader) || team[0] || {};
  const planReady = project.leaderWorkPlan?.status === 'submitted';
  const statusRows = agentRows.length ? agentRows : team.map(agent => ({ agent, state: { status: 'waiting', currentPlan: {} } }));
  const teamRows = statusRows.map((row, index) => {
    const agent = row.agent || team.find(item => item.id === row.agentId) || {};
    const status = !planReady
      ? (agent.id === leader.id
        ? { key: 'active', label: language === 'zh' ? '制定计划中' : 'Planning' }
        : { key: 'waiting', label: language === 'zh' ? '等待工作计划' : 'Waiting for plan' })
      : statusMeta(row, language);
    const latestAction = clampSentence(
      row.latestWorklog?.summary
        || row.latestWorklog?.text
        || row.latestWorklog?.log
        || row.latestWorker?.summary
        || row.latestWorker?.reason
        || row.trigger,
      96,
    );
    const nextStep = clampSentence(
      row.state?.currentPlan?.next || row.next || row.nextStep,
      88,
    );
    const ownedTasks = tasks.filter((task) => (
      String(task.ownerId || task.assignee || '') === String(agent.id || '')
      || String(task.assignee || '') === String(agent.name || '')
    ));
    const activeTask = ownedTasks.find((task) => !['done', 'completed', 'cancelled'].includes(String(task.status || '').toLowerCase())) || ownedTasks[0] || null;
    const activeAsset = assetCatalog.find(asset => String(asset.taskId || '') === String(activeTask?.id || '')) || null;
    const todos = activeTask?.leaderTodos?.length
      ? activeTask.leaderTodos
      : (activeTask?.workDefinition?.steps || []).map((text, todoIndex) => ({
        id: `${activeTask.id || agent.id}_todo_${todoIndex + 1}`,
        text,
        status: todoIndex === 0 ? 'in-progress' : 'pending',
        setBy: activeTask.deadlineSetBy || activeTask.assignedBy || project.leaderWorkPlan?.leaderId || null,
        dueAt: activeTask.dueAt || null,
      }));
    return {
      id: agent.id || row.agentId || `team-member-${index}`,
      agent,
      avatarSrc: agent.avatarUrl || agent.avatar || agent.image || null,
      status,
      sentence: !planReady
        ? (agent.id === leader.id
          ? (language === 'zh' ? '正在制定项目工作计划' : 'Preparing the project work plan')
          : (language === 'zh' ? `等待 ${leader.name || 'Leader'} 提交工作计划后开始` : `Waiting for ${leader.name || 'the Leader'} to submit the work plan`))
        : activeAsset
        ? (language === 'zh' ? `正在完成《${activeAsset.title}》` : `Working on “${activeAsset.title}”`)
        : agentWorkSentence({ ...row, agent }, language),
      latestAction: /pulse|runtime|ledger|receipt|check-in|脉冲|台账|回执|运行记录|管理记录/i.test(latestAction)
        ? (language === 'zh' ? `${activeAsset?.statusLabel || '尚未形成文件'}；过程记录已收进详情。` : `${activeAsset?.statusLabel || 'No file yet'}; operational records remain in details.`)
        : latestAction || (language === 'zh' ? '尚无可以向用户展示的新内容。' : 'No new user-visible content yet.'),
      nextStep: !planReady
        ? (agent.id === leader.id
          ? (language === 'zh' ? '提交包含节点、负责人和预计完成时间的正式工作计划。' : 'Submit the formal plan with milestones, owners, and expected finish times.')
          : (language === 'zh' ? '计划提交后按负责人分配开始工作。' : 'Begin work after the plan assigns an owner.'))
        : nextStep || (language === 'zh' ? '完成当前工作并同步项目结果。' : 'Complete the current work and publish the result.'),
      todos: planReady ? todos : [],
      deadlineAt: planReady ? (activeTask?.dueAt || row.state?.currentPlan?.deadlineAt || null) : null,
      deliverable: activeAsset?.title || activeTask?.workDefinition?.deliverable || row.state?.currentPlan?.deliverable || null,
      deliverablePurpose: activeAsset?.purpose || null,
      deliverablePath: activeAsset?.path || null,
      deliverableStatus: activeAsset?.statusLabel || null,
      taskProgressPercent: activeAsset?.progressPercent || 0,
    };
  });

  const visibleAssetCount = assetCatalog.filter(asset => asset.progressPercent >= 35).length;
  const reviewAssetCount = assetCatalog.filter(asset => asset.reviewStatus && asset.reviewStatus !== 'accepted').length;
  const focusSummary = !planReady
    ? (language === 'zh'
      ? `立项会议已经确认《${outcome.title}》及团队职责。${leader.name || 'Leader'} 正在制定工作节点、负责人和预计完成时间；计划提交前不计算项目进度。`
      : `Kickoff confirmed “${outcome.title}” and team responsibilities. ${leader.name || 'The Leader'} is defining milestones, owners, and expected finish times; project progress remains unavailable until submission.`)
    : language === 'zh'
    ? `项目最终要交付《${outcome.title}》。当前 ${visibleAssetCount}/${assetCatalog.length || 0} 份分工产物已经形成文件${reviewAssetCount ? `，其中 ${reviewAssetCount} 份正在审阅或修改` : ''}。`
    : `The project will deliver “${outcome.title}”. ${visibleAssetCount}/${assetCatalog.length || 0} assigned deliverables now exist as files${reviewAssetCount ? `, with ${reviewAssetCount} in review or revision` : ''}.`;

  const stage = projectStage({ project, openTasks, pendingReviews, language });
  const nextMilestone = !planReady
    ? (language === 'zh' ? `${leader.name || 'Leader'} 提交项目工作计划` : `${leader.name || 'Leader'} submits the project work plan`)
    : clampSentence(
    assetCatalog.find(asset => asset.progressPercent < 100)?.title
      || pendingReviews[0]?.comments
      || project.initiation?.nextActionResolution?.tasks?.find(task => task.status !== 'done')?.text,
    42,
    ) || (language === 'zh' ? '确认下一轮工作' : 'Confirm next work cycle');
  const updates = buildUpdates(recentEvents, language);
  const blockedCount = teamRows.filter(row => row.status.key === 'blocked').length;
  const waitingCount = teamRows.filter(row => row.status.key === 'waiting').length;

  return {
    focusSummary,
    stage,
    nextMilestone,
    lastUpdatedAt: updates[0]?.timestamp || project.updatedAt || project.lastAutonomousRunAt || project.initiation?.approvedAt || null,
    teamRows,
    updates,
    outcome,
    assetCatalog,
    executionPlan: buildProjectExecutionPlan({ project, language }),
    metrics: {
      memberCount: team.length,
      activeCount: teamRows.filter(row => ['active', 'reviewing'].includes(row.status.key)).length,
      waitingCount,
      blockedCount,
    },
  };
}
