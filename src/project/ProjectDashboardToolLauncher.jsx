import React from 'react';
import { Grid, X } from 'lucide-react';

export default function ProjectDashboardToolLauncher({ view = {} }) {
  const {
    launchers,
    onEnterScene,
    onOpenChange,
    open,
    transition,
  } = view;

  return (
    <div
      className="absolute bottom-6 right-6 z-30"
      onFocusCapture={() => onOpenChange(true)}
    >
      <div
        className={`absolute bottom-16 right-0 flex flex-col gap-2 transition-all duration-200 ${
          open ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-4 opacity-0 pointer-events-none'
        }`}
      >
        {launchers.map(item => (
          <button
            key={item.id}
            onClick={() => onEnterScene(item.id)}
            disabled={Boolean(transition)}
            className={`group relative flex w-64 items-center gap-3 border border-[#7b6542] bg-[#efe2bd] p-3 text-left text-[#251b13] shadow-[6px_6px_0_rgba(0,0,0,0.18)] transition-all ${
              transition ? 'opacity-60 cursor-wait' : 'hover:-translate-x-1 hover:border-[#251b13]'
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#b8a57d] bg-[#f7edcf] text-[#8f1e18]">
              <item.icon size={20} />
            </span>
            <span className="min-w-0">
              <span className="block font-serif text-lg leading-tight">{item.label}</span>
              <span className="block font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{item.sub}</span>
              <span className="mt-1 block font-serif text-sm leading-tight text-[#6b5a3d] opacity-0 transition-opacity group-hover:opacity-100">
                {item.desc}
              </span>
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onOpenChange(current => !current)}
        disabled={Boolean(transition)}
        aria-expanded={open}
        aria-label="Open project tools"
        className={`scene-object flex h-14 w-14 items-center justify-center border border-[#7b6542] bg-[#251b13] text-[#efe2bd] shadow-[7px_7px_0_rgba(0,0,0,0.22)] transition-all ${
          transition ? 'cursor-wait opacity-70' : 'hover:-translate-y-1 hover:bg-[#8f1e18]'
        }`}
      >
        {open ? <X size={20} /> : <Grid size={20} />}
      </button>
    </div>
  );
}
