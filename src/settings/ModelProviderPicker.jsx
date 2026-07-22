import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Cpu, Globe2, MapPinned, Sparkles, X } from 'lucide-react';
import openaiLogo from '@lobehub/icons-static-svg/icons/openai.svg';
import anthropicLogo from '@lobehub/icons-static-svg/icons/anthropic.svg';
import geminiLogo from '@lobehub/icons-static-svg/icons/gemini-color.svg';
import stepfunLogo from '@lobehub/icons-static-svg/icons/stepfun-color.svg';
import deepseekLogo from '@lobehub/icons-static-svg/icons/deepseek-color.svg';
import qwenLogo from '@lobehub/icons-static-svg/icons/qwen-color.svg';
import { MODEL_PROVIDERS, STEPFUN_REGIONS, findModelProvider, modelsForProvider, stepfunRegionForBaseUrl } from './modelProviderCatalog.js';

const providerLogos = {
  OpenAI: openaiLogo,
  Anthropic: anthropicLogo,
  Gemini: geminiLogo,
  Stepfun: stepfunLogo,
  DeepSeek: deepseekLogo,
  Qwen: qwenLogo,
};

const providerEnglishCopy = {
  openai: { name: 'OpenAI', description: 'General-purpose, reasoning, and coding models in the GPT family' },
  anthropic: { name: 'Claude', description: 'Anthropic models for long context, analysis, and coding' },
  gemini: { name: 'Gemini', description: 'Google multimodal and long-context models' },
  stepfun: { name: 'Stepfun', description: 'Step models for reasoning, tool use, and vision' },
  deepseek: { name: 'DeepSeek', description: 'DeepSeek general-purpose and advanced reasoning models' },
  qwen: { name: 'Qwen', description: 'Qwen text and coding models through Alibaba Cloud Model Studio' },
  custom: { name: 'Local or custom', description: 'Ollama, LM Studio, or another OpenAI-compatible endpoint' },
};

const stepfunRegionTestIds = {
  global: 'settings-stepfun-region-option-global',
  china: 'settings-stepfun-region-option-china',
};

const modelNoteEnglish = {
  综合能力: 'General purpose',
  智能体与编码: 'Agents and coding',
  复杂推理: 'Complex reasoning',
  速度与成本平衡: 'Balanced speed and cost',
  稳定通用: 'Stable general use',
  轻量任务: 'Lightweight tasks',
  高频轻量任务: 'High-volume lightweight tasks',
  高难度任务: 'Advanced tasks',
  推荐: 'Recommended',
  快速响应: 'Fast response',
  稳定版: 'Stable release',
  复杂任务预览版: 'Complex task preview',
  快速预览版: 'Fast preview',
  低成本: 'Low cost',
  固定版本: 'Pinned release',
  视觉与复杂推理: 'Vision and complex reasoning',
  工具调用: 'Tool use',
  兼容模型: 'Compatibility model',
  视觉理解: 'Vision understanding',
  高性能: 'High performance',
  '兼容名称，将于 2026-07-24 下线': 'Compatibility name; scheduled for retirement on 2026-07-24',
  通用模型: 'General-purpose model',
  轻量模型: 'Lightweight model',
  'Ollama 默认示例': 'Default Ollama example',
  适用于本机或新增模型: 'For local or newly added models',
  适用于新发布或账号专属模型: 'For newly released or account-specific models',
};

function ProviderLogo({ provider, size = 'h-8 w-8' }) {
  const source = providerLogos[provider.logo];
  return source
    ? <img src={source} alt="" aria-hidden="true" className={`${size} object-contain`} />
    : <Cpu aria-hidden="true" className={size} strokeWidth={1.6} />;
}

function useDialogFocus(open, onClose) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const overlay = overlayRef.current;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backgroundSiblings = [];
    let activeBranch = overlay;
    while (activeBranch?.parentElement) {
      const parent = activeBranch.parentElement;
      Array.from(parent.children).filter(sibling => sibling !== activeBranch).forEach((sibling) => {
        backgroundSiblings.push({
          sibling,
          hadInert: sibling.hasAttribute('inert'),
          ariaHidden: sibling.getAttribute('aria-hidden'),
        });
        sibling.setAttribute('inert', '');
        sibling.setAttribute('aria-hidden', 'true');
      });
      activeBranch = parent;
      if (parent === document.body) break;
    }

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
      if (event.shiftKey && document.activeElement === first) {
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
  }, [open]);

  return { overlayRef, dialogRef };
}

function BottomDrawer({ open, title, testId, onClose, children, activeLanguage = 'zh' }) {
  const { overlayRef, dialogRef } = useDialogFocus(open, onClose);

  if (!open) return null;
  const reducedMotionMediaQuery = '(prefers-reduced-motion: reduce)';
  void reducedMotionMediaQuery;
  return (
    <div ref={overlayRef} className="fixed inset-0 z-[90] flex items-end bg-black/35" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} data-testid={testId} className="max-h-[min(520px,70vh)] w-full overflow-y-auto border-t border-[#1a1a1a] bg-[#f5f4f0] shadow-[0_-18px_50px_rgba(0,0,0,0.2)] transition-transform duration-200 motion-reduce:transition-none">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#d1d0c9] bg-[#f5f4f0]/95 px-5 py-4 backdrop-blur-sm sm:px-8">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8f1e18]">AI MODEL</div>
            <h5 className="mt-1 font-serif text-2xl text-[#1a1a1a]">{title}</h5>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center border border-[#1a1a1a] transition-colors hover:bg-[#1a1a1a] hover:text-white" aria-label={activeLanguage === 'en' ? `Close ${title}` : `关闭${title}`}>
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function StepfunRegionDialog({ open, selectedRegionId, onClose, onSelect, activeLanguage = 'zh' }) {
  const { overlayRef, dialogRef } = useDialogFocus(open, onClose);

  if (!open) return null;
  const text = (chinese, english) => activeLanguage === 'en' ? english : chinese;
  return (
    <div ref={overlayRef} className="stepfun-region-backdrop-in fixed inset-0 z-[100] flex items-center justify-center bg-[#111]/55 p-4 backdrop-blur-[3px]" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="stepfun-region-title" data-testid="settings-stepfun-region-dialog" className="stepfun-region-dialog-in relative w-full max-w-2xl overflow-hidden border border-[#1a1a1a] bg-[#f8f6ee] shadow-[12px_14px_0_rgba(0,0,0,0.28)]">
        <div className="h-1.5 bg-[linear-gradient(90deg,#635bff_0%,#20c997_52%,#eeaa38_100%)]" />
        <div className="relative border-b border-[#d1d0c9] px-6 py-6 sm:px-8">
          <div className="absolute right-20 top-5 h-20 w-20 rounded-full bg-[#6d5dfc]/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center border border-[#c9c5bb] bg-white shadow-[3px_3px_0_rgba(0,0,0,0.10)]"><img src={stepfunLogo} alt="" aria-hidden="true" className="h-9 w-9 object-contain" /></span>
              <div>
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#6d5dfc]"><Sparkles size={13} /> STEPFUN REGION</div>
                <h5 id="stepfun-region-title" className="mt-1 font-serif text-2xl text-[#1a1a1a] sm:text-3xl">{text('选择阶跃星辰版本', 'Choose your Stepfun region')}</h5>
                <p className="mt-2 text-sm leading-relaxed text-[#5f5a50]">{text('密钥与站点必须匹配。选择后会自动填入正确的接口地址。', 'Your API key must match its site. The correct endpoint will be filled automatically.')}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#1a1a1a] bg-[#f8f6ee] transition-colors hover:bg-[#1a1a1a] hover:text-white" aria-label={text('关闭版本选择', 'Close region chooser')}><X size={18} /></button>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-8">
          {STEPFUN_REGIONS.map((region) => {
            const active = region.id === selectedRegionId;
            const RegionIcon = region.id === 'global' ? Globe2 : MapPinned;
            return (
              <button key={region.id} type="button" data-testid={stepfunRegionTestIds[region.id]} onClick={() => onSelect(region)} className={`group relative min-h-44 border p-5 text-left transition-all duration-200 motion-reduce:transition-none ${active ? 'border-[#1a1a1a] bg-white shadow-[5px_5px_0_rgba(0,0,0,0.16)]' : 'border-[#c9c5bb] bg-[#f3f0e7] hover:-translate-y-1 hover:border-[#1a1a1a] hover:bg-white hover:shadow-[5px_5px_0_rgba(0,0,0,0.12)] motion-reduce:transform-none'}`}>
                <span className="flex items-start justify-between gap-4">
                  <span className="flex h-11 w-11 items-center justify-center border border-[#d1d0c9] bg-white text-[#6d5dfc]"><RegionIcon size={22} strokeWidth={1.7} /></span>
                  {active && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1a1a1a] text-white"><Check size={14} /></span>}
                </span>
                <span className="mt-4 block font-serif text-2xl text-[#1a1a1a]">{activeLanguage === 'en' ? region.englishLabel : region.label}</span>
                <span className="mt-2 block text-xs leading-relaxed text-[#5f5a50]">{activeLanguage === 'en' ? region.englishDescription : region.description}</span>
                <span className="mt-4 block break-all border-t border-[#d1d0c9] pt-3 font-mono text-[10px] text-[#6d5dfc]">{region.baseURL}</span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-[#d1d0c9] bg-white/60 px-6 py-3 text-center font-mono text-[10px] text-[#777166] sm:px-8">{text('国际站 Key 选择国际版 · 国内站 Key 选择国内版', 'Global key → International · Mainland China key → Mainland China')}</div>
      </section>
    </div>
  );
}

export default function ModelProviderPicker({ providerId, modelId, baseURL = '', disabled = false, onProviderChange, onModelChange, activeLanguage = 'zh' }) {
  const text = (chinese, english) => activeLanguage === 'en' ? english : chinese;
  const providerName = (provider) => activeLanguage === 'en' ? providerEnglishCopy[provider.id]?.name || provider.name : provider.name;
  const providerDescription = (provider) => activeLanguage === 'en' ? providerEnglishCopy[provider.id]?.description || provider.description : provider.description;
  const modelNote = (entry) => activeLanguage === 'en' ? modelNoteEnglish[entry?.note] || entry?.note : entry?.note;
  const [providerOpen, setProviderOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [stepfunRegionOpen, setStepfunRegionOpen] = useState(false);
  const selectedProvider = findModelProvider(providerId);
  const selectedProviderBaseURL = String(baseURL || selectedProvider.baseURL || '');
  const selectedStepfunRegion = selectedProvider.id === 'stepfun' ? stepfunRegionForBaseUrl(selectedProviderBaseURL) : null;
  const providerModels = modelsForProvider(selectedProvider.id);
  if (!providerModels.some((entry) => entry.id === '__custom__')) {
    providerModels.push({ id: '__custom__', name: text('填写自定义模型名称', 'Enter a custom model name'), note: text('适用于新发布或账号专属模型', 'For newly released or account-specific models') });
  }
  const selectedModel = providerModels.find((entry) => entry.id === modelId);

  return (
    <div className="grid gap-4">
      <div>
        <div className="text-sm text-[#4f4b43]">{text('模型供应商', 'Model provider')}</div>
        <button type="button" data-testid="settings-model-provider-trigger" disabled={disabled} onClick={() => setProviderOpen(true)} className="mt-2 flex w-full items-center justify-between gap-4 border border-[#b8b4a8] bg-white px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-[#1a1a1a] hover:shadow-[4px_4px_0_rgba(0,0,0,0.12)] motion-reduce:transform-none disabled:cursor-not-allowed disabled:opacity-50">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#d1d0c9] bg-[#f8f6ee]"><ProviderLogo provider={selectedProvider} /></span>
            <span className="min-w-0">
              <span className="block font-serif text-xl text-[#1a1a1a]">{providerName(selectedProvider)}</span>
              <span className="flex items-center gap-2">
                <span className="block truncate font-mono text-[10px] text-[#777166]">{selectedProviderBaseURL}</span>
                {selectedStepfunRegion && <span className="shrink-0 border border-[#6d5dfc]/35 bg-[#6d5dfc]/5 px-1.5 py-0.5 font-mono text-[9px] text-[#5547d7]">{activeLanguage === 'en' ? selectedStepfunRegion.englishLabel : selectedStepfunRegion.label}</span>}
              </span>
            </span>
          </span>
          <ChevronDown size={18} className="shrink-0" />
        </button>
      </div>

      <div>
        <div className="text-sm text-[#4f4b43]">{text('模型名称', 'Model name')}</div>
        <button type="button" data-testid="settings-model-name-trigger" disabled={disabled} onClick={() => setModelOpen(true)} className="mt-2 flex w-full items-center justify-between gap-4 border border-[#b8b4a8] bg-white px-4 py-3 text-left transition-colors hover:border-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-50">
          <span>
            <span data-user-content={!selectedModel && modelId ? '' : undefined} className="block text-sm font-medium text-[#1a1a1a]">{selectedModel?.name || modelId || text('选择模型', 'Choose a model')}</span>
            <span data-user-content={!selectedModel && modelId ? '' : undefined} className="mt-1 block font-mono text-[10px] text-[#777166]">{modelNote(selectedModel) || modelId || text('请选择一个模型', 'Choose a model')}</span>
          </span>
          <ChevronDown size={18} className="shrink-0" />
        </button>
      </div>

      <BottomDrawer open={providerOpen} title={text('选择模型供应商', 'Choose a model provider')} testId="settings-model-provider-drawer" onClose={() => setProviderOpen(false)} activeLanguage={activeLanguage}>
        <div className="mx-auto grid max-w-5xl gap-3 p-5 sm:grid-cols-2 sm:p-8 lg:grid-cols-3">
          {MODEL_PROVIDERS.map((provider) => {
            const active = provider.id === selectedProvider.id;
            return (
              <button key={provider.id} type="button" data-testid={`settings-model-provider-option-${provider.id}`} onClick={() => {
                if (provider.id === 'stepfun') {
                  setProviderOpen(false);
                  setStepfunRegionOpen(true);
                  return;
                }
                onProviderChange(provider);
                setProviderOpen(false);
              }} className={`group relative flex min-h-32 gap-4 border p-4 text-left transition-all duration-200 motion-reduce:transition-none ${active ? 'border-[#1a1a1a] bg-white shadow-[5px_5px_0_rgba(0,0,0,0.16)]' : 'border-[#d1d0c9] bg-[#f8f6ee] hover:-translate-y-1 hover:border-[#1a1a1a] hover:bg-white hover:shadow-[5px_5px_0_rgba(0,0,0,0.12)] motion-reduce:transform-none'}`}>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-[#d1d0c9] bg-white"><ProviderLogo provider={provider} /></span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-serif text-xl text-[#1a1a1a]">{providerName(provider)}{active && <Check size={15} />}</span>
                  <span className="mt-2 block text-xs leading-relaxed text-[#5f5a50]">{providerDescription(provider)}</span>
                  <span className="mt-3 block font-mono text-[9px] uppercase tracking-wider text-[#8f1e18]">{provider.models.length} {text('个内置选项', 'built-in options')}</span>
                </span>
              </button>
            );
          })}
        </div>
      </BottomDrawer>

      <StepfunRegionDialog
        open={stepfunRegionOpen}
        selectedRegionId={selectedStepfunRegion?.id}
        activeLanguage={activeLanguage}
        onClose={() => setStepfunRegionOpen(false)}
        onSelect={(region) => {
          onProviderChange({ ...findModelProvider('stepfun'), baseURL: region.baseURL, region: region.id });
          setStepfunRegionOpen(false);
        }}
      />

      <BottomDrawer open={modelOpen} title={text(`选择 ${selectedProvider.name} 模型`, `Choose a ${providerName(selectedProvider)} model`)} testId="settings-model-name-drawer" onClose={() => setModelOpen(false)} activeLanguage={activeLanguage}>
        <div className="mx-auto grid max-w-4xl gap-2 p-5 sm:grid-cols-2 sm:p-8">
          {providerModels.map((entry) => {
            const active = entry.id === modelId;
            return (
              <button key={entry.id} type="button" data-testid={`settings-model-name-option-${entry.id}`} onClick={() => {
                onModelChange(entry.id);
                setModelOpen(false);
              }} className={`flex items-center justify-between gap-3 border px-4 py-3 text-left transition-colors ${active ? 'border-[#1a1a1a] bg-[#1a1a1a] text-white' : 'border-[#d1d0c9] bg-white text-[#1a1a1a] hover:border-[#1a1a1a]'}`}>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{entry.name}</span>
                  <span className={`mt-1 block font-mono text-[10px] ${active ? 'text-[#d8d4c8]' : 'text-[#777166]'}`}>{modelNote(entry) || entry.id}</span>
                </span>
                {active && <Check size={16} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      </BottomDrawer>
    </div>
  );
}
