import { useState } from 'react';
import { CheckCircle2, Play, RefreshCw, Search, Server } from 'lucide-react';
import ModelProviderPicker from './ModelProviderPicker.jsx';
import { findModelProvider } from './modelProviderCatalog.js';

const statusLabel = (status, language = 'zh') => {
  const text = (chinese, english) => language === 'en' ? english : chinese;
  const normalized = status || {};
  return normalized.enabled && normalized.configured
    ? text('已经可以使用', 'Ready')
    : normalized.configured
      ? text('已保存，等待启用', 'Saved, waiting to be enabled')
      : text('尚未配置', 'Not configured');
};

const modelSettingsErrorMessage = (error, language = 'zh') => {
  const text = (chinese, english) => language === 'en' ? english : chinese;
  const message = String(error || '');
  if (/Model API key|Base URL|Model ID/i.test(message)) return text('请完整填写模型服务地址、模型名称和模型密钥。', 'Enter the model service address, model name, and model key.');
  if (/Evidence search API key|search endpoint/i.test(message)) return text('请完整填写搜索服务地址和搜索服务密钥。', 'Enter the search service address and search service key.');
  if (/backend API URL|backend target|Save.*backend/i.test(message)) return text('请先保存本地服务地址，再配置模型。', 'Save the local service address before configuring a model.');
  if (/Local authentication expired|Sign in again/i.test(message)) return text('本地身份验证已经失效。请在“本地身份”中重新登录，然后返回这里保存模型。', 'Local authentication expired. Sign in again under Local account, then return here to save the model.');
  if (/Secret vault|SECRET_VAULT/i.test(message)) return text('本地密钥存储尚未准备好。请重新启动本地服务后再试。', 'Local key storage is not ready. Restart the local service and try again.');
  if (/AbortError|timed out|timeout/i.test(message)) return text('检查等待时间过长，已经停止。请确认模型服务正在运行后重试。', 'The check timed out. Confirm that the model service is running and try again.');
  if (/fetch|connect|ECONNREFUSED|unreachable/i.test(message)) return text('无法连接模型服务。请检查地址以及模型服务是否正在运行。', 'Could not connect to the model service. Check the address and confirm that the service is running.');
  return text('模型设置没有保存。请检查填写内容和本地服务状态后重试。', 'Model settings were not saved. Check the form and local service status, then try again.');
};

export default function LocalModelSettings({
  backendUrlConfigured = false,
  targetLabel = '',
  providerRuntimeStatus = {},
  secretInputReady = false,
  sealReady = false,
  drafts,
  setDrafts,
  onSync,
  onTest,
  onSaveModel,
  onSaveSearch,
  onOpenLocalService,
  activeLanguage = 'zh',
} = {}) {
  const text = (chinese, english) => activeLanguage === 'en' ? english : chinese;
  const [modelNeedsNoKey, setModelNeedsNoKey] = useState(false);
  const [customModelMode, setCustomModelMode] = useState(false);
  const selectedProvider = findModelProvider(drafts.modelProvider || providerRuntimeStatus.modelProvider?.provider || 'custom');
  const modelReady = Boolean(providerRuntimeStatus.modelProvider?.enabled && providerRuntimeStatus.modelProvider?.configured);
  const searchReady = Boolean(providerRuntimeStatus.searchProvider?.enabled && providerRuntimeStatus.searchProvider?.configured);
  const busy = Boolean(drafts.running || providerRuntimeStatus.running);
  const canSaveModel = Boolean(
    !busy
    && String(drafts.modelBaseUrl || '').trim()
    && String(drafts.modelName || '').trim()
    && (modelNeedsNoKey || String(drafts.modelApiKey || '').trim())
  );
  const canSaveSearch = Boolean(
    !busy
    && sealReady
    && String(drafts.searchEndpoint || '').trim()
    && String(drafts.searchApiKey || '').trim()
  );
  const update = (field, value) => setDrafts(previous => ({
    ...previous,
    [field]: value,
    lastReceipt: null,
    error: null,
  }));
  const updateModelConfiguration = (values) => setDrafts(previous => ({
    ...previous,
    ...values,
    lastReceipt: null,
    error: null,
  }));
  const fieldClass = 'mt-2 w-full border border-[#b8b4a8] bg-white px-3 py-2.5 font-mono text-sm text-[#1a1a1a] outline-none focus:border-[#1a1a1a]';

  return (
    <div className="space-y-5" data-testid="settings-local-model-simple">
      <section className="border border-[#d1d0c9] bg-[#f5f4f0] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="font-mono text-xs tracking-[0.18em] text-[#8f1e18]">{text('本地模型配置', 'Local model configuration')}</div>
            <h3 className="mt-2 font-serif text-3xl leading-tight text-[#1a1a1a]">{text('连接这台电脑可以访问的 AI 模型', 'Connect an AI model available from this computer')}</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#5f5a50]">{text('项目、会议和历史记录仍保存在本机。这里填写的密钥只交给本地服务保存，不会留在浏览器页面中。', 'Projects, meetings, and history remain on this computer. Keys are stored only by the local service and are not kept in the browser page.')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" data-testid="settings-provider-sync-status" onClick={onSync} disabled={busy || !backendUrlConfigured} className="border border-[#1a1a1a] px-3 py-2 text-sm disabled:opacity-40"><RefreshCw size={14} className="mr-2 inline" />{text('刷新状态', 'Refresh status')}</button>
            <button type="button" data-testid="settings-provider-test-runtime" onClick={onTest} disabled={busy || !backendUrlConfigured} className="border border-[#1a1a1a] bg-[#1a1a1a] px-3 py-2 text-sm text-white disabled:opacity-40"><Play size={14} className="mr-2 inline" />{text('测试模型', 'Test model')}</button>
          </div>
        </div>
        {!backendUrlConfigured && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-[#b9a55f] bg-[#fbf7df] p-3 text-sm text-[#75631d]">
            <span>{text('请先设置本地服务地址，再配置模型。', 'Set the local service address before configuring a model.')}</span>
            <button type="button" data-testid="settings-provider-open-backend-target" onClick={onOpenLocalService} className="border border-current px-3 py-2">{text('打开本地服务设置', 'Open local service settings')}</button>
          </div>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="border border-[#d1d0c9] bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-[#5f5a50]"><Server size={15} />{text('AI 模型', 'AI model')}</div>
            <div className="mt-2 font-serif text-xl">{statusLabel(providerRuntimeStatus.modelProvider, activeLanguage)}</div>
          </div>
          <div className="border border-[#d1d0c9] bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-[#5f5a50]"><Search size={15} />{text('调查资料搜索', 'Research search')}</div>
            <div className="mt-2 font-serif text-xl">{searchReady ? text('已经可以使用', 'Ready') : text('可选，尚未配置', 'Optional, not configured')}</div>
          </div>
        </div>
      </section>

      <section className="border border-[#d1d0c9] bg-[#f8f6ee] p-5">
        <h4 className="font-serif text-2xl">{text('AI 模型', 'AI model')}</h4>
        <div className="mt-4 grid gap-4">
          <ModelProviderPicker
            providerId={selectedProvider.id}
            modelId={customModelMode ? '__custom__' : drafts.modelName || selectedProvider.defaultModel}
            disabled={!secretInputReady}
            activeLanguage={activeLanguage}
            onProviderChange={(provider) => {
              setModelNeedsNoKey(provider.id === 'custom' ? modelNeedsNoKey : false);
              setCustomModelMode(false);
              updateModelConfiguration({
                modelProvider: provider.id,
                modelBaseUrl: provider.baseURL,
                modelName: provider.defaultModel,
              });
            }}
            onModelChange={(modelName) => {
              const custom = modelName === '__custom__';
              setCustomModelMode(custom);
              updateModelConfiguration({ modelName: custom ? '' : modelName });
            }}
          />
          {(selectedProvider.id === 'custom' || customModelMode) && (
            <div className="grid gap-4 border-l-2 border-[#8f1e18] bg-[#f5f4f0] p-4">
              {selectedProvider.id === 'custom' && (
              <label className="text-sm text-[#4f4b43]">{text('自定义接口地址', 'Custom endpoint address')}
                <input data-testid="settings-provider-model-base-url-input" name="local-model-service-address" autoComplete="off" value={drafts.modelBaseUrl || ''} onChange={event => update('modelBaseUrl', event.target.value)} disabled={!secretInputReady} placeholder={text('例如：http://127.0.0.1:11434/v1', 'Example: http://127.0.0.1:11434/v1')} className={fieldClass} />
              </label>
              )}
              <label className="text-sm text-[#4f4b43]">{text('自定义模型名称', 'Custom model name')}
                <input data-testid="settings-provider-model-name-input" name="local-model-identifier" autoComplete="off" value={drafts.modelName || ''} onChange={event => update('modelName', event.target.value)} disabled={!secretInputReady} placeholder={text('例如：llama3.2', 'Example: llama3.2')} className={fieldClass} />
              </label>
            </div>
          )}
          <label className="text-sm text-[#4f4b43]">{text('模型密钥', 'Model key')}
            <input data-testid="settings-provider-model-key-input" name="local-model-api-key" type="password" autoComplete="new-password" value={drafts.modelApiKey || ''} onChange={event => update('modelApiKey', event.target.value)} disabled={!secretInputReady || modelNeedsNoKey} placeholder={modelNeedsNoKey ? text('这个本地模型不需要密钥', 'This local model does not require a key') : text('输入本地模型服务要求的密钥', 'Enter the key required by the model service')} className={fieldClass} />
          </label>
          {selectedProvider.id === 'custom' && (
            <label className="flex items-start gap-3 text-sm leading-relaxed text-[#4f4b43]">
              <input type="checkbox" checked={modelNeedsNoKey} onChange={event => {
                const checked = event.target.checked;
                setModelNeedsNoKey(checked);
                if (checked) update('modelApiKey', '');
              }} disabled={!secretInputReady} className="mt-1" />
              <span>{text('这个本地模型不需要密钥（例如默认配置的 Ollama）', 'This local model does not require a key (for example, the default Ollama configuration)')}</span>
            </label>
          )}
        </div>
        <button type="button" data-testid="settings-provider-seal-model-key" onClick={() => onSaveModel({ value: modelNeedsNoKey ? 'local-no-key' : drafts.modelApiKey })} disabled={!canSaveModel} className="mt-5 w-full border border-[#1a1a1a] bg-[#1a1a1a] px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? text('正在检查并保存……', 'Checking and saving…') : modelReady ? text('重新检查并保存模型', 'Check and save model again') : text('检查并保存模型', 'Check and save model')}
        </button>
        {!sealReady && canSaveModel && (
          <p className="mt-2 text-sm text-[#75631d]">{text('点击后会重新确认本地密钥存储状态；如果本地身份已经失效，页面会显示处理方法。', 'This will recheck local key storage. If local authentication has expired, the page will show what to do.')}</p>
        )}
      </section>

      <details className="border border-[#d1d0c9] bg-[#f5f4f0]">
        <summary className="cursor-pointer px-5 py-4 font-serif text-xl">{text('配置调查资料搜索（可选）', 'Configure research search (optional)')}</summary>
        <div className="border-t border-[#d1d0c9] p-5">
          <p className="text-sm leading-relaxed text-[#5f5a50]">{text('调查工作需要从外部资料服务获取信息时再配置。项目内容和保存的证据仍由本地项目管理。', 'Configure this when research needs information from an external source service. Project content and saved evidence remain under local project control.')}</p>
          <div className="mt-4 grid gap-4">
            <label className="text-sm text-[#4f4b43]">{text('搜索服务地址', 'Search service address')}
              <input data-testid="settings-provider-search-endpoint-input" name="local-search-service-address" autoComplete="off" value={drafts.searchEndpoint || ''} onChange={event => update('searchEndpoint', event.target.value)} disabled={!secretInputReady} placeholder={text('输入搜索服务地址', 'Enter the search service address')} className={fieldClass} />
            </label>
            <label className="text-sm text-[#4f4b43]">{text('搜索服务密钥', 'Search service key')}
              <input data-testid="settings-provider-search-key-input" name="local-search-api-key" type="password" autoComplete="new-password" value={drafts.searchApiKey || ''} onChange={event => update('searchApiKey', event.target.value)} disabled={!secretInputReady} placeholder={text('输入搜索服务密钥', 'Enter the search service key')} className={fieldClass} />
            </label>
          </div>
          <button type="button" data-testid="settings-provider-seal-search-key" onClick={onSaveSearch} disabled={!canSaveSearch} className="mt-5 w-full border border-[#1a1a1a] px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? text('正在检查并保存……', 'Checking and saving…') : text('检查并保存搜索设置', 'Check and save search settings')}
          </button>
        </div>
      </details>

      {(drafts.lastReceipt || drafts.error) && (
        <div data-testid="settings-provider-seal-receipt" className={`border px-4 py-3 text-sm leading-relaxed ${drafts.error ? 'border-red-800 bg-red-50 text-red-800' : 'border-[#59684b] bg-[#eef5df] text-[#3f5136]'}`}>
          {drafts.error ? modelSettingsErrorMessage(drafts.error, activeLanguage) : <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} />{text('设置已经通过检查并保存在本机。', 'Settings passed the check and were saved locally.')}</span>}
        </div>
      )}

      <details className="border border-[#d1d0c9] bg-[#f5f4f0]">
        <summary className="cursor-pointer px-5 py-3 font-mono text-xs tracking-[0.12em]">{text('查看技术诊断信息', 'View technical diagnostics')}</summary>
        <div className="space-y-2 border-t border-[#d1d0c9] p-4 font-mono text-xs text-[#5f5a50]">
          <div>{text('本地服务', 'Local service')}：{targetLabel || text('尚未设置', 'Not set')}</div>
          <div>{text('模型状态', 'Model status')}：{statusLabel(providerRuntimeStatus.modelProvider, activeLanguage)}</div>
          <div>{text('调查资料搜索', 'Research search')}：{statusLabel(providerRuntimeStatus.searchProvider, activeLanguage)}</div>
          <div>{text('本地密钥存储', 'Local key storage')}：{sealReady ? text('可用', 'Ready') : text('尚未准备好', 'Not ready')}</div>
        </div>
      </details>
    </div>
  );
}
