export default function LocalRuntimeRecoveryBanner({ notice, onRetry, onOpenRecovery }) {
  if (!notice?.visible) return null;

  return (
    <section data-testid="local-runtime-recovery-banner" role="alert" className="fixed left-1/2 top-4 z-[220] w-[min(720px,calc(100vw-32px))] -translate-x-1/2 border border-[#8f1e18] bg-[#fff8e7] p-4 text-[#251b13] shadow-[8px_8px_0_rgba(0,0,0,0.2)]">
      <div className="font-serif text-xl">{notice.title}</div>
      <p className="mt-1 text-sm leading-relaxed">{notice.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" data-testid="local-runtime-retry" onClick={onRetry} className="border border-[#251b13] bg-[#251b13] px-3 py-2 text-sm text-white">重新检查</button>
        <button type="button" data-testid="local-runtime-open-recovery" onClick={onOpenRecovery} className="border border-[#251b13] px-3 py-2 text-sm">打开恢复设置</button>
      </div>
    </section>
  );
}
