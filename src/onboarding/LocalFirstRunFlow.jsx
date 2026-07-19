import { buildLocalFirstRunSteps } from './localFirstRunModel.js';
import { Check, CheckCircle2 } from 'lucide-react';

const firstRunAuthErrorMessage = (error, language = 'zh') => {
  const text = (chinese, english) => language === 'en' ? english : chinese;
  const message = String(error || '');
  if (/Password must be at least 4 characters/i.test(message)) return text('密码至少需要 4 个字符。', 'Password must be at least 4 characters.');
  if (/Password must contain at least one letter/i.test(message)) return text('密码需要包含至少一个字母。', 'Password must contain at least one letter.');
  if (/Password must contain at least one number/i.test(message)) return text('密码需要包含至少一个数字。', 'Password must contain at least one number.');
  if (/Username must be 3-64 characters/i.test(message)) return text('用户名需要 3 至 64 个字符，只能使用字母、数字、点、下划线或连字符。', 'Username must be 3 to 64 characters and use only letters, numbers, dots, underscores, or hyphens.');
  if (message === 'local-auth-invalid-credentials') return text('用户名或密码不正确。', 'The username or password is incorrect.');
  if (message === 'local-auth-login-locked') return text('尝试次数过多，账户已暂时锁定。', 'Too many attempts. This account is temporarily locked.');
  return text('本地账户操作没有完成。请检查填写内容后重试。', 'The local account action did not finish. Check the form and try again.');
};

export default function LocalFirstRunFlow({
  serviceChecked,
  serviceReady,
  authenticated,
  modelReady,
  projectCount,
  authStatus = {},
  authDraft = {},
  notice = '',
  activeLanguage = 'zh',
  onAuthDraftChange,
  onSubmitAuth,
  onOpenModelSettings,
  onStartProject,
} = {}) {
  const text = (chinese, english) => activeLanguage === 'en' ? english : chinese;
  const steps = buildLocalFirstRunSteps({ serviceChecked, serviceReady, authenticated, modelReady, projectCount, language: activeLanguage });
  const needsAccount = !authenticated;
  const authAction = authStatus.bootstrapRequired ? 'bootstrap' : 'login';
  const authButtonLabel = authStatus.bootstrapRequired ? text('创建本地管理员', 'Create local administrator') : text('登录并继续', 'Sign in and continue');
  const password = String(authDraft.password || '');
  const passwordRules = [
    { id: 'length', label: text('至少 4 个字符', 'At least 4 characters'), satisfied: password.length >= 4 },
    { id: 'letter', label: text('包含字母', 'Contains a letter'), satisfied: /[A-Za-z]/.test(password) },
    { id: 'number', label: text('包含数字', 'Contains a number'), satisfied: /[0-9]/.test(password) },
  ];
  const passwordValid = passwordRules.every(rule => rule.satisfied);
  const submitAuth = (event) => {
    event.preventDefault();
    onSubmitAuth?.(authAction);
  };

  return (
    <div data-testid="local-first-run" className="h-full overflow-y-auto bg-[#f5f4f0] px-6 py-8 text-[#1a1a1a] md:px-12 md:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <div className="border-b border-[#c9c5ba] pb-7">
          <div className="font-mono text-xs uppercase tracking-[0.24em] text-[#8f1e18]">{text('首次使用', 'First use')}</div>
          <h1 className="mt-3 font-serif text-4xl leading-tight md:text-6xl">{text('开始使用名人堂工作室', 'Get started with Hall of Fame Studio')}</h1>
          <p className="mt-4 max-w-2xl font-serif text-lg leading-relaxed text-[#5c574d]">
            {text('数据只保存在这台电脑。先完成本地账户登录，再配置模型并创建项目。', 'Data stays on this computer. Sign in to a local account, configure a model, and create a project.')}
          </p>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.id} className={`border p-4 ${step.status === 'current' ? 'border-[#8f1e18] bg-[#fff8e7]' : step.status === 'complete' ? 'border-[#59684b] bg-[#edf4e9]' : 'border-[#d1d0c9] bg-white'}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs uppercase tracking-widest">{text('步骤', 'Step')} {index + 1}</span>
                <span className="font-mono text-xs">{step.status === 'complete' ? text('已完成', 'Complete') : step.status === 'current' ? text('当前', 'Current') : text('稍后', 'Later')}</span>
              </div>
              <div className="mt-4 font-serif text-xl">{step.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-[#6b665c]">{step.detail}</p>
            </div>
          ))}
        </div>

        <section className="mt-7 border border-[#251b13] bg-white p-6 shadow-[8px_8px_0_rgba(37,27,19,0.08)] md:p-8">
          {!serviceChecked && (
            <div role="status">
              <h2 className="font-serif text-3xl">{text('正在检查本地服务', 'Checking local service')}</h2>
              <p className="mt-3 text-[#5c574d]">{text('检查完成后会自动进入下一步。', 'The next step will open automatically when the check finishes.')}</p>
            </div>
          )}

          {serviceChecked && !serviceReady && (
            <div role="alert">
              <h2 className="font-serif text-3xl">{text('本地服务需要恢复', 'Local service needs attention')}</h2>
              <p className="mt-3 text-[#5c574d]">{text('项目数据仍保存在本机。请重新启动应用，然后再次检查。', 'Project data remains on this computer. Restart the application and check again.')}</p>
            </div>
          )}

          {serviceReady && needsAccount && (
            <form data-testid="first-run-local-auth" onSubmit={submitAuth}>
              <h2 className="font-serif text-3xl">{authStatus.bootstrapRequired ? text('创建第一个本地账户', 'Create the first local account') : text('登录本地账户', 'Sign in to local account')}</h2>
              <p className="mt-2 text-[#5c574d]">{text('账户只用于这台电脑，不会上传到网络。', 'This account is used only on this computer and is not uploaded.')}</p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium">
                  {text('用户名', 'Username')}
                  <input data-testid="first-run-username" autoComplete="username" value={authDraft.username || ''} onChange={(event) => onAuthDraftChange?.('username', event.target.value)} className="mt-2 block w-full border border-[#9b968c] bg-[#f8f6ee] px-3 py-3 text-base outline-none focus:border-[#8f1e18]" />
                </label>
                <label className="text-sm font-medium">
                  {text('密码', 'Password')}
                  <input data-testid="first-run-password" type="password" autoComplete={authStatus.bootstrapRequired ? 'new-password' : 'current-password'} value={authDraft.password || ''} onChange={(event) => onAuthDraftChange?.('password', event.target.value)} className="mt-2 block w-full border border-[#9b968c] bg-[#f8f6ee] px-3 py-3 text-base outline-none focus:border-[#8f1e18]" />
                  {authStatus.bootstrapRequired && (
                    <div className="relative mt-3 overflow-hidden font-normal" aria-live="polite">
                      <div
                        data-testid="first-run-password-rules"
                        aria-hidden={passwordValid}
                        className={`grid gap-1.5 transition-all duration-300 ease-out ${passwordValid ? 'pointer-events-none max-h-0 -translate-y-2 opacity-0' : 'max-h-24 translate-y-0 opacity-100'}`}
                      >
                        {passwordRules.map(rule => (
                          <span
                            key={rule.id}
                            data-testid={`first-run-password-rule-${rule.id}`}
                            data-satisfied={String(rule.satisfied)}
                            className={`inline-flex items-center gap-2 text-sm transition-colors duration-200 ${rule.satisfied ? 'text-[#3f6538]' : 'text-[#756f64]'}`}
                          >
                            <span className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all duration-200 ${rule.satisfied ? 'scale-100 border-[#4f7a45] bg-[#4f7a45] text-white' : 'scale-90 border-[#aaa59a] bg-transparent text-transparent'}`}>
                              <Check size={11} strokeWidth={3} />
                            </span>
                            {rule.label}
                          </span>
                        ))}
                      </div>
                      <div
                        data-testid="first-run-password-valid"
                        aria-hidden={!passwordValid}
                        className={`flex items-center gap-2 overflow-hidden text-sm font-medium text-[#3f6538] transition-all duration-300 ease-out ${passwordValid ? 'max-h-10 translate-y-0 opacity-100 delay-150' : 'pointer-events-none max-h-0 translate-y-2 opacity-0'}`}
                      >
                        <CheckCircle2 className={passwordValid ? 'password-valid-check' : ''} size={20} strokeWidth={2.4} />
                        {text('密码符合要求', 'Password meets the requirements')}
                      </div>
                    </div>
                  )}
                </label>
                {authStatus.bootstrapRequired && (
                  <label className="text-sm font-medium md:col-span-2">
                    {text('显示名称（可选）', 'Display name (optional)')}
                    <input data-testid="first-run-display-name" autoComplete="name" value={authDraft.displayName || ''} onChange={(event) => onAuthDraftChange?.('displayName', event.target.value)} className="mt-2 block w-full border border-[#9b968c] bg-[#f8f6ee] px-3 py-3 text-base outline-none focus:border-[#8f1e18]" />
                  </label>
                )}
              </div>
              {notice && <p data-testid="first-run-auth-required-notice" role="status" className="mt-4 border border-[#b9a55f] bg-[#fbf7df] px-3 py-2 text-sm text-[#75631d]">{notice}</p>}
              {authStatus.error && <p data-testid="first-run-auth-error" role="alert" className="mt-4 border border-[#8f1e18] bg-red-50 px-3 py-2 text-sm text-[#8f1e18]">{authStatus.bootstrapRequired ? text('无法创建账户', 'Could not create account') : text('无法登录', 'Could not sign in')}{text('：', ': ')}{firstRunAuthErrorMessage(authStatus.error, activeLanguage)}</p>}
              <button data-testid="first-run-auth-submit" type="submit" disabled={authDraft.pending || !authDraft.username || !authDraft.password || (authStatus.bootstrapRequired && !passwordValid)} className="mt-6 border border-[#251b13] bg-[#251b13] px-6 py-3 text-white disabled:cursor-not-allowed disabled:opacity-45">
                {authDraft.pending ? text('正在处理…', 'Working…') : authButtonLabel}
              </button>
            </form>
          )}

          {authenticated && !modelReady && (
            <div>
              <h2 className="font-serif text-3xl">{text('配置本地模型', 'Configure local model')}</h2>
              <p className="mt-3 text-[#5c574d]">{text('选择这台电脑可访问的模型。项目和历史数据仍只保存在本机。', 'Choose a model available from this computer. Projects and history remain local.')}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" data-testid="first-run-open-model-settings" onClick={onOpenModelSettings} className="border border-[#251b13] bg-[#251b13] px-6 py-3 text-white">{text('打开模型设置', 'Open model settings')}</button>
                {projectCount === 0 && (
                  <div className="flex flex-col items-start gap-2">
                    <button data-testid="first-run-skip-model" type="button" onClick={onStartProject} className="border border-[#8f1e18] px-6 py-3 text-[#8f1e18]">{text('暂不配置，先准备项目信息', 'Configure later and prepare project details')}</button>
                    <p className="max-w-sm font-serif text-sm leading-relaxed text-[#75631d]">{text('开始 Agent 工作前仍需完成模型设置', 'Model setup is still required before Agent work can start')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {authenticated && modelReady && projectCount === 0 && (
            <div>
              <h2 className="font-serif text-3xl">{text('创建第一个项目', 'Create your first project')}</h2>
              <p className="mt-3 text-[#5c574d]">{text('输入目标、选择团队并确认第一项工作。', 'Enter a goal, choose a team, and confirm the first task.')}</p>
              <button data-testid="first-run-start-project" type="button" onClick={onStartProject} className="mt-6 border border-[#8f1e18] bg-[#8f1e18] px-6 py-3 text-white">{text('创建项目', 'Create project')}</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
