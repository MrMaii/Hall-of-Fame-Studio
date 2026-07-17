import { localizeText } from '../i18n/index.jsx';
import AdvancedMeetingRoom from './AdvancedMeetingRoom.jsx';

export default function AdvancedMeetingRoomRouteView({ view }) {
  const {
    activeLanguage,
    backendMeetingSendRequired,
    canSendMeeting,
    closeMeeting,
    completeMeeting,
    hideMeetingTelemetry,
    initiationMeetingSession,
    meetingElapsed,
    meetingProject,
    meetingTitle,
    roomInput,
    roomIntentions,
    roomSpeaker,
    roomTranscript,
    roomUserIntentActive,
    roomVoiceStatus,
    sceneTransition,
    setRoomInput,
    setRoomUserIntentActive,
    setSettingsOpen,
    setSettingsTab,
    speechRecognitionSupported,
    submitMeetingInput,
    toggleRoomVoiceInput,
    usesCustomMeetingSubmit,
  } = view;

  const teamCount = meetingProject.team.length;
  const isAnySpeaking = roomSpeaker !== null;
  const formatTime = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  const getMeetingAvatarPos = (index, total) => {
    const cx = 50; const cy = 52;
    const rx = 36; const ry = 22;
    const angleStep = Math.PI / (total + 1);
    const angle = Math.PI + (index + 1) * angleStep;
    return { left: `${cx + rx * Math.cos(angle)}%`, top: `${cy + ry * Math.sin(angle)}%` };
  };
  const speakerEntry = roomSpeaker
    ? roomTranscript.slice().reverse().find(t => {
        if (roomSpeaker === 'director') return t.speaker === 'Director';
        const agent = meetingProject.team.find(a => a.id === roomSpeaker);
        return agent && t.speaker === agent.name;
      })
    : null;
  const speakerAgent = roomSpeaker ? meetingProject.team.find(a => a.id === roomSpeaker) : null;
  const activeIntention = roomIntentions.find(intent => intent.status === 'speaking')
    || roomIntentions.find(intent => intent.status === 'queued')
    || roomIntentions[0]
    || null;
  const visibleQueue = roomIntentions.filter(intent => intent.status !== 'yielded');

  return (
    <AdvancedMeetingRoom
      sceneTransition={sceneTransition}
      meetingProject={meetingProject}
      closeMeeting={closeMeeting}
      meetingTitle={meetingTitle}
      isAnySpeaking={isAnySpeaking}
      completeMeeting={completeMeeting}
      formatTime={formatTime}
      meetingElapsed={meetingElapsed}
      hideMeetingTelemetry={hideMeetingTelemetry}
      speakerAgent={speakerAgent}
      getMeetingAvatarPos={getMeetingAvatarPos}
      teamCount={teamCount}
      roomSpeaker={roomSpeaker}
      roomTranscript={roomTranscript}
      speakerEntry={speakerEntry}
      activeIntention={activeIntention}
      visibleQueue={visibleQueue}
      usesCustomMeetingSubmit={usesCustomMeetingSubmit}
      initiationMeetingSession={initiationMeetingSession}
      backendMeetingSendRequired={backendMeetingSendRequired}
      setSettingsTab={setSettingsTab}
      setSettingsOpen={setSettingsOpen}
      speechRecognitionSupported={Boolean(speechRecognitionSupported)}
      roomVoiceStatus={roomVoiceStatus}
      toggleRoomVoiceInput={toggleRoomVoiceInput}
      roomInput={roomInput}
      roomUserIntentActive={roomUserIntentActive}
      setRoomUserIntentActive={setRoomUserIntentActive}
      setRoomInput={setRoomInput}
      canSendMeeting={canSendMeeting}
      submitMeetingInput={submitMeetingInput}
      localizeText={localizeText}
      activeLanguage={activeLanguage}
    />
  );
}
