import React from 'react';

export default function ProjectDashboardSampleFixturePath({ view = {} }) {
  const {
    steps,
    transition,
  } = view;

  return (
    <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-4">Sample Fixture Path</div>
      <div className="space-y-3">
        {steps.map((step, index) => (
          <button
            key={step.id}
            type="button"
            data-testid={`manager-demo-step-${step.id}`}
            onClick={step.action}
            disabled={Boolean(transition)}
            className="w-full border border-[#d8c99f] bg-[#efe2bd]/55 p-4 text-left transition-colors hover:border-[#251b13] hover:bg-[#efe2bd]"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-[#7b6542] bg-[#251b13] font-mono text-[10px] text-[#efe2bd]">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-serif text-xl leading-tight">{step.label}</span>
                <span className="mt-1 block font-serif text-sm leading-relaxed text-[#6b5a3d]">{step.detail}</span>
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
