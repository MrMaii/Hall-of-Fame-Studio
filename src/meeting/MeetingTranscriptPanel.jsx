export default function MeetingTranscriptPanel({
  transcript,
  expandedLogIds,
  onExpandedLogIdsChange,
  title,
  activeLanguage,
  statusLabel,
}) {
  return (
    <div className="bg-[#1a130e]/80 border border-[#3a2a1c] rounded p-4 flex-1 overflow-y-auto min-h-0">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-xs uppercase tracking-widest text-[#7d6a49]">{title}</span>
      </div>
      <div className="space-y-3">
        {transcript.slice(-8).map((log) => {
          const isSystem = log.speaker === 'System';
          const isDirector = log.speaker === 'Director';
          const speakerLabel = isDirector ? '你' : isSystem ? '系统' : log.speaker;
          const logExpanded = expandedLogIds.includes(log.id);
          const logCanExpand = String(log.text || '').length > 160;
          const logSignalLabel = isDirector
            ? '你的问题'
            : /决定|确认|选择/.test(String(log.text || ''))
              ? '决定'
              : /结论|结果/.test(String(log.text || ''))
                ? '结论'
                : isSystem ? '系统' : 'AI 回复';
          const nextStepMatch = String(log.text || '').match(/(?:下一步|接下来)[：:\s]*([^。！？\n]+[。！？]?)/);

          return (
            <div key={log.id} className={`border-l-[3px] pl-3 py-1 ${isDirector ? 'border-[#efe2bd]' : isSystem ? 'border-[#3a2a1c]' : 'border-[#8f1e18]'}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`font-mono text-xs uppercase tracking-widest ${isDirector ? 'text-[#efe2bd]' : 'text-[#bcae86]'}`}>{speakerLabel}</span>
                {log.score > 0 && <span className="font-mono text-xs text-[#bcae86] ml-auto">{log.score}/10</span>}
              </div>
              <div className={`mb-1 inline-flex border px-1.5 py-0.5 text-xs ${isDirector ? 'border-[#efe2bd] text-[#efe2bd]' : 'border-[#7b6542] text-[#bcae86]'}`}>{logSignalLabel}</div>
              <div data-no-localize="" className={`font-serif text-sm leading-relaxed text-[#d8c99f] ${logCanExpand && !logExpanded ? 'line-clamp-4' : ''}`}>{log.text}</div>
              {nextStepMatch?.[1] && (
                <div className="mt-2 border-l-2 border-[#b9782b] bg-[#251b13] px-3 py-2 text-xs leading-relaxed text-[#efe2bd]">
                  <span className="font-semibold">下一步：</span><span data-no-localize="">{nextStepMatch[1]}</span>
                </div>
              )}
              {logCanExpand && (
                <button
                  type="button"
                  onClick={() => onExpandedLogIdsChange(
                    logExpanded ? expandedLogIds.filter(id => id !== log.id) : [...expandedLogIds, log.id],
                  )}
                  className="mt-2 text-xs text-[#bcae86] underline underline-offset-4 hover:text-[#efe2bd]"
                >
                  {logExpanded ? '收起完整内容' : '展开完整内容'}
                </button>
              )}
              {isDirector && log.deliveryStatus && (
                <div data-testid={`meeting-message-status-${log.id}`} className="mt-1 font-mono text-xs text-[#bcae86]">
                  {statusLabel(log.deliveryStatus, activeLanguage)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
