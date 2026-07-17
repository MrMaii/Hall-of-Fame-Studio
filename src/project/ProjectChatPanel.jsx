import { useEffect, useRef } from 'react';
import { ArrowLeft, MessageSquare, Send } from 'lucide-react';

function messageAuthor(message = {}) {
  return message.author || message.speaker || message.agentName || '项目成员';
}

function messageTime(message = {}) {
  if (message.time) return message.time;
  const value = message.createdAt || message.sentAt || message.timestamp;
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function deliveryLabel(message = {}) {
  if (message.pendingBackendWrite) return '正在发送';
  if (['failed', 'error'].includes(message.status || message.deliveryStatus)) return '发送失败';
  if (['timeout', 'timed-out'].includes(message.status || message.deliveryStatus)) return '等待超时';
  return '';
}

export default function ProjectChatPanel({
  project,
  channels = [],
  activeChannelId,
  messages = [],
  input = '',
  canSend = false,
  sendBlocked = false,
  sending = false,
  restoring = false,
  onBack,
  onSelectChannel,
  onInputChange,
  onInputKeyDown,
  onSend,
  onReload,
} = {}) {
  if (!project) return null;
  const activeChannel = channels.find(channel => channel.id === activeChannelId) || channels[0];
  const channelName = activeChannel?.id === 'google_chat' ? '外部消息' : activeChannel?.name || '项目群聊';
  const messageEndRef = useRef(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, activeChannelId]);

  return (
    <div data-testid="project-chat-panel" className="flex h-screen min-w-0 flex-col bg-[#171411] text-[#efe2bd]">
      <header className="border-b border-[#3a2a1c] px-4 py-4 sm:px-6">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm text-[#bcae86] hover:text-white"><ArrowLeft size={16} /> 返回项目</button>
        <div className="mt-4 flex min-w-0 items-center gap-3">
          <MessageSquare size={20} className="shrink-0 text-[#8f1e18]" />
          <div className="min-w-0"><h1 className="truncate font-serif text-2xl">{project.name}</h1><p className="mt-1 text-sm text-[#bcae86]">项目群聊</p></div>
        </div>
        <nav aria-label="项目群聊频道" className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {channels.map(channel => (
            <button key={channel.id} type="button" onClick={() => onSelectChannel?.(channel.id)} className={`shrink-0 border px-3 py-2 text-sm ${channel.id === activeChannelId ? 'border-[#efe2bd] bg-[#efe2bd] text-[#251b13]' : 'border-[#3a2a1c] text-[#bcae86] hover:border-[#7b6542]'}`}>
              {channel.id === 'google_chat' ? '外部消息' : channel.name || '频道'}
            </button>
          ))}
        </nav>
      </header>

      <main aria-label={`${channelName}消息`} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-4">
          {messages.length === 0 && restoring && (
            <div role="status" className="border border-[#7b6542] px-5 py-8 text-center text-sm text-[#bcae86]">
              <div className="font-serif text-lg text-[#efe2bd]">聊天记录正在恢复</div>
              <p className="mt-2">本机正在读取这个频道的历史消息。</p>
              <button type="button" onClick={onReload} className="mt-4 border border-[#bcae86] px-4 py-2 text-sm text-[#efe2bd]">重新加载</button>
            </div>
          )}
          {messages.length === 0 && !restoring && <div className="border border-dashed border-[#3a2a1c] px-5 py-10 text-center text-sm text-[#bcae86]">这里还没有消息。发送第一条信息后，团队回复会显示在这里。</div>}
          {messages.map((message, index) => {
            const author = messageAuthor(message);
            const status = deliveryLabel(message);
            if (message.type === 'system') return <div key={message.id || index} className="py-2 text-center text-sm text-[#7d6a49]">{message.text}</div>;
            return (
              <article key={message.id || `${author}-${index}`} className={`rounded-sm border p-4 ${message.type === 'decision' ? 'border-[#59684b] bg-[#202719]' : 'border-[#3a2a1c] bg-[#1d1915]'}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"><strong className="font-serif text-base">{author}</strong>{message.role && <span className="text-[#bcae86]">{message.role === 'Leader' ? '负责人' : message.role}</span>}<span className="ml-auto text-[#7d6a49]">{messageTime(message)}</span></div>
                <p className="mt-2 whitespace-pre-wrap break-words font-serif text-lg leading-relaxed text-[#d8c99f]">{message.text || message.summary || '消息内容为空'}</p>
                {message.type === 'decision' && <div className="mt-2 text-sm text-[#a9bd91]">已确认的决定</div>}
                {status && <div role="status" className={`mt-2 text-sm ${status === '发送失败' || status === '等待超时' ? 'text-[#e19991]' : 'text-[#d9b56c]'}`}>{status}</div>}
              </article>
            );
          })}
          <div ref={messageEndRef} aria-hidden="true" />
        </div>
      </main>

      <footer className="border-t border-[#3a2a1c] bg-[#1a130e] p-4 sm:p-5">
        <div className="mx-auto max-w-4xl">
          {sendBlocked && <div className="mb-3 border border-[#8f1e18] bg-[#251b13] px-4 py-3 text-sm text-[#e7b3ae]">本地服务暂时不可用。已经输入的内容不会丢失，服务恢复后可以继续发送。</div>}
          <label className="sr-only" htmlFor="project-chat-message">发送项目消息</label>
          <div className="flex items-end gap-2">
            <textarea id="project-chat-message" value={input} onChange={onInputChange} onKeyDown={onInputKeyDown} rows={2} placeholder={`发送到 ${channelName}`} className="min-h-12 flex-1 resize-none border border-[#3a2a1c] bg-[#251b13] px-4 py-3 text-base text-[#efe2bd] outline-none placeholder:text-[#7d6a49] focus:border-[#bcae86]" />
            <button type="button" data-testid="project-chat-send" onClick={onSend} disabled={!canSend} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 bg-[#8f1e18] px-5 py-3 text-white hover:bg-[#a62a22] disabled:cursor-not-allowed disabled:opacity-40"><Send size={16} /> {sending ? '发送中' : '发送'}</button>
          </div>
          <p className="mt-2 text-xs text-[#7d6a49]">按 Enter 发送，Shift + Enter 换行。</p>
        </div>
      </footer>
    </div>
  );
}
