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
  return [
    {
      id: 'service',
      title: text('检查本地服务', 'Check local service'),
      detail: serviceChecked
        ? (serviceReady ? text('本地服务可以使用', 'Local service is ready') : text('本地服务需要恢复', 'Local service needs attention'))
        : text('正在检查这台电脑', 'Checking this computer'),
      status: serviceComplete ? 'complete' : 'current',
    },
    {
      id: 'account',
      title: authenticated ? text('本地账户已登录', 'Local account signed in') : text('登录本地账户', 'Sign in to local account'),
      detail: authenticated ? text('账户和权限保存在本机', 'Account and permissions stay on this computer') : text('用于保护本机项目和设置', 'Protects local projects and settings'),
      status: authenticated ? 'complete' : authCurrent ? 'current' : 'waiting',
    },
    {
      id: 'model',
      title: modelReady ? text('模型已经配置', 'Model configured') : text('配置本地模型', 'Configure local model'),
      detail: modelReady ? text('AI工作能力已经就绪', 'AI work is ready') : text('可稍后配置，不影响查看本地项目', 'You can configure this later and still view local projects'),
      status: modelReady ? 'complete' : modelCurrent ? 'current' : 'waiting',
    },
    {
      id: 'project',
      title: projectCount > 0 ? text('项目已经就绪', 'Project ready') : text('创建第一个项目', 'Create your first project'),
      detail: projectCount > 0
        ? text(`已有 ${projectCount} 个本地项目`, `${projectCount} local project${projectCount === 1 ? '' : 's'}`)
        : text('确定目标、选择团队并开始工作', 'Set a goal, choose a team, and start working'),
      status: projectCount > 0 ? 'complete' : projectCurrent ? 'current' : 'waiting',
    },
  ];
}
