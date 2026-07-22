const INTERNAL_ACTIVITY_TEXT = /(?:智能体运行记录|管理记录|系统记录|流程记录|项目设置修订\s*\d*\s*已更新|Agent\s*脉冲|工作脉冲|管理信号|管理检查|证据标记|Project settings revision|Agent work pulse|management check-in|peer-management check-in|Timeline log|System record|Workflow record)/i;

const OPERATIONAL_EVENT_TYPES = new Set([
  'agent-work-pulse',
  'agent-task-completed',
  'work-pulse',
  'daily-report',
  'project-settings-updated',
  'management-check-in',
  'peer-management-check-in',
  'management-response',
]);

const OPERATIONAL_SOURCES = new Set([
  'timeline-log',
  'event-ledger',
  'project-settings',
  'agent-work-cycle',
  'agent-runtime',
  'autonomous-run-control',
  'agent-autonomous-queue',
]);

function clean(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function isMeaningfulActivitySentence(value = '') {
  const text = clean(value);
  return text.length >= 4 && !INTERNAL_ACTIVITY_TEXT.test(text);
}

export function isConversationMessage(record = {}) {
  if (!clean(record.text || record.summary)) return false;
  if (record.recordKind === 'conversation' || record.userAuthored === true) return true;
  if (record.recordKind === 'audit' || record.recordKind === 'activity') return false;

  const author = clean(record.author || record.speaker).toLowerCase();
  if (author === 'system' || author === '系统') return false;

  const source = clean(record.source).toLowerCase();
  const eventType = clean(record.eventType).toLowerCase();
  if (OPERATIONAL_SOURCES.has(source) || OPERATIONAL_EVENT_TYPES.has(eventType)) return false;
  if (record.type === 'system' && !source.includes('meeting')) return false;

  return Boolean(
    record.author
    || record.speaker
    || record.authorId
    || record.speakerId
    || source.includes('message')
    || source.includes('meeting')
    || source.includes('chat')
  );
}

export function activitySentence(record = {}, context = {}) {
  const authored = [record.displayTitle, record.commitMessage]
    .map(clean)
    .find(isMeaningfulActivitySentence);
  if (authored) return authored;

  const eventType = clean(record.eventType || record.subtype || record.type).toLowerCase();
  const actor = clean(record.actor || record.agentName || record.submittedByAgentName || record.agent || context.actorName || '项目成员');
  const target = clean(record.targetName || record.assigneeName || context.targetName);
  const object = clean(record.object || record.taskTitle || record.task?.text || record.workText || context.object);
  const outcome = clean(record.outcome || record.result || context.outcome);

  if (/^(?:approval|approved|project-approved)$/.test(eventType)) {
    if (target || object) return clean(`${actor}批准${target}${object}`);
  }
  if (/message-read|read-message|acknowledged-reading/.test(eventType)) {
    if (object) return clean(`${actor}读到了${object}`);
  }
  if (/idea|brainstorm|proposal/.test(eventType)) {
    if (object) return clean(`${actor}提出：${object}`);
  }
  if (/assignment-acknowledged|assignment-ack/.test(eventType)) {
    if (object) return clean(`${actor}确认负责${object}`);
  }
  if (/leader-assignment|assignment/.test(eventType)) {
    if (target && object) return clean(`${actor}请${target}负责${object}`);
  }
  if (/management-check-in|peer-management-check-in/.test(eventType)) {
    if (target && object) return clean(`${actor}请${target}继续${object}`);
  }
  if (/changes-requested|revision-requested|review-request/.test(eventType)) {
    if (target && object) return clean(`${actor}请${target}修改${object}`);
  }
  if (/submitted|submission|deliverable-submit|artifact/.test(eventType)) {
    if (object) return clean(`${actor}提交了${object}${outcome ? `：${outcome}` : ''}`);
  }
  if (/completed|task-completed|agent-task-completed/.test(eventType)) {
    if (object) return clean(`${actor}完成了${object}${outcome ? `：${outcome}` : ''}`);
  }
  if (/progress|work-pulse|agent-work-pulse/.test(eventType)) {
    if (object) return clean(`${actor}推进了${object}${outcome ? `：${outcome}` : ''}`);
  }
  if (/project-settings-updated/.test(eventType)) {
    return clean(`${actor}更新了项目设置${object ? `：${object}` : ''}`);
  }

  const summary = clean(record.summary || record.description || record.title);
  return isMeaningfulActivitySentence(summary) ? summary : '';
}

export function normalizeActivityNodeForDisplay(node = {}, context = {}) {
  const displayTitle = activitySentence(node, context);
  const controlPlaneOnly = isControlPlaneActivity(node);
  return {
    ...node,
    displayTitle,
    publiclyVisible: controlPlaneOnly || node.publiclyVisible === false
      ? false
      : isMeaningfulActivitySentence(displayTitle),
  };
}
import { isControlPlaneActivity } from './workOutputSemantics.js';
