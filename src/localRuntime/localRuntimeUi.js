export function presentLocalRuntimeStatus(status = {}) {
  const failed = status?.schemaVersion === 'local-runtime-status/v1'
    && status?.backend?.status === 'failed';
  if (!failed) return { visible: false, title: '', message: '', actions: [] };
  return {
    visible: true,
    title: '本地服务未运行',
    message: '界面仍可查看，项目数据仍保留在本机。请重新检查；如果仍未恢复，请打开恢复设置。',
    failure: status.backend.failure || null,
    actions: [
      { id: 'retry', label: '重新检查' },
      { id: 'open-recovery', label: '打开恢复设置' },
    ],
  };
}
