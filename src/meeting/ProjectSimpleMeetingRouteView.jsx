import ProjectSimpleMeeting from './ProjectSimpleMeeting.jsx';
import { meetingMessageStatusLabel } from './meetingMessageState.js';
import { isConversationMessage } from '../project/humanReadableRecords.js';

export default function ProjectSimpleMeetingRouteView({ view }) {
  const {
    activeLanguage,
    backendMeetingSendRequired,
    canCompleteMeeting,
    canSendMeeting,
    closeMeeting,
    completeMeeting,
    meetingElapsed,
    meetingExpandedLogIds,
    meetingProject,
    projectMeetingCompletion,
    projectMeetingSession,
    projectMeetingSetupError,
    roomInput,
    roomIntentions,
    roomSpeaker,
    roomTranscript,
    roomUserIntentActive,
    roomVoiceStatus,
    setMeetingExpandedLogIds,
    setRoomInput,
    setRoomUserIntentActive,
    setSettingsOpen,
    setSettingsTab,
    speechRecognitionSupported,
    submitMeetingInput,
    toggleRoomVoiceInput,
  } = view;

  const formatTime = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  const activeMember = roomSpeaker
    ? meetingProject.team.find(member => member.id === roomSpeaker)
    : null;
  const conversationTranscript = roomTranscript.filter(isConversationMessage);
  const latestDirectorMessage = conversationTranscript.slice().reverse().find(entry => entry.speaker === 'Director');
  const visibleQueue = roomIntentions.filter(intent => intent.status !== 'yielded');
  const meetingStatusText = roomUserIntentActive
    ? '你正在输入，AI 回复已暂停'
    : activeMember
      ? `AI 正在回复：${activeMember.name}`
      : visibleQueue.length > 0
        ? `已收到，${visibleQueue.length} 位成员正在准备回复`
        : latestDirectorMessage?.deliveryStatus
          ? meetingMessageStatusLabel(latestDirectorMessage.deliveryStatus, activeLanguage)
          : '会议已就绪';

  return (
    <ProjectSimpleMeeting
      activeLanguage={activeLanguage}
      backendSendRequired={backendMeetingSendRequired}
      canSend={canSendMeeting}
      elapsedLabel={formatTime(meetingElapsed)}
      expandedLogIds={meetingExpandedLogIds}
      input={roomInput}
      latestDirectorMessageError={latestDirectorMessage?.error}
      onClose={closeMeeting}
      onComplete={completeMeeting}
      canComplete={canCompleteMeeting}
      onExpandedLogIdsChange={setMeetingExpandedLogIds}
      onInputChange={setRoomInput}
      onOpenSettings={() => { setSettingsTab('deployment'); setSettingsOpen(true); }}
      onSend={() => submitMeetingInput(meetingProject)}
      onToggleVoice={toggleRoomVoiceInput}
      onUserIntentChange={setRoomUserIntentActive}
      project={meetingProject}
      meetingCompletion={projectMeetingCompletion}
      meetingSession={projectMeetingSession}
      meetingError={projectMeetingSetupError}
      responseStatus={meetingStatusText}
      speakerId={roomSpeaker}
      speechRecognitionSupported={Boolean(speechRecognitionSupported)}
      transcript={conversationTranscript}
      userIntentActive={roomUserIntentActive}
      voiceStatus={roomVoiceStatus}
    />
  );
}
