import { Component } from 'react';

export default class LocalUiErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Local UI render failed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#171411] px-5 py-8 text-[#efe2bd]">
        <section role="alert" className="w-full max-w-xl border border-[#7b6542] bg-[#251b13] p-6">
          <div className="font-mono text-xs tracking-[0.18em] text-[#d8c99f]">本地界面恢复</div>
          <h1 className="mt-3 font-serif text-4xl">界面没有正常加载</h1>
          <p className="mt-4 text-sm leading-relaxed text-[#d8c99f]">项目数据仍保存在本机。请重新加载界面；如果问题再次出现，可以在设置中下载诊断信息。</p>
          <button type="button" onClick={() => globalThis.location.reload()} className="mt-5 border border-[#efe2bd] bg-[#efe2bd] px-4 py-2.5 text-sm text-[#251b13]">重新加载界面</button>
          <details className="mt-5 border-t border-[#7b6542] pt-4">
            <summary className="cursor-pointer font-mono text-xs text-[#bcae86]">查看错误详情</summary>
            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-[#bcae86]">{String(this.state.error?.message || this.state.error || '未知错误')}</pre>
          </details>
        </section>
      </main>
    );
  }
}
