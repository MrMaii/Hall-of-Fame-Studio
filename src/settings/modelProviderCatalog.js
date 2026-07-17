const model = (id, name, note = '') => Object.freeze({ id, name, note });

export const MODEL_PROVIDERS = Object.freeze([
  Object.freeze({
    id: 'openai', name: 'OpenAI', description: 'GPT 系列通用、推理和编码模型', logo: 'OpenAI', accent: '#10a37f',
    protocol: 'openai-chat-completions', baseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-5.2',
    models: Object.freeze([
      model('gpt-5.2', 'GPT-5.2', '综合能力'), model('gpt-5.1', 'GPT-5.1', '智能体与编码'),
      model('gpt-5', 'GPT-5', '复杂推理'), model('gpt-5-mini', 'GPT-5 mini', '速度与成本平衡'),
      model('gpt-4.1', 'GPT-4.1', '稳定通用'), model('gpt-4.1-mini', 'GPT-4.1 mini', '轻量任务'),
      model('gpt-4o-mini', 'GPT-4o mini', '高频轻量任务'),
    ]),
  }),
  Object.freeze({
    id: 'anthropic', aliases: Object.freeze(['claude']), name: 'Claude', description: 'Anthropic 的长文本、分析和编码模型', logo: 'Anthropic', accent: '#d97757',
    protocol: 'anthropic-messages', baseURL: 'https://api.anthropic.com/v1', defaultModel: 'claude-sonnet-4-6',
    models: Object.freeze([
      model('claude-opus-4-6', 'Claude Opus 4.6', '高难度任务'),
      model('claude-sonnet-4-6', 'Claude Sonnet 4.6', '推荐'),
      model('claude-haiku-4-5', 'Claude Haiku 4.5', '快速响应'),
    ]),
  }),
  Object.freeze({
    id: 'gemini', aliases: Object.freeze(['google']), name: 'Gemini', description: 'Google 的多模态与长上下文模型', logo: 'Gemini', accent: '#4285f4',
    protocol: 'gemini-generate-content', baseURL: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-3.5-flash',
    models: Object.freeze([
      model('gemini-3.5-flash', 'Gemini 3.5 Flash', '稳定版'),
      model('gemini-3.1-pro-preview', 'Gemini 3.1 Pro', '复杂任务预览版'),
      model('gemini-3-flash-preview', 'Gemini 3 Flash', '快速预览版'),
      model('gemini-2.5-flash', 'Gemini 2.5 Flash', '稳定通用'),
      model('gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite', '低成本'),
    ]),
  }),
  Object.freeze({
    id: 'stepfun', aliases: Object.freeze(['step']), name: '阶跃星辰', description: 'Step 系列推理、工具调用与视觉模型', logo: 'Stepfun', accent: '#6d5dfc',
    protocol: 'openai-chat-completions', baseURL: 'https://api.stepfun.com/v1', defaultModel: 'step-3.5-flash',
    models: Object.freeze([
      model('step-3.5-flash', 'Step 3.5 Flash', '推荐'), model('step-3.5-flash-2603', 'Step 3.5 Flash 2603', '固定版本'),
      model('step-3', 'Step 3', '视觉与复杂推理'), model('step-2-mini', 'Step 2 Mini', '工具调用'),
      model('step-2-16k', 'Step 2 16K', '兼容模型'), model('step-1o-turbo-vision', 'Step 1o Turbo Vision', '视觉理解'),
    ]),
  }),
  Object.freeze({
    id: 'deepseek', name: 'DeepSeek', description: 'DeepSeek 通用与深度推理模型', logo: 'DeepSeek', accent: '#4d6bfe',
    protocol: 'openai-chat-completions', baseURL: 'https://api.deepseek.com', defaultModel: 'deepseek-v4-flash',
    models: Object.freeze([
      model('deepseek-v4-pro', 'DeepSeek V4 Pro', '高性能'), model('deepseek-v4-flash', 'DeepSeek V4 Flash', '推荐'),
      model('deepseek-reasoner', 'DeepSeek Reasoner', '兼容名称，将于 2026-07-24 下线'),
      model('deepseek-chat', 'DeepSeek Chat', '兼容名称，将于 2026-07-24 下线'),
    ]),
  }),
  Object.freeze({
    id: 'qwen', aliases: Object.freeze(['dashscope', 'alibaba']), name: '千问', description: '阿里云百炼中的 Qwen 文本与编码模型', logo: 'Qwen', accent: '#615ced',
    protocol: 'openai-chat-completions', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen3.7-plus',
    models: Object.freeze([
      model('qwen3.7-max', 'Qwen 3.7 Max', '高性能'), model('qwen3.7-plus', 'Qwen 3.7 Plus', '推荐'),
      model('qwen3.6-flash', 'Qwen 3.6 Flash', '快速响应'), model('qwen3.5-27b', 'Qwen 3.5 27B', '通用模型'),
      model('qwen3.5-9b', 'Qwen 3.5 9B', '轻量模型'), model('qwen3-32b', 'Qwen 3 32B', '兼容模型'),
    ]),
  }),
  Object.freeze({
    id: 'custom', name: '本机或自定义', description: 'Ollama、LM Studio 或其他 OpenAI 兼容接口', logo: 'Cpu', accent: '#5f5a50',
    protocol: 'openai-chat-completions', baseURL: 'http://127.0.0.1:11434/v1', defaultModel: 'llama3.2',
    models: Object.freeze([
      model('llama3.2', 'Llama 3.2', 'Ollama 默认示例'),
      model('__custom__', '填写自定义模型名称', '适用于本机或新增模型'),
    ]),
  }),
]);

export function findModelProvider(providerId = '') {
  const normalized = String(providerId || '').trim().toLowerCase();
  return MODEL_PROVIDERS.find((provider) => provider.id === normalized || provider.aliases?.includes(normalized))
    || MODEL_PROVIDERS[MODEL_PROVIDERS.length - 1];
}

export function modelsForProvider(providerId = '') {
  return findModelProvider(providerId).models.map((entry) => ({ ...entry }));
}
