import { Mic2 } from 'lucide-react';

export default function MeetingInputPanel({
  backendSendRequired,
  onOpenSettings,
  speechRecognitionSupported,
  voiceStatus,
  onToggleVoice,
  input,
  onInputChange,
  onUserIntentChange,
  canSend,
  onSend,
  userIntentActive,
}) {
  return (
    <>
      {backendSendRequired && (
        <div data-testid="backend-meeting-send-required" className="border border-[#8f1e18] bg-[#251b13] px-3 py-2 text-sm text-[#bcae86] leading-relaxed">
          <div>完成本地服务设置后才能发送真实会议消息。本项目不会使用模拟回复。</div>
          <button
            type="button"
            data-testid="backend-meeting-send-open-deployment"
            onClick={onOpenSettings}
            className="mt-2 inline-flex items-center gap-1 border border-[#7b6542] px-2 py-1 text-[#efe2bd] hover:border-[#efe2bd]"
          >
            打开本地服务设置
          </button>
        </div>
      )}
      <div className="bg-[#251b13] border border-[#3a2a1c] rounded-lg p-3 flex items-end gap-3 shrink-0">
        <button
          type="button"
          data-testid="project-meeting-voice"
          onClick={onToggleVoice}
          disabled={!speechRecognitionSupported || voiceStatus === 'unsupported'}
          aria-pressed={voiceStatus === 'listening'}
          aria-label="语音输入"
          title={voiceStatus === 'unsupported' ? '此浏览器不支持语音输入' : '语音输入'}
          className={`shrink-0 rounded border px-3 py-3 font-mono text-xs uppercase tracking-widest transition-colors ${
            voiceStatus === 'listening'
              ? 'border-[#8f1e18] bg-[#8f1e18] text-white'
              : 'border-[#3a2a1c] bg-[#1a130e] text-[#bcae86] hover:border-[#7b6542] hover:text-[#efe2bd] disabled:opacity-40'
          }`}
        >
          <Mic2 size={17} className={voiceStatus === 'listening' ? 'animate-pulse' : ''} />
          <span className="mt-1 block">语音</span>
        </button>
        <textarea
          data-testid="project-meeting-input"
          value={input}
          onFocus={() => onUserIntentChange(true)}
          onBlur={() => { if (!input.trim()) onUserIntentChange(false); }}
          onCompositionStart={() => onUserIntentChange(true)}
          onChange={(event) => {
            onUserIntentChange(true);
            onInputChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder="输入会议发言……"
          aria-label="会议发言"
          className="min-h-[76px] flex-1 resize-none bg-transparent py-1 outline-none text-[#efe2bd] font-serif text-lg leading-relaxed placeholder-[#7d6a49]/60"
        />
        <button data-testid="project-meeting-send" onClick={onSend}
          disabled={!canSend}
          title={backendSendRequired ? '完成本地服务设置后才能发送' : '发送会议发言'}
          className="shrink-0 bg-[#8f1e18] hover:bg-[#a62a22] text-white px-5 py-3 rounded flex items-center gap-2 font-mono text-xs uppercase tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          发言
        </button>
      </div>
      <div data-testid="project-meeting-director-precedence" className="mt-2 font-mono text-xs uppercase tracking-widest text-[#bcae86]">
        {userIntentActive ? '你正在输入，AI 回复已暂停' : '会议已就绪'}
      </div>
    </>
  );
}
