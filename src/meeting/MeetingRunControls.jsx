const STATUS_LABELS = {
  idle: '等待发言',
  submitting: '正在提交',
  saved: '已保存',
  processing: 'AI正在处理',
  completed: '本轮已完成',
  stopped: '已停止',
  cancelled: '已取消',
  failed: '处理失败',
  'timed-out': '等待超时',
  'retry-ready': '可以重新发送',
};

const ACTIVE_STATUSES = ['submitting', 'saved', 'processing'];
const RETRYABLE_STATUSES = ['failed', 'stopped', 'cancelled', 'timed-out'];

const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export default function MeetingRunControls({
  runState,
  team,
  roomSpeaker,
  onStop,
  onCancel,
  onSkip,
  onRetry,
}) {
  const elapsed = runState.startedAt
    ? Math.max(0, Math.floor((Date.now() - Date.parse(runState.startedAt)) / 1000))
    : 0;
  const currentSpeaker = team.find(member => member.id === runState.currentSpeakerId) || null;
  const runActive = ACTIVE_STATUSES.includes(runState.status);

  return (
    <div data-testid="project-meeting-run-status" className="border border-[#3a2a1c] bg-[#1a130e]/80 px-3 py-2 shrink-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs text-[#bcae86]">
        <span>{STATUS_LABELS[runState.status] || runState.status}</span>
        {currentSpeaker && <span>当前成员：{currentSpeaker.name}</span>}
        <span>剩余成员：{runState.remainingCount}</span>
        <span>本轮用时：{formatTime(elapsed)}</span>
      </div>
      {runState.error && <div className="mt-2 text-sm text-[#d8a19c]">{runState.error}</div>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" data-testid="project-meeting-stop" onClick={onStop} disabled={!runActive}
          title={runActive ? '停止当前 AI 回复' : 'AI 开始回复后可用'} className="border border-[#7b6542] px-3 py-1.5 text-sm text-[#efe2bd] disabled:opacity-35">停止回复</button>
        <button type="button" data-testid="project-meeting-cancel" onClick={onCancel} disabled={!runActive}
          title={runActive ? '取消本轮全部回复' : '本轮开始后可用'} className="border border-[#7b6542] px-3 py-1.5 text-sm text-[#efe2bd] disabled:opacity-35">取消本轮</button>
        <button type="button" data-testid="project-meeting-skip" onClick={onSkip} disabled={!roomSpeaker}
          title={roomSpeaker ? '跳过当前成员' : '有成员发言时可用'} className="border border-[#7b6542] px-3 py-1.5 text-sm text-[#efe2bd] disabled:opacity-35">跳过当前成员</button>
        <button type="button" data-testid="project-meeting-retry" onClick={onRetry}
          disabled={!runState.lastText || !RETRYABLE_STATUSES.includes(runState.status)}
          title={runState.lastText ? '失败、停止、取消或超时后可重新发送' : '发送消息后可用'} className="border border-[#7b6542] px-3 py-1.5 text-sm text-[#efe2bd] disabled:opacity-35">重新发送</button>
      </div>
    </div>
  );
}
