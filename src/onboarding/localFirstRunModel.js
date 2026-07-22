export function canCreateLocalProject({ authAvailable = null, hasSession = false } = {}) {
  return authAvailable !== true || hasSession;
}

export function resolveLocalStartupSurface({
  activeRoute = 'dashboard',
  authStatus = {},
  hasSession = false,
  catalogStatus = 'ready',
  workspaceHubRequested = false,
  modelReady = false,
  projectCount = 0,
} = {}) {
  if (activeRoute !== 'dashboard') return 'route';
  const authResolved = (
    authStatus.available !== null && authStatus.available !== undefined
  ) || Boolean(authStatus.error);
  if (!authResolved) return 'restoring';
  if (authStatus.available === true && !hasSession) return 'first-run';
  if (['idle', 'checking'].includes(catalogStatus)) return 'restoring';
  if (!workspaceHubRequested && (!modelReady || (catalogStatus === 'ready' && projectCount === 0))) return 'first-run';
  return 'dashboard';
}

export function localServiceRecoveryMessage({ configured = true, error = '', language = 'zh' } = {}) {
  const text = (chinese, english) => language === 'en' ? english : chinese;
  if (!configured) {
    return text(
      '尚未配置本地服务地址。请打开本地服务设置并填写地址。',
      'The local service address is not configured. Open local service settings and enter the address.'
    );
  }
  const detail = String(error || '');
  if (/timed?\s*out|timeout/i.test(detail)) {
    return text(
      '本地服务未能及时响应。请确认服务正在运行，然后重试。',
      'The local service did not respond in time. Check that it is running, then retry.'
    );
  }
  if (/fetch|network|connect|unreachable|failed to reach/i.test(detail)) {
    return text(
      '应用无法连接本地服务。请检查服务地址并确认服务正在运行，然后重试。',
      'The application could not reach the local service. Check its address and that it is running, then retry.'
    );
  }
  return text(
    '本地服务尚未就绪。请确认服务已启动，然后重新检查；也可以打开本地服务设置检查地址。',
    'The local service is not ready. Check that it is running and retry, or open local service settings to verify its address.'
  );
}

export function buildLocalFirstRunSteps({
  serviceChecked = false,
  serviceReady = false,
  authenticated = false,
  modelReady = false,
  projectCount = 0,
  language = 'zh',
} = {}) {
  const text = (chinese, english) => language === 'en' ? english : chinese;
  const serviceComplete = serviceChecked && serviceReady;
  const authCurrent = serviceComplete && !authenticated;
  const modelCurrent = authenticated && !modelReady;
  const projectCurrent = authenticated && modelReady && projectCount === 0;
  const waitForCheck = text('等待本地服务检查完成。', 'Wait until the local service check finishes.');
  const waitForService = text('请先恢复本地服务。', 'Restore the local service first.');
  const waitForAccount = text('请先登录本地账户。', 'Sign in to the local account first.');
  return [
    {
      id: 'service',
      title: text('检查本地服务', 'Check local service'),
      detail: serviceChecked
        ? (serviceReady ? text('本地服务可以使用', 'Local service is ready') : text('本地服务需要恢复', 'Local service needs attention'))
        : text('正在检查这台电脑', 'Checking this computer'),
      status: serviceComplete ? 'complete' : 'current',
      accessible: serviceChecked,
      lockedReason: serviceChecked ? '' : waitForCheck,
    },
    {
      id: 'account',
      title: authenticated ? text('本地账户已登录', 'Local account signed in') : text('登录本地账户', 'Sign in to local account'),
      detail: authenticated ? text('账户和权限保存在本机', 'Account and permissions stay on this computer') : text('用于保护本机项目和设置', 'Protects local projects and settings'),
      status: authenticated ? 'complete' : authCurrent ? 'current' : 'waiting',
      accessible: serviceComplete,
      lockedReason: serviceComplete ? '' : waitForService,
    },
    {
      id: 'model',
      title: modelReady ? text('模型已经配置', 'Model configured') : text('配置本地模型', 'Configure local model'),
      detail: modelReady ? text('AI工作能力已经就绪', 'AI work is ready') : text('可稍后配置，不影响查看本地项目', 'You can configure this later and still view local projects'),
      status: modelReady ? 'complete' : modelCurrent ? 'current' : 'waiting',
      accessible: authenticated,
      lockedReason: authenticated ? '' : waitForAccount,
    },
    {
      id: 'project',
      title: projectCount > 0 ? text('项目已经就绪', 'Project ready') : text('创建第一个项目', 'Create your first project'),
      detail: projectCount > 0
        ? text(`已有 ${projectCount} 个本地项目`, `${projectCount} local project${projectCount === 1 ? '' : 's'}`)
        : text('确定目标、选择团队并开始工作', 'Set a goal, choose a team, and start working'),
      status: projectCount > 0 ? 'complete' : projectCurrent ? 'current' : 'waiting',
      accessible: authenticated,
      lockedReason: authenticated ? '' : waitForAccount,
    },
  ];
}
