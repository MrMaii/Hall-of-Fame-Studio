import { lazy } from 'react';
import { ChevronLeft } from 'lucide-react';
import { meetingMessageStatusLabel } from './meetingMessageState.js';

const MeetingInputPanel = lazy(() => import('./MeetingInputPanel.jsx'));
const MeetingRoomStage = lazy(() => import('./MeetingRoomStage.jsx'));
const MeetingTranscriptPanel = lazy(() => import('./MeetingTranscriptPanel.jsx'));

export default function ProjectSimpleMeeting({
  activeLanguage,
  backendSendRequired,
  canSend,
  elapsedLabel,
  expandedLogIds,
  input,
  latestDirectorMessageError,
  onClose,
  onComplete,
  canComplete,
  onExpandedLogIdsChange,
  onInputChange,
  onOpenSettings,
  onSend,
  onToggleVoice,
  onUserIntentChange,
  project,
  meetingCompletion,
  meetingSession,
  meetingError,
  responseStatus,
  speakerId,
  speechRecognitionSupported,
  transcript,
  userIntentActive,
  voiceStatus,
}) {
  return (
    <div data-testid="project-simple-meeting" className="flex h-screen min-w-0 flex-col overflow-hidden bg-[#171411] text-[#efe2bd]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#3a2a1c] px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <button type="button" aria-label="返回项目" onClick={onClose} className="inline-flex items-center gap-2 text-sm text-[#bcae86] hover:text-white">
            <ChevronLeft size={16} /> 返回项目
          </button>
          <h1 className="mt-3 truncate font-serif text-2xl">{project.name}</h1>
          <p className="mt-1 text-sm text-[#bcae86]">项目会议</p>
        </div>
        {onComplete && !meetingCompletion && (
          <button type="button" data-testid="project-meeting-complete" onClick={onComplete} disabled={!canComplete} className="border border-[#8f1e18] bg-[#8f1e18] px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-white disabled:opacity-35">结束会议</button>
        )}
        <div className="border border-[#3a2a1c] bg-[#1a130e] px-4 py-3 text-right">
          <div data-testid="project-meeting-response-status" role="status" className="text-sm text-[#efe2bd]">{responseStatus}</div>
          <div className="mt-1 font-mono text-xs text-[#7d6a49]">本轮 {elapsedLabel}</div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:overflow-hidden sm:p-6">
        <MeetingRoomStage project={project} speakerId={speakerId} transcript={transcript} />
        <aside className="flex min-h-[520px] min-w-0 flex-col gap-3 lg:min-h-0">
          {meetingSession && (
            <div data-testid="project-meeting-session-context" className="border border-[#7b6542] bg-[#251b13] px-4 py-3">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">本次会议 · {meetingSession.participantIds?.length || 0} 位参会者</div>
              <div className="mt-2 font-serif text-lg">{meetingSession.agenda}</div>
              <div className="mt-2 font-mono text-[8px] text-[#7d6a49]">记录负责人：{meetingSession.recorderName}</div>
            </div>
          )}
          <MeetingTranscriptPanel
            transcript={transcript}
            expandedLogIds={expandedLogIds}
            onExpandedLogIdsChange={onExpandedLogIdsChange}
            title="会议记录"
            activeLanguage={activeLanguage}
            statusLabel={meetingMessageStatusLabel}
          />
          {latestDirectorMessageError && (
            <div role="alert" className="border border-[#8f1e18] bg-[#251b13] px-4 py-3 text-sm text-[#e7b3ae]">
              {latestDirectorMessageError} 输入内容已经保留，可以修改后重新发送。
            </div>
          )}
          {meetingCompletion && (
            <div data-testid="project-meeting-completion" className="border border-[#59684b] bg-[#1d2618] px-4 py-3 text-sm text-[#b9d18f]">
              会议纪要已提交：<span data-testid="project-meeting-summary-path" data-no-localize="" className="break-all">{meetingCompletion.report?.workspaceRelativePath}</span>
            </div>
          )}
          {meetingError && <div role="alert" className="border border-[#8f1e18] bg-[#251b13] px-4 py-3 text-sm text-[#e7b3ae]">{meetingError}</div>}
          <MeetingInputPanel
            backendSendRequired={backendSendRequired}
            onOpenSettings={onOpenSettings}
            speechRecognitionSupported={speechRecognitionSupported}
            voiceStatus={voiceStatus}
            onToggleVoice={onToggleVoice}
            input={input}
            onInputChange={onInputChange}
            onUserIntentChange={onUserIntentChange}
            canSend={canSend}
            onSend={onSend}
            userIntentActive={userIntentActive}
          />
        </aside>
      </main>
    </div>
  );
}
