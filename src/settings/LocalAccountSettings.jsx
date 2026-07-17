import { RefreshCw } from 'lucide-react';

const localAuthErrorMessage = (error) => {
  const message = String(error || '');
  if (/Password must be at least 4 characters/i.test(message)) return '密码至少需要 4 个字符。';
  if (/Password must contain at least one letter/i.test(message)) return '密码需要包含至少一个字母。';
  if (/Password must contain at least one number/i.test(message)) return '密码需要包含至少一个数字。';
  if (/Username must be 3-64 characters/i.test(message)) return '用户名需要 3 至 64 个字符，只能使用字母、数字、点、下划线或连字符。';
  return ({
    'local-auth-invalid-credentials': '用户名或密码不正确。',
    'local-auth-current-password-invalid': '当前密码不正确。',
    'local-auth-login-locked': '尝试次数过多，账户已暂时锁定。',
    'local-auth-admin-required': '只有安全管理员可以执行此操作。',
    'local-auth-required': '请先登录本地账户。',
    'local-auth-user-disabled': '此账户已停用。',
    'local-auth-session-expired': '登录已过期，请重新登录。',
    'local-auth-session-revoked': '登录已失效，请重新登录。',
    'local-auth-security-audit-unavailable': '本地安全记录暂时不可用，请稍后重试。',
    'local-auth-security-audit-write-failed': '本地安全记录保存失败，本次操作未完成。',
    'local-auth-security-audit-write-not-confirmed': '本地安全记录尚未确认，本次操作未完成。',
  }[message] || '本地账户操作失败。请刷新账户状态后重试。');
};

const formatLocalSessionExpiry = (value) => {
  if (!value) return '按本地安全规则';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '按本地安全规则';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export default function LocalAccountSettings({
  labelClass,
  SmallButton,
  backendUrlConfigured,
  onOpenDeployment,
  localAuthStatus,
  syncLocalAuthStatus,
  localAuthSession,
  localAuthDraft,
  setLocalAuthDraft,
  submitLocalAuth,
  localAuthPasswordDraft,
  setLocalAuthPasswordDraft,
  changeLocalAuthPassword,
  localAuthUsers,
  syncLocalAuthUsers,
  localAuthUserDraft,
  setLocalAuthUserDraft,
  createLocalAuthUser,
  disableLocalAuthUser,
  activeProject,
  localProjectMembership,
  syncLocalProjectMembership,
  setLocalProjectUserAccess,
}) {
  const localAuthSessionForCurrentBackend = localAuthSession;
  const setSettingsTab = onOpenDeployment;
  return (
    <div data-testid="settings-local-auth" className="border border-[#d1d0c9] bg-[#f5f4f0] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className={labelClass}>本地账户</div>
          <h3 className="mt-2 font-serif text-2xl leading-none text-[#1a1a1a]">这台电脑使用独立账户</h3>
          <p className="mt-3 font-mono text-[11px] leading-relaxed text-[#5f5a50]">
            账户、密码和登录状态只保存在这台电脑。登录信息只用于当前保存的本地服务地址，不会发送给其他服务。
          </p>
        </div>
        <SmallButton onClick={() => syncLocalAuthStatus()} disabled={localAuthStatus.loading || !backendUrlConfigured}>
          <RefreshCw size={12} className="inline-block mr-2" />刷新账户状态
        </SmallButton>
      </div>
    
      {!backendUrlConfigured ? (
        <div data-testid="settings-local-auth-backend-required" className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-[#d9b56c] bg-[#fbf7df] px-3 py-3 font-mono text-[11px] text-[#75631d]">
          <span>请先保存本地服务地址，再配置账户。</span>
          <button type="button" data-testid="settings-local-auth-open-deployment" onClick={() => setSettingsTab('deployment')} className="border border-[#75631d] px-3 py-2 font-mono text-xs uppercase tracking-widest hover:bg-[#eadfbd]">
            配置本地服务
          </button>
        </div>
      ) : localAuthStatus.loading ? (
        <p data-testid="settings-local-auth-loading" className="mt-4 font-mono text-[11px] text-[#7d786b]">正在检查本地账户状态……</p>
      ) : localAuthStatus.available === false ? (
        <p data-testid="settings-local-auth-not-enabled" className="mt-4 font-mono text-[11px] leading-relaxed text-[#7d786b]">当前本地服务尚未启用账户保护。请使用项目自带的本地启动程序重新启动。</p>
      ) : localAuthSessionForCurrentBackend ? (
        <>
          <div data-testid="settings-local-auth-signed-in" className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-[#d1d0c9] bg-[#f8f6ee] p-3">
            <div>
              <div className="font-mono text-[11px] text-[#1a1a1a]">当前本地账户：{localAuthSessionForCurrentBackend.user?.displayName || localAuthSessionForCurrentBackend.user?.username || '本地用户'}</div>
              <div className="mt-1 font-mono text-xs tracking-[0.12em] text-[#5f5a50]">角色：{({ 'security-admin': '安全管理员', manager: '项目负责人', observer: '查看者' })[localAuthSessionForCurrentBackend.user?.role] || '查看者'} · 到期时间：{formatLocalSessionExpiry(localAuthSessionForCurrentBackend.expiresAt)}</div>
            </div>
            <button type="button" data-testid="settings-local-auth-logout" onClick={() => submitLocalAuth('logout')} disabled={localAuthDraft.pending} className="border border-[#1a1a1a] px-3 py-2 font-mono text-xs tracking-widest hover:bg-[#d1d0c9] disabled:cursor-not-allowed disabled:opacity-50">退出登录</button>
          </div>
          <form data-testid="settings-local-auth-password-form" className="mt-4 grid gap-2 border border-[#d1d0c9] bg-[#f8f6ee] p-4 md:grid-cols-4" onSubmit={changeLocalAuthPassword}>
            <input data-testid="settings-local-auth-current-password" type="password" value={localAuthPasswordDraft.currentPassword} onChange={(event) => setLocalAuthPasswordDraft(previous => ({ ...previous, currentPassword: event.target.value }))} autoComplete="current-password" placeholder="当前密码" aria-label="当前密码" className="min-w-0 border border-[#d1d0c9] bg-[#f5f4f0] px-3 py-2 font-mono text-[11px] text-[#1a1a1a] outline-none focus:border-[#1a1a1a]" />
            <input data-testid="settings-local-auth-new-password" type="password" value={localAuthPasswordDraft.newPassword} onChange={(event) => setLocalAuthPasswordDraft(previous => ({ ...previous, newPassword: event.target.value }))} autoComplete="new-password" placeholder="新密码" aria-label="新密码" className="min-w-0 border border-[#d1d0c9] bg-[#f5f4f0] px-3 py-2 font-mono text-[11px] text-[#1a1a1a] outline-none focus:border-[#1a1a1a]" />
            <input data-testid="settings-local-auth-confirm-password" type="password" value={localAuthPasswordDraft.confirmPassword} onChange={(event) => setLocalAuthPasswordDraft(previous => ({ ...previous, confirmPassword: event.target.value }))} autoComplete="new-password" placeholder="再次输入新密码" aria-label="再次输入新密码" className="min-w-0 border border-[#d1d0c9] bg-[#f5f4f0] px-3 py-2 font-mono text-[11px] text-[#1a1a1a] outline-none focus:border-[#1a1a1a]" />
            <button type="submit" data-testid="settings-local-auth-change-password" disabled={localAuthPasswordDraft.pending} className="border border-[#1a1a1a] bg-[#1a1a1a] px-3 py-2 font-mono text-xs tracking-widest text-[#f5f4f0] hover:bg-[#3b3933] disabled:cursor-not-allowed disabled:opacity-50">{localAuthPasswordDraft.pending ? '正在更新……' : '修改密码'}</button>
            {localAuthPasswordDraft.error && <p data-testid="settings-local-auth-password-error" className="font-mono text-[11px] text-[#8f1e18] md:col-span-4">{localAuthErrorMessage(localAuthPasswordDraft.error)}</p>}
          </form>
          {localAuthSessionForCurrentBackend.user?.role === 'security-admin' && (
            <div data-testid="settings-local-auth-users" className="mt-4 border border-[#d1d0c9] bg-[#f8f6ee] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className={labelClass}>本地用户</div>
                  <p className="mt-1 font-mono text-sm leading-relaxed text-[#5f5a50]">这里只显示账户的公开信息。新密码只发送一次给本地服务，不会在此页面显示或保存。</p>
                </div>
                <SmallButton onClick={() => syncLocalAuthUsers()} disabled={localAuthUsers.loading}>
                  <RefreshCw size={12} className="inline-block mr-2" />刷新用户
                </SmallButton>
              </div>
              <form className="mt-3 grid gap-2 md:grid-cols-4" onSubmit={createLocalAuthUser}>
                <input data-testid="settings-local-auth-create-username" value={localAuthUserDraft.username} onChange={(event) => setLocalAuthUserDraft(previous => ({ ...previous, username: event.target.value }))} autoComplete="username" placeholder="用户名" aria-label="新用户名称" className="min-w-0 border border-[#d1d0c9] bg-[#f5f4f0] px-3 py-2 font-mono text-[11px] text-[#1a1a1a] outline-none focus:border-[#1a1a1a]" />
                <input data-testid="settings-local-auth-create-password" type="password" value={localAuthUserDraft.password} onChange={(event) => setLocalAuthUserDraft(previous => ({ ...previous, password: event.target.value }))} autoComplete="new-password" placeholder="密码" aria-label="新用户密码" className="min-w-0 border border-[#d1d0c9] bg-[#f5f4f0] px-3 py-2 font-mono text-[11px] text-[#1a1a1a] outline-none focus:border-[#1a1a1a]" />
                <select data-testid="settings-local-auth-create-role" value={localAuthUserDraft.role} onChange={(event) => setLocalAuthUserDraft(previous => ({ ...previous, role: event.target.value }))} className="border border-[#d1d0c9] bg-[#f5f4f0] px-3 py-2 font-mono text-[11px] text-[#1a1a1a] outline-none focus:border-[#1a1a1a]">
                  <option value="manager">项目负责人</option>
                  <option value="observer">查看者</option>
                  <option value="security-admin">安全管理员</option>
                </select>
                <button type="submit" data-testid="settings-local-auth-create-user" disabled={localAuthUserDraft.pending} className="border border-[#1a1a1a] bg-[#1a1a1a] px-3 py-2 font-mono text-xs tracking-widest text-[#f5f4f0] hover:bg-[#3b3933] disabled:cursor-not-allowed disabled:opacity-50">{localAuthUserDraft.pending ? '正在创建……' : '创建用户'}</button>
              </form>
              {localAuthUsers.error && <p data-testid="settings-local-auth-users-error" className="mt-3 font-mono text-[11px] text-[#8f1e18]">{localAuthErrorMessage(localAuthUsers.error)}</p>}
              <div className="mt-3 grid gap-2">
                {localAuthUsers.rows.map((user) => (
                  <div key={user.id} data-testid={`settings-local-auth-user-${user.username}`} className="flex flex-wrap items-center justify-between gap-2 border border-[#d1d0c9] bg-[#f5f4f0] px-3 py-2 font-mono text-xs text-[#1a1a1a]">
                    <span>{user.displayName || user.username} <span className="text-[#7d786b]">@{user.username}</span></span>
                    <div className="flex items-center gap-3">
                      <span className="tracking-[0.12em] text-[#5f5a50]">{user.disabledAt ? '已停用' : ({ 'security-admin': '安全管理员', manager: '项目负责人', observer: '查看者' })[user.role] || user.role}</span>
                      {!user.disabledAt && <button type="button" data-testid={`settings-local-auth-disable-${user.username}`} onClick={() => disableLocalAuthUser(user)} disabled={localAuthUsers.pendingUserId === user.id} className="border border-[#8f1e18] px-2 py-1 font-mono text-xs tracking-widest text-[#8f1e18] hover:bg-[#f5dfdc] disabled:cursor-not-allowed disabled:opacity-50">{localAuthUsers.pendingUserId === user.id ? '正在停用……' : '停用'}</button>}
                    </div>
                  </div>
                ))}
                {!localAuthUsers.loading && !localAuthUsers.rows.length && <p className="font-mono text-xs text-[#5f5a50]">暂无本地用户。</p>}
              </div>
              <div data-testid="settings-local-project-membership" className="mt-4 border-t border-[#d1d0c9] pt-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className={labelClass}>当前项目权限</div>
                  <p className="mt-1 font-mono text-sm leading-relaxed text-[#5f5a50]">项目权限需要明确授予。在这里移除用户会撤销其本地项目权限，并保存变更记录。</p>
                  </div>
                  <SmallButton onClick={() => syncLocalProjectMembership()} disabled={!activeProject?.id || localProjectMembership.loading}>
                    <RefreshCw size={12} className="inline-block mr-2" />刷新权限
                  </SmallButton>
                </div>
                {!activeProject?.id ? (
                  <p data-testid="settings-local-project-membership-no-project" className="mt-3 font-mono text-xs text-[#5f5a50]">请先选择一个项目，再管理本地成员。</p>
                ) : localProjectMembership.loading ? (
                  <p className="mt-3 font-mono text-xs text-[#5f5a50]">正在读取“{activeProject.name || activeProject.id}”的权限……</p>
                ) : localProjectMembership.error ? (
                  <p data-testid="settings-local-project-membership-error" className="mt-3 font-mono text-xs text-[#8f1e18]">{localProjectMembership.error}</p>
                ) : (
                  <div className="mt-3 grid gap-2">
                    <div className="font-mono text-xs text-[#1a1a1a]">{activeProject.name || activeProject.id}</div>
                    {localAuthUsers.rows.map((user) => {
                      const roleField = {
                        'security-admin': 'securityAdminUserIds',
                        manager: 'managerUserIds',
                        observer: 'observerUserIds',
                      }[user.role];
                      const hasAccess = Boolean(roleField && localProjectMembership.policy?.[roleField]?.includes(user.id));
                      return (
                        <label key={`membership-${user.id}`} data-testid={`settings-local-project-member-${user.username}`} className="flex flex-wrap items-center justify-between gap-3 border border-[#d1d0c9] bg-[#f5f4f0] px-3 py-2 font-mono text-xs text-[#1a1a1a]">
                          <span>{user.displayName || user.username} <span className="text-[#7d786b]">@{user.username} · {user.role}</span></span>
                          <select value={hasAccess ? user.role : ''} onChange={(event) => setLocalProjectUserAccess(user, event.target.value)} disabled={localProjectMembership.pendingUserId === user.id} className="border border-[#d1d0c9] bg-[#f8f6ee] px-2 py-1 font-mono text-xs outline-none focus:border-[#1a1a1a]">
                            <option value="">无项目权限</option>
                            <option value={user.role}>授予{({ 'security-admin': '安全管理员', manager: '项目负责人', observer: '查看者' })[user.role] || user.role}权限</option>
                          </select>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <form data-testid="settings-local-auth-form" className="mt-4 grid gap-3 border border-[#d1d0c9] bg-[#f8f6ee] p-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); submitLocalAuth(localAuthStatus.bootstrapRequired ? 'bootstrap' : 'login'); }}>
          <label className="font-mono text-xs tracking-[0.12em] text-[#5f5a50]">用户名
            <input data-testid="settings-local-auth-username" value={localAuthDraft.username} onChange={(event) => setLocalAuthDraft(previous => ({ ...previous, username: event.target.value }))} autoComplete="username" className="mt-2 block w-full border border-[#d1d0c9] bg-[#f5f4f0] px-3 py-2 font-mono text-[11px] text-[#1a1a1a] outline-none focus:border-[#1a1a1a]" />
          </label>
          <label className="font-mono text-xs tracking-[0.12em] text-[#5f5a50]">密码
            <input data-testid="settings-local-auth-password" type="password" value={localAuthDraft.password} onChange={(event) => setLocalAuthDraft(previous => ({ ...previous, password: event.target.value }))} autoComplete={localAuthStatus.bootstrapRequired ? 'new-password' : 'current-password'} className="mt-2 block w-full border border-[#d1d0c9] bg-[#f5f4f0] px-3 py-2 font-mono text-[11px] text-[#1a1a1a] outline-none focus:border-[#1a1a1a]" />
          </label>
          {localAuthStatus.bootstrapRequired && (
            <label className="font-mono text-xs tracking-[0.12em] text-[#5f5a50]">显示名称（可选）
              <input data-testid="settings-local-auth-display-name" value={localAuthDraft.displayName} onChange={(event) => setLocalAuthDraft(previous => ({ ...previous, displayName: event.target.value }))} autoComplete="name" className="mt-2 block w-full border border-[#d1d0c9] bg-[#f5f4f0] px-3 py-2 font-mono text-[11px] text-[#1a1a1a] outline-none focus:border-[#1a1a1a]" />
            </label>
          )}
          <div className="flex items-end">
            <button type="submit" data-testid={localAuthStatus.bootstrapRequired ? 'settings-local-auth-bootstrap' : 'settings-local-auth-login'} disabled={localAuthDraft.pending} className="w-full border border-[#1a1a1a] bg-[#1a1a1a] px-3 py-2 font-mono text-xs uppercase tracking-widest text-[#f5f4f0] hover:bg-[#3b3933] disabled:cursor-not-allowed disabled:opacity-50">
              {localAuthDraft.pending ? '正在处理……' : localAuthStatus.bootstrapRequired ? '创建本地管理员' : '登录本地账户'}
            </button>
          </div>
        </form>
      )}
      {localAuthStatus.error === 'local-auth-login-locked' ? (
        <p data-testid="settings-local-auth-login-locked" className="mt-3 font-mono text-[11px] text-[#8f1e18]">此本地账户已暂时锁定。请在 {localAuthStatus.retryAt || '本地服务允许的时间'} 后重试。</p>
      ) : localAuthStatus.error ? (
        <p data-testid="settings-local-auth-error" className="mt-3 font-mono text-[11px] text-[#8f1e18]">{localAuthErrorMessage(localAuthStatus.error)}</p>
      ) : null}
    </div>
  );
}
