import { X } from 'lucide-react';

export default function SettingsDialogShell({
  navItems = [],
  activeTab = '',
  onTabChange,
  onClose,
  closeLabel = 'Close',
  directorName = '',
  directorHandle = '',
  eyebrow = '',
  title = '',
  children,
  StatusIcon,
  footerReady = false,
  footerLabel = '',
  connectionLabel = '',
  onConnectionTest,
  connectionDisabled = false,
} = {}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-6 py-6">
      <button type="button" aria-label={closeLabel} onClick={onClose} className="absolute inset-0 cursor-default" />
      <section role="dialog" aria-modal="true" aria-labelledby="local-settings-title" className="relative z-10 flex h-[min(760px,92vh)] w-[min(1040px,94vw)] overflow-hidden border border-[#1a1a1a] bg-[#ebe9e0] shadow-[18px_18px_0_rgba(0,0,0,0.22)]">
        <aside className="w-64 shrink-0 border-r border-[#d1d0c9] bg-[#dfdccf] p-5">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center border border-[#1a1a1a] bg-[#1a1a1a] font-serif text-2xl text-[#f5f4f0]">D</div>
            <div className="min-w-0">
              <div className="truncate font-serif text-xl leading-none">{directorName}</div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[#7d786b]">{directorHandle}</div>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  data-testid={`settings-tab-${item.id}`}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 text-left font-mono text-xs transition-colors ${active ? 'bg-[#1a1a1a] text-[#f5f4f0]' : 'text-[#4f4b43] hover:bg-[#d1d0c9] hover:text-[#1a1a1a]'}`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#d1d0c9] px-6">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#8b8678]">{eyebrow}</div>
              <h2 id="local-settings-title" className="font-serif text-3xl leading-none">{title}</h2>
            </div>
            <button type="button" onClick={onClose} className="p-2 text-[#555047] hover:bg-[#d1d0c9] hover:text-black transition-colors" aria-label={closeLabel}>
              <X size={18} />
            </button>
          </header>

          {children}

          <footer className="flex h-16 shrink-0 items-center justify-between border-t border-[#d1d0c9] px-7">
            <div data-testid="settings-footer-backend-save-status" className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] ${footerReady ? 'text-green-700' : 'text-[#75631d]'}`}>
              {StatusIcon && <StatusIcon size={14} />}
              {footerLabel}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="settings-footer-test-connection"
                onClick={onConnectionTest}
                disabled={connectionDisabled}
                className={`border border-[#d1d0c9] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[#555047] transition-colors ${connectionDisabled ? 'cursor-not-allowed opacity-50' : 'hover:border-[#1a1a1a] hover:text-black'}`}
              >
                {connectionLabel}
              </button>
            </div>
          </footer>
        </div>
      </section>
    </div>
  );
}
