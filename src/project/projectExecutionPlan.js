const clamp = (value, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));

const timeValue = (value) => {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : null;
};

const isComplete = (status) => /^(done|completed|complete|cancelled)$/i.test(String(status || ''));

const isSubmittedPlan = (plan = {}) => (
  plan.schemaVersion === 'leader-managed-task-plan/v1'
  && plan.status === 'submitted'
  && Boolean(plan.submittedAt)
  && Array.isArray(plan.tasks)
  && plan.tasks.length > 0
);

const taskProgress = (project = {}, task = {}) => taskAssetProgress({ project, task });

const derivedTodos = (project = {}, task = {}) => {
  if (Array.isArray(task.leaderTodos) && task.leaderTodos.length) return task.leaderTodos;
  const steps = Array.isArray(task.workDefinition?.steps) ? task.workDefinition.steps : [];
  const progress = taskProgress(project, task);
  const activeIndex = Math.min(Math.floor((progress / 100) * steps.length), Math.max(0, steps.length - 1));
  return steps.map((text, index) => ({
    id: `${task.id || 'task'}_todo_${index + 1}`,
    text,
    status: isComplete(task.status) || index < activeIndex ? 'completed' : index === activeIndex ? 'in-progress' : 'pending',
    setBy: task.deadlineSetBy || task.assignedBy || null,
    dueAt: task.dueAt || null,
  }));
};

export function buildProjectExecutionPlan({ project = {}, language = 'zh', now = new Date().toISOString() } = {}) {
  const text = (chinese, english) => language === 'en' ? english : chinese;
  const leader = (project.team || []).find((member) => (
    member.id === project.leaderWorkPlan?.leaderId || member.isLeader
  )) || null;
  const submitted = isSubmittedPlan(project.leaderWorkPlan);
  const plannedTaskIds = new Set((project.leaderWorkPlan?.taskIds?.length
    ? project.leaderWorkPlan.taskIds
    : project.leaderWorkPlan?.tasks?.map((task) => task.id) || []).map(String));
  const tasks = submitted
    ? (Array.isArray(project.tasks) ? project.tasks : []).filter((task) => plannedTaskIds.has(String(task.id)))
    : [];
  const team = Array.isArray(project.team) ? project.team : [];
  const openTasks = tasks.filter((task) => !isComplete(task.status));
  const formalProgress = tasks.length
    ? Math.round(tasks.reduce((sum, task) => sum + taskProgress(project, task), 0) / tasks.length)
    : null;
  const progressPercent = formalProgress === null ? null : clamp(formalProgress);
  const startCandidates = [
    project.createdAt,
    project.initiatedAt,
    project.initiation?.approvedAt,
    ...tasks.flatMap((task) => [task.assignedAt, task.deadlineSetAt]),
  ].map(timeValue).filter(Number.isFinite);
  const dueCandidates = [
    project.leaderWorkPlan?.expectedCompletionAt,
    ...openTasks.map((task) => task.dueAt),
    ...tasks.map((task) => task.dueAt),
  ].map(timeValue).filter(Number.isFinite);
  const startAtMs = startCandidates.length ? Math.min(...startCandidates) : null;
  const expectedCompletionAtMs = dueCandidates.length ? Math.max(...dueCandidates) : null;
  const nowMs = timeValue(now);
  const elapsedPercent = startAtMs !== null && expectedCompletionAtMs !== null && expectedCompletionAtMs > startAtMs && nowMs !== null
    ? clamp(Math.round(((nowMs - startAtMs) / (expectedCompletionAtMs - startAtMs)) * 100))
    : 0;
  const ownerName = (task) => task.ownerName
    || task.assignee
    || team.find((member) => member.id === task.ownerId)?.name
    || text('待分配', 'Unassigned');
  const rows = tasks
    .map((task) => {
      const owner = team.find(member => member.id === task.ownerId || member.name === task.assignee) || {};
      const asset = describeTaskAsset({ project, task, agent: owner, language });
      return {
      id: task.id,
      text: asset.taskText || text('完成交付物', 'Complete deliverable'),
      artifactTitle: asset.title,
      artifactPurpose: asset.purpose,
      artifactFileName: asset.fileName,
      ownerId: task.ownerId || null,
      ownerName: ownerName(task),
      status: task.status || 'pending',
      dueAt: task.dueAt || null,
      deliverable: asset.title,
      progressPercent: taskProgress(project, task),
      todos: derivedTodos(project, task),
    }; })
    .sort((left, right) => (timeValue(left.dueAt) ?? Number.MAX_SAFE_INTEGER) - (timeValue(right.dueAt) ?? Number.MAX_SAFE_INTEGER));
  const allRows = tasks
    .map((task) => {
      const owner = team.find(member => member.id === task.ownerId || member.name === task.assignee) || {};
      const asset = describeTaskAsset({ project, task, agent: owner, language });
      return {
        id: task.id,
        label: asset.title || task.text || text('工作节点', 'Work milestone'),
        ownerName: ownerName(task),
        dueAt: task.dueAt || null,
        status: task.status || 'pending',
        progressPercent: taskProgress(project, task),
      };
    })
    .sort((left, right) => (timeValue(left.dueAt) ?? Number.MAX_SAFE_INTEGER) - (timeValue(right.dueAt) ?? Number.MAX_SAFE_INTEGER));
  const stages = allRows.map((row, index) => ({
    ...row,
    key: row.id || `milestone-${index + 1}`,
    position: allRows.length === 1 ? 100 : Math.round((index / (allRows.length - 1)) * 100),
  }));
  const currentPhase = stages.find((row) => !isComplete(row.status))
    || stages[stages.length - 1]
    || { key: 'leader-planning', label: text('负责人正在制定工作计划', 'Leader is preparing the work plan') };
  const planStatus = submitted ? 'ready' : (project.initiation ? 'planning' : 'not-started');

  return {
    schemaVersion: 'project-execution-plan/v1',
    planStatus,
    progressAvailable: submitted && tasks.length > 0,
    leaderId: project.leaderWorkPlan?.leaderId || leader?.id || project.initiation?.leaderId || null,
    leaderName: project.leaderWorkPlan?.leaderName || leader?.name || project.initiation?.firstLead || text('负责人', 'Leader'),
    submittedAt: submitted ? project.leaderWorkPlan.submittedAt : null,
    progressPercent,
    markerPercent: progressPercent,
    elapsedPercent,
    startAt: startAtMs === null ? null : new Date(startAtMs).toISOString(),
    expectedCompletionAt: expectedCompletionAtMs === null ? null : new Date(expectedCompletionAtMs).toISOString(),
    currentPhase,
    stages,
    rows,
  };
}
import { describeTaskAsset, taskAssetProgress } from './workOutputSemantics.js';
