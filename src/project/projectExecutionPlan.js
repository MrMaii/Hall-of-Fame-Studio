const clamp = (value, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));

const timeValue = (value) => {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : null;
};

const isComplete = (status) => /^(done|completed|complete|cancelled)$/i.test(String(status || ''));

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
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const team = Array.isArray(project.team) ? project.team : [];
  const openTasks = tasks.filter((task) => !isComplete(task.status));
  const formalProgress = tasks.length
    ? Math.round(tasks.reduce((sum, task) => sum + taskProgress(project, task), 0) / tasks.length)
    : clamp(Math.round(Number(project.progress) || 0));
  const progressPercent = clamp(formalProgress);
  const stages = [
    { key: 'kickoff', label: text('立项', 'Kickoff'), position: 0 },
    { key: 'execution', label: text('执行', 'Execution'), position: 34 },
    { key: 'review', label: text('复核', 'Review'), position: 72 },
    { key: 'delivery', label: text('交付', 'Delivery'), position: 100 },
  ];
  const currentPhase = progressPercent >= 96
    ? stages[3]
    : progressPercent >= 72
      ? stages[2]
      : progressPercent >= 5
        ? stages[1]
        : stages[0];
  const startCandidates = [
    project.createdAt,
    project.initiatedAt,
    project.initiation?.approvedAt,
    ...tasks.flatMap((task) => [task.assignedAt, task.deadlineSetAt]),
  ].map(timeValue).filter(Number.isFinite);
  const dueCandidates = [
    project.expectedCompletionAt,
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
  const rows = openTasks
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

  return {
    schemaVersion: 'project-execution-plan/v1',
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
