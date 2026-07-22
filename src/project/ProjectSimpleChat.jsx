import { lazy } from 'react';

const ProjectChatPanel = lazy(() => import('./ProjectChatPanel.jsx'));

export default function ProjectSimpleChat({
  activeChannelId,
  canSend,
  channels,
  input,
  messages,
  onBack,
  onInputChange,
  onInputKeyDown,
  onReload,
  onSelectChannel,
  onSend,
  project,
  sendBlocked,
  sending,
  transcriptPresentation,
}) {
  return (
    <div data-testid="project-simple-chat">
      <ProjectChatPanel
        project={project}
        channels={channels}
        activeChannelId={activeChannelId}
        messages={messages}
        input={input}
        canSend={canSend}
        sendBlocked={sendBlocked}
        sending={sending}
        transcriptPresentation={transcriptPresentation}
        onBack={onBack}
        onSelectChannel={onSelectChannel}
        onInputChange={onInputChange}
        onInputKeyDown={onInputKeyDown}
        onSend={onSend}
        onReload={onReload}
      />
    </div>
  );
}
