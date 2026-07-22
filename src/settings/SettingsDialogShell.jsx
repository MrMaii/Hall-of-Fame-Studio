import { useEffect, useRef } from 'react';
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
  focused = false,
  showFooter = true,
} = {}) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const overlay = overlayRef.current;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backgroundSiblings = Array.from(overlay?.parentElement?.children || [])
      .filter(sibling => sibling !== overlay)
      .map(sibling => ({
        sibling,
        hadInert: sibling.hasAttribute('inert'),
        ariaHidden: sibling.getAttribute('aria-hidden'),
      }));
    backgroundSiblings.forEach(({ sibling }) => {
      sibling.setAttribute('inert', '');
      sibling.setAttribute('aria-hidden', 'true');
    });

    const focusableElements = () => Array.from(dialog?.querySelectorAll(
      'button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    ) || []).filter(element => (
      element.getAttribute('aria-hidden') !== 'true'
      && !element.closest('[aria-hidden="true"]')
      && element.getClientRects().length > 0
    ));
    const initialFocus = focusableElements()[0];
    if (initialFocus) initialFocus.focus();
    else dialog?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = focusableElements();
      if (!focusable.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      backgroundSiblings.forEach(({ sibling, hadInert, ariaHidden }) => {
        if (!hadInert) sibling.removeAttribute('inert');
        if (ariaHidden === null) sibling.removeAttribute('aria-hidden');
        else sibling.setAttribute('aria-hidden', ariaHidden);
      });
      previousFocus?.focus();
    };
  }, []);

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-0 sm:px-6 sm:py-6">
      <button type="button" aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default" />
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="local-settings-title" className={`relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden border border-[#1a1a1a] bg-[#ebe9e0] shadow-[18px_18px_0_rgba(0,0,0,0.22)] sm:h-[min(760px,92vh)] ${focused ? 'sm:w-[min(760px,94vw)]' : 'sm:w-[min(1040px,94vw)] sm:flex-row'}`}>
        {!focused && (
        <aside className="hidden w-64 shrink-0 border-r border-[#d1d0c9] bg-[#dfdccf] p-5 sm:block">
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
        )}

        {!focused && (
        <div className="border-b border-[#d1d0c9] bg-[#dfdccf] px-4 py-3 sm:hidden">
          <label className="sr-only" htmlFor="settings-mobile-tab-select">Settings section</label>
          <select
            id="settings-mobile-tab-select"
            data-testid="settings-mobile-tab-select"
            value={activeTab}
            onChange={(event) => onTabChange(event.target.value)}
            className="w-full border border-[#9b968c] bg-[#f8f6ee] px-3 py-2.5 font-mono text-sm text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
          >
            {navItems.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#d1d0c9] px-4 sm:px-6">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#8b8678]">{eyebrow}</div>
              <h2 id="local-settings-title" className="font-serif text-2xl leading-none sm:text-3xl">{title}</h2>
            </div>
            <button type="button" onClick={onClose} className="p-2 text-[#555047] hover:bg-[#d1d0c9] hover:text-black transition-colors" aria-label={closeLabel}>
              <X size={18} />
            </button>
          </header>

          {children}

          {showFooter && <footer className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#d1d0c9] px-4 py-2 sm:px-7">
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
          </footer>}
        </div>
      </section>
    </div>
  );
}
