import { useEffect, useRef } from 'react';
import { Database, Eye, FileSignature, X } from 'lucide-react';

export default function AgentContractProjectPicker({ agent, rows, signing, onSelect, onClose, onCreateProject }) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!agent) return undefined;
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
        event.stopPropagation();
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
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      backgroundSiblings.forEach(({ sibling, hadInert, ariaHidden }) => {
        if (!hadInert) sibling.removeAttribute('inert');
        if (ariaHidden === null) sibling.removeAttribute('aria-hidden');
        else sibling.setAttribute('aria-hidden', ariaHidden);
      });
      previousFocus?.focus();
    };
  }, [agent?.id]);

  if (!agent) return null;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 px-4 py-4 sm:px-6 sm:py-6">
      <button type="button" aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0 z-0 cursor-default" />
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="contract-project-title" className="relative z-10 flex max-h-[88vh] w-[min(820px,94vw)] flex-col overflow-hidden border border-[#251b13] bg-[#efe2bd] text-[#251b13] shadow-[18px_18px_0_rgba(0,0,0,0.28)]">
        <header className="flex items-start justify-between gap-6 border-b border-[#b8a57d] p-5 sm:p-6">
          <div>
            <div className="mb-3 font-mono text-xs tracking-[0.18em] text-[#8f1e18]">选择签约项目</div>
            <h2 id="contract-project-title" className="font-serif text-3xl leading-tight sm:text-4xl">为 {agent.name} 选择项目</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5c4933] sm:text-base">选择现有项目后，这位成员会加入项目团队。已经加入的项目可以直接打开。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭项目选择" title="关闭" className="border border-[#b8a57d] p-2 text-[#5c4933] hover:border-[#251b13] hover:text-[#251b13]"><X size={18} /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-3">
            {rows.map(({ project, alreadyInTeam, backendTargetMissing, disabled }) => (
              <button key={project.id} type="button" onClick={() => onSelect(project.id, alreadyInTeam)} disabled={disabled || signing}
                title={backendTargetMissing ? '请先完成本地服务设置' : alreadyInTeam ? `打开项目：${project.name}` : `将 ${agent.name} 加入项目：${project.name}`}
                className="group flex flex-col items-stretch justify-between gap-4 border border-[#b8a57d] bg-[#f7edcf] p-4 text-left hover:border-[#251b13] hover:bg-[#fff8df] disabled:cursor-not-allowed disabled:opacity-55 sm:flex-row sm:items-center sm:p-5">
                <span className="min-w-0">
                  <span className="block font-serif text-2xl leading-tight">{project.name}</span>
                  <span className="mt-2 block text-sm text-[#6b604d]">团队成员：{(project.team || []).length} 位</span>
                  {alreadyInTeam && <span className="mt-2 inline-flex border border-[#59684b] bg-[#59684b] px-2 py-1 text-xs text-white">已经加入团队</span>}
                  {!alreadyInTeam && backendTargetMissing && <span data-testid={`contract-project-backend-required-${project.id}`} className="mt-2 inline-flex border border-[#8f1e18] bg-red-50 px-2 py-1 text-xs text-[#8f1e18]">请先完成本地服务设置</span>}
                </span>
                <span className="flex shrink-0 items-center justify-center gap-2 border border-[#251b13] bg-[#251b13] px-4 py-3 text-sm text-[#efe2bd]">
                  {alreadyInTeam ? <Eye size={15} /> : backendTargetMissing ? <Database size={15} /> : <FileSignature size={15} />}
                  {alreadyInTeam ? '打开项目' : backendTargetMissing ? '需要设置' : '加入项目'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#b8a57d] bg-[#e3d3a8] px-5 py-4 sm:px-6">
          <div className="text-sm text-[#6b604d]">可选择 {rows.length} 个现有项目</div>
          <button type="button" onClick={onCreateProject} className="border border-[#251b13] px-4 py-2 text-sm text-[#251b13] hover:bg-[#251b13] hover:text-[#efe2bd]">创建新项目</button>
        </footer>
      </section>
    </div>
  );
}
