import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ArrowLeft,
  File,
  FileArchive,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Files,
  FolderTree,
  LoaderCircle,
  PanelLeft,
  Presentation,
  RefreshCw,
  Settings,
} from 'lucide-react';
import WorkspaceFilePane from '../workspace/WorkspaceFilePane.jsx';
import WorkspaceTree from '../workspace/WorkspaceTree.jsx';
import { isWorkspaceTextFile } from '../workspace/workspaceFileVisuals.js';
import { buildProjectAssetCatalog } from './workOutputSemantics.js';
import {
  createWorkspaceTreeState,
  workspaceParentPath,
  workspaceTreeReducer,
} from '../workspace/workspaceTreeState.js';

const rootNameFromPath = (workspacePath = '') => String(workspacePath || '').split(/[\\/]/).filter(Boolean).at(-1) || 'Workspace';
const joinWorkspacePath = (parentPath, name) => parentPath && parentPath !== '.' ? `${parentPath}/${name}` : name;
const validEntryName = name => Boolean(name && name !== '.' && name !== '..' && !/[\\/]/.test(name));
const assetFileIcons = {
  archive: FileArchive,
  code: FileCode2,
  document: FileText,
  image: FileImage,
  presentation: Presentation,
  spreadsheet: FileSpreadsheet,
};

function useModalDialogFocus(open, onClose, active = true) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const activeRef = useRef(active);
  onCloseRef.current = onClose;
  activeRef.current = active;

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
      if (!activeRef.current) return;
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
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
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

function WorkspaceActionDialog({ dialog, error, language, loading, onCancel, onSubmit, onValueChange }) {
  const { overlayRef, dialogRef } = useModalDialogFocus(Boolean(dialog), onCancel);
  if (!dialog) return null;
  const deleting = dialog.kind === 'delete';
  const title = deleting
    ? (language === 'zh' ? '确认删除' : 'Confirm delete')
    : dialog.kind === 'rename'
      ? (language === 'zh' ? '重命名' : 'Rename')
      : dialog.kind === 'create-folder'
        ? (language === 'zh' ? '新建文件夹' : 'New folder')
        : (language === 'zh' ? '新建文件' : 'New file');
  return (
    <div ref={overlayRef} className="workspace-dialog-backdrop" role="presentation">
      <form ref={dialogRef} tabIndex={-1} className="workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-dialog-title" aria-describedby={deleting ? 'workspace-dialog-description' : undefined} onSubmit={onSubmit}>
        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8f1e18]">Local workspace action</div>
        <h3 id="workspace-dialog-title" className="mt-2 font-serif text-2xl text-[#251b13]">{title}</h3>
        {deleting ? (
          <p id="workspace-dialog-description" className="mt-4 font-serif text-base leading-relaxed text-[#4b3e2c]">
            {language === 'zh' ? '这个操作会直接修改本地文件夹：' : 'This directly changes the local folder:'}
            <strong className="mt-2 block break-all font-mono text-xs text-[#8f1e18]">{dialog.entry.path}</strong>
          </p>
        ) : (
          <label className="mt-4 block">
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">{language === 'zh' ? '名称' : 'Name'}</span>
            <input
              value={dialog.value}
              onChange={event => onValueChange(event.currentTarget.value)}
              className="mt-2 w-full border-b-2 border-[#7b6542] bg-transparent px-1 py-2 font-serif text-lg outline-none focus:border-[#8f1e18]"
            />
          </label>
        )}
        {error && <div className="mt-3 font-mono text-[10px] text-[#8f1e18]" role="alert">{error}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={loading} className="workspace-dialog-button">{language === 'zh' ? '取消' : 'Cancel'}</button>
          <button type="submit" disabled={loading} className={`workspace-dialog-button is-primary ${deleting ? 'is-danger' : ''}`}>
            {loading && <LoaderCircle size={13} className="animate-spin" />}
            {deleting ? (language === 'zh' ? '删除本地内容' : 'Delete local item') : (language === 'zh' ? '确认' : 'Confirm')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ProjectDashboardWorkspaceDrawer({ view = {} }) {
  const {
    backendAvailable = false,
    language = 'zh',
    onOpenWorkspaceSettings,
    project,
    projectText = value => value,
    requestAgentBackend,
    workspacePath = '',
  } = view;
  const [state, dispatch] = useReducer(workspaceTreeReducer, null, () => createWorkspaceTreeState());
  const [activity, setActivity] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [dialogError, setDialogError] = useState('');
  const [dialogLoading, setDialogLoading] = useState(false);
  const [mobilePane, setMobilePane] = useState('tree');
  const [mirroredWorkspacePath, setMirroredWorkspacePath] = useState(workspacePath);
  const requestAgentBackendRef = useRef(requestAgentBackend);
  const expandedPathsRef = useRef([]);
  const mirroredWorkspacePathRef = useRef(workspacePath);
  const stateRef = useRef(state);
  const workspaceRevisionRef = useRef(0);
  const projectId = project?.id || '';
  const assetCatalog = useMemo(() => buildProjectAssetCatalog(project || {}, language), [language, project]);
  const endpoint = useCallback(action => `/projects/${encodeURIComponent(projectId)}/workspace/${action}`, [projectId]);

  stateRef.current = state;

  useEffect(() => {
    requestAgentBackendRef.current = requestAgentBackend;
  }, [requestAgentBackend]);

  useEffect(() => {
    mirroredWorkspacePathRef.current = workspacePath;
    setMirroredWorkspacePath(workspacePath);
  }, [workspacePath]);

  useEffect(() => {
    expandedPathsRef.current = state.expandedPaths;
  }, [state.expandedPaths]);

  const loadDirectory = useCallback(async (path) => {
    if (!projectId || !requestAgentBackendRef.current) return;
    dispatch({ type: 'directory-loading', path });
    try {
      const payload = await requestAgentBackendRef.current(endpoint('list'), {
        method: 'POST',
        body: { path, recursive: false },
        timeoutMs: 5000,
        priority: 'interactive',
      });
      workspaceRevisionRef.current = Math.max(workspaceRevisionRef.current, Number(payload.workspaceRevision) || 0);
      if (payload.workspacePath && payload.workspacePath !== mirroredWorkspacePathRef.current) {
        mirroredWorkspacePathRef.current = payload.workspacePath;
        setMirroredWorkspacePath(payload.workspacePath);
        dispatch({
          type: 'root-relocated',
          name: rootNameFromPath(payload.workspacePath),
          updatedAt: new Date().toISOString(),
        });
      }
      dispatch({ type: 'directory-loaded', path, entries: payload.files || [] });
    } catch (error) {
      dispatch({ type: 'error', path, error: error.message || String(error) });
    }
  }, [endpoint, projectId]);

  useEffect(() => {
    if (!workspacePath || !backendAvailable) return;
    const root = {
      path: '.',
      name: rootNameFromPath(workspacePath),
      type: 'directory',
      size: 0,
      updatedAt: project?.localRuntime?.workspaceBoundAt || null,
    };
    dispatch({ type: 'reset', root });
    workspaceRevisionRef.current = 0;
    setActivity(null);
    setDialog(null);
    setMobilePane('tree');
    loadDirectory('.');
  }, [backendAvailable, loadDirectory, project?.localRuntime?.workspaceBoundAt, workspacePath]);

  useEffect(() => {
    if (!workspacePath || !backendAvailable) return undefined;
    let cancelled = false;
    const watchController = new AbortController();
    const refreshFromDisk = async () => {
      await Promise.all(expandedPathsRef.current.map(path => loadDirectory(path)));
      const editorAtChange = stateRef.current.editor;
      if (!editorAtChange.path || !requestAgentBackendRef.current) return;
      try {
        const payload = await requestAgentBackendRef.current(endpoint('read'), {
          method: 'POST',
          body: { path: editorAtChange.path },
          timeoutMs: 5000,
          priority: 'background',
        });
        if (cancelled) return;
        const currentEditor = stateRef.current.editor;
        if (currentEditor.path !== editorAtChange.path) return;
        if (currentEditor.dirty) {
          if (payload.file?.updatedAt && payload.file.updatedAt !== currentEditor.updatedAt) {
            dispatch({ type: 'save-conflict', currentUpdatedAt: payload.file.updatedAt });
          }
          return;
        }
        dispatch({ type: 'file-opened', file: payload.file, content: payload.content || '' });
      } catch {
        // The directory refresh is authoritative and clears a selected file that was deleted locally.
      }
    };
    const watchWorkspace = async () => {
      while (!cancelled) {
        try {
          const payload = await requestAgentBackendRef.current(endpoint(`watch?since=${workspaceRevisionRef.current}&timeoutMs=25000`), {
            timeoutMs: 30000,
            priority: 'background',
            signal: watchController.signal,
          });
          if (cancelled) return;
          workspaceRevisionRef.current = Math.max(workspaceRevisionRef.current, Number(payload.revision) || 0);
          if (payload.workspacePath && payload.workspacePath !== mirroredWorkspacePathRef.current) {
            mirroredWorkspacePathRef.current = payload.workspacePath;
            setMirroredWorkspacePath(payload.workspacePath);
            dispatch({
              type: 'root-relocated',
              name: rootNameFromPath(payload.workspacePath),
              updatedAt: new Date().toISOString(),
            });
          }
          if (payload.changed) await refreshFromDisk();
        } catch {
          if (!cancelled) await new Promise(resolveRetry => window.setTimeout(resolveRetry, 500));
        }
      }
    };
    watchWorkspace();
    return () => {
      cancelled = true;
      watchController.abort();
    };
  }, [backendAvailable, endpoint, loadDirectory, workspacePath]);

  const selectedEntry = state.entriesByPath[state.selectedPath] || state.root;
  const selectedChildren = useMemo(() => (
    (state.childPathsByDirectory[selectedEntry?.path] || []).map(path => state.entriesByPath[path]).filter(Boolean)
  ), [selectedEntry?.path, state.childPathsByDirectory, state.entriesByPath]);

  const handleToggle = async (entry) => {
    if (entry.type !== 'directory') return;
    const expanded = state.expandedPaths.includes(entry.path);
    dispatch({ type: 'toggle-directory', path: entry.path });
    if (!expanded && !Object.prototype.hasOwnProperty.call(state.childPathsByDirectory, entry.path)) {
      await loadDirectory(entry.path);
    }
  };

  const handleSelect = (entry) => {
    dispatch({ type: 'select-entry', path: entry.path });
    setMobilePane('file');
  };

  const handleOpenFile = async (entry, { ignoreDirty = false } = {}) => {
    if (!entry || entry.type !== 'file') return;
    if (!ignoreDirty && state.editor.dirty && state.editor.path !== entry.path) {
      setActivity({ tone: 'error', message: language === 'zh' ? '请先保存当前文件，再打开其他文件。' : 'Save the current file before opening another.' });
      return;
    }
    dispatch({ type: 'select-entry', path: entry.path });
    setMobilePane('file');
    if (!isWorkspaceTextFile(entry)) return;
    setActivity({ tone: 'loading', message: language === 'zh' ? '正在读取本地文件…' : 'Reading local file…' });
    try {
      const payload = await requestAgentBackend(endpoint('read'), {
        method: 'POST', body: { path: entry.path }, timeoutMs: 5000, priority: 'interactive',
      });
      dispatch({ type: 'file-opened', file: payload.file || entry, content: payload.content || '' });
      setActivity(null);
    } catch (error) {
      dispatch({ type: 'error', error: error.message || String(error) });
      setActivity({ tone: 'error', message: error.message || String(error) });
    }
  };

  const handleOpenEntry = async (entry) => {
    if (entry.type === 'directory') {
      dispatch({ type: 'select-entry', path: entry.path });
      setMobilePane('file');
      if (!state.expandedPaths.includes(entry.path)) await handleToggle(entry);
      return;
    }
    await handleOpenFile(entry);
  };

  const refreshSelection = async () => {
    const path = selectedEntry?.type === 'directory' ? selectedEntry.path : workspaceParentPath(selectedEntry?.path) || '.';
    await loadDirectory(path);
    if (selectedEntry?.type === 'file' && isWorkspaceTextFile(selectedEntry)) await handleOpenFile(selectedEntry, { ignoreDirty: true });
  };

  const retryFailedOperation = async () => {
    if (state.errorPath) {
      await loadDirectory(state.errorPath);
      return;
    }
    await refreshSelection();
  };

  const saveFile = useCallback(async () => {
    if (!state.editor.path || !state.editor.dirty) return;
    setActivity({ tone: 'saving', message: language === 'zh' ? '正在写入本地文件…' : 'Saving local file…' });
    try {
      const payload = await requestAgentBackend(endpoint('write'), {
        method: 'POST',
        body: {
          path: state.editor.path,
          content: state.editor.content,
          expectedUpdatedAt: state.editor.updatedAt,
        },
        timeoutMs: 5000,
        priority: 'interactive',
      });
      dispatch({ type: 'save-succeeded', file: payload.file });
      setActivity({ tone: 'saved', message: language === 'zh' ? '已保存到本地 Workspace' : 'Saved to local Workspace' });
    } catch (error) {
      if (error.status === 409 || String(error.message).includes('workspace-file-conflict')) {
        const currentUpdatedAt = String(error.message).replace(/^workspace-file-conflict:/, '') || null;
        dispatch({ type: 'save-conflict', currentUpdatedAt });
        setActivity({ tone: 'conflict', message: language === 'zh' ? '文件已被 Agent 更新' : 'An Agent updated this file' });
      } else {
        setActivity({ tone: 'error', message: error.message || String(error) });
      }
    }
  }, [endpoint, language, requestAgentBackend, state.editor]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveFile();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveFile]);

  const selectedDirectoryPath = selectedEntry?.type === 'directory'
    ? selectedEntry.path
    : workspaceParentPath(selectedEntry?.path) || '.';
  const beginCreateFile = () => { setDialogError(''); setDialog({ kind: 'create-file', parentPath: selectedDirectoryPath, value: 'untitled.md' }); };
  const beginCreateFolder = () => { setDialogError(''); setDialog({ kind: 'create-folder', parentPath: selectedDirectoryPath, value: language === 'zh' ? '新文件夹' : 'New folder' }); };
  const beginRename = (entry) => { setDialogError(''); setDialog({ kind: 'rename', entry, value: entry.name }); };
  const beginDelete = (entry) => { setDialogError(''); setDialog({ kind: 'delete', entry, value: '' }); };

  const submitDialog = async (event) => {
    event.preventDefault();
    if (!dialog) return;
    if (dialog.kind !== 'delete' && !validEntryName(dialog.value.trim())) {
      setDialogError(language === 'zh' ? '名称不能为空，也不能包含 / 或 \\。' : 'Name cannot be empty or contain / or \\.');
      return;
    }
    setDialogLoading(true);
    setDialogError('');
    try {
      if (dialog.kind === 'create-folder') {
        await requestAgentBackend(endpoint('mkdir'), { method: 'POST', body: { path: joinWorkspacePath(dialog.parentPath, dialog.value.trim()) }, timeoutMs: 5000, priority: 'interactive' });
        await loadDirectory(dialog.parentPath);
      } else if (dialog.kind === 'create-file') {
        const path = joinWorkspacePath(dialog.parentPath, dialog.value.trim());
        const payload = await requestAgentBackend(endpoint('write'), { method: 'POST', body: { path, content: '' }, timeoutMs: 5000, priority: 'interactive' });
        await loadDirectory(dialog.parentPath);
        await handleOpenFile(payload.file, { ignoreDirty: true });
      } else if (dialog.kind === 'rename') {
        const parent = workspaceParentPath(dialog.entry.path) || '.';
        const toPath = joinWorkspacePath(parent, dialog.value.trim());
        const payload = await requestAgentBackend(endpoint('move'), { method: 'POST', body: { fromPath: dialog.entry.path, toPath }, timeoutMs: 5000, priority: 'interactive' });
        dispatch({ type: 'entry-moved', fromPath: dialog.entry.path, entry: payload.entry });
        await loadDirectory(parent);
      } else if (dialog.kind === 'delete') {
        const parent = workspaceParentPath(dialog.entry.path) || '.';
        await requestAgentBackend(endpoint('delete'), { method: 'POST', body: { path: dialog.entry.path, recursive: dialog.entry.type === 'directory' }, timeoutMs: 5000, priority: 'interactive' });
        dispatch({ type: 'entry-removed', path: dialog.entry.path });
        await loadDirectory(parent);
      }
      setDialog(null);
      setActivity({ tone: 'saved', message: language === 'zh' ? '本地 Workspace 已更新' : 'Local Workspace updated' });
    } catch (error) {
      setDialogError(error.message || String(error));
    } finally {
      setDialogLoading(false);
    }
  };

  return (
    <section data-testid="project-dashboard-workspace-section" aria-labelledby="workspace-section-title" className="workspace-section">
        <header className="workspace-drawer-header">
          <div className="flex min-w-0 items-center gap-3">
            <span className="workspace-drawer-seal"><FolderTree size={19} /></span>
            <div className="min-w-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#8f1e18]">{language === 'zh' ? '本地交付空间' : 'Local deliverable workspace'}</div>
              <h2 id="workspace-section-title" className="truncate font-serif text-2xl text-[#251b13]">{language === 'zh' ? '本地文件与交付物' : projectText('Files and deliverables')}</h2>
              {mirroredWorkspacePath && <div data-no-localize="" className="mt-1 truncate font-mono text-[9px] text-[#7d6a49]" title={mirroredWorkspacePath}>{mirroredWorkspacePath}</div>}
            </div>
          </div>
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#59684b]">{language === 'zh' ? '始终显示 · 本地根目录' : 'Always visible · Local root'}</div>
        </header>

        {!backendAvailable ? (
          <div className="workspace-boundary-state">
            <Files size={28} />
            <h3>{language === 'zh' ? '本地后端尚未连接' : 'Local backend is not connected'}</h3>
            <p>{language === 'zh' ? 'Workspace 只读取本机已绑定的文件夹，因此需要先启动本地服务。' : 'Workspace reads the bound local folder, so the local service must be running.'}</p>
          </div>
        ) : !workspacePath ? (
          <div className="workspace-boundary-state">
            <FolderTree size={28} />
            <h3>{language === 'zh' ? '这个项目还没有选择 Workspace' : 'This project has no Workspace yet'}</h3>
            <p>{language === 'zh' ? '选择一个本地文件夹后，Agents 和这里的文件管理器会使用同一个项目根目录。' : 'Choose a local folder so Agents and this file manager use the same project root.'}</p>
            <button type="button" onClick={onOpenWorkspaceSettings}><Settings size={14} />{language === 'zh' ? '打开 Workspace 设置' : 'Open Workspace settings'}</button>
          </div>
        ) : (
          <>
            <section data-testid="workspace-deliverable-catalog" aria-labelledby="workspace-deliverables-title" className="border-b border-[#b8a57d] bg-[#f7edcf]/55 px-4 py-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8f1e18]">{language === 'zh' ? '项目文件' : 'Project files'}</div>
                  <h3 id="workspace-deliverables-title" className="mt-1 font-serif text-2xl text-[#251b13]">{language === 'zh' ? '交付文件' : 'Deliverable files'}</h3>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#59684b]">
                  {assetCatalog.filter(asset => asset.fileAvailable).length}/{assetCatalog.length} {language === 'zh' ? '个文件已生成' : 'files created'}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {assetCatalog.map((asset) => {
                  const canOpen = asset.fileAvailable;
                  const AssetIcon = assetFileIcons[asset.fileKind] || File;
                  const Card = canOpen ? 'button' : 'article';
                  const statusTone = asset.statusState === 'completed'
                    ? 'bg-[#59684b]'
                    : asset.statusState === 'planned'
                      ? 'bg-[#a58e62]'
                      : 'bg-[#a92a22]';
                  return (
                    <Card
                      key={asset.id}
                      type={canOpen ? 'button' : undefined}
                      data-testid={`workspace-deliverable-${asset.id}`}
                      data-asset-status={asset.statusState}
                      onClick={canOpen ? () => handleOpenFile({ path: asset.path, name: asset.path.split('/').at(-1), type: 'file' }) : undefined}
                      aria-label={canOpen ? `${language === 'zh' ? '打开' : 'Open'} ${asset.fileName}` : undefined}
                      className={`group relative flex min-h-[230px] w-full flex-col border bg-[#fffaf0]/80 p-5 text-left transition-colors ${canOpen ? 'cursor-pointer border-[#c9b783] hover:border-[#8f1e18] hover:bg-[#fffaf0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f1e18]' : 'border-[#d8c99f]'}`}
                    >
                      <div className="flex h-14 w-14 items-center justify-center border border-[#c9b783] bg-[#f7edcf] text-[#8f1e18]" aria-hidden="true">
                        <AssetIcon size={30} strokeWidth={1.4} />
                      </div>
                      <h4 className="mt-5 font-serif text-xl leading-snug text-[#251b13]">
                        <span>{asset.displayName}</span>
                        <span data-no-localize="" className="ml-1 whitespace-nowrap font-mono text-[0.62em] tracking-normal text-[#8f1e18]">{asset.extension}</span>
                      </h4>
                      <div className="mt-auto border-t border-[#d8c99f] pt-4">
                        <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[#6d5d42]">
                          <span className={`h-2 w-2 rounded-full ${statusTone}`} aria-hidden="true" />
                          <span>{asset.statusLabel}</span>
                        </div>
                        <p className="mt-2 font-serif text-sm leading-relaxed text-[#3f3425]">{asset.statusSummary}</p>
                        {asset.statusDetail && <p className="mt-1 font-mono text-[9px] leading-relaxed text-[#7d6a49]">{asset.statusDetail}</p>}
                      </div>
                    </Card>
                  );
                })}
                {!assetCatalog.length && <p className="font-serif text-sm text-[#6b5a3d]">{language === 'zh' ? '负责人还没有安排交付文件。' : 'The Leader has not scheduled any deliverable files yet.'}</p>}
              </div>
            </section>
            <div className="workspace-mobile-switch md:hidden">
              <button type="button" className={mobilePane === 'tree' ? 'is-active' : ''} onClick={() => setMobilePane('tree')}><PanelLeft size={13} />{language === 'zh' ? '结构' : 'Structure'}</button>
              <button type="button" className={mobilePane === 'file' ? 'is-active' : ''} onClick={() => setMobilePane('file')}><Files size={13} />{language === 'zh' ? '内容' : 'Content'}</button>
            </div>
            {state.error && (
              <div className="workspace-inline-error" role="alert">
                <span>{state.error}</span>
                <button type="button" onClick={retryFailedOperation}><RefreshCw size={12} />{language === 'zh' ? '重试' : 'Retry'}</button>
              </div>
            )}
            <div className="workspace-drawer-body">
              <nav className={`workspace-tree-pane ${mobilePane === 'tree' ? 'is-mobile-active' : ''}`} aria-label={language === 'zh' ? 'Workspace 文件结构' : 'Workspace file structure'}>
                <div className="workspace-tree-pane__label">
                  <span>{language === 'zh' ? '项目结构' : 'Project structure'}</span>
                  <button type="button" onClick={() => loadDirectory('.')} aria-label={language === 'zh' ? '刷新根目录' : 'Refresh root'}><RefreshCw size={12} /></button>
                </div>
                <WorkspaceTree
                  state={state}
                  onDelete={beginDelete}
                  onOpenFile={handleOpenFile}
                  onRename={beginRename}
                  onSelect={handleSelect}
                  onToggle={handleToggle}
                />
              </nav>
              <main className={`workspace-content-pane ${mobilePane === 'file' ? 'is-mobile-active' : ''}`}>
                <button type="button" onClick={() => setMobilePane('tree')} className="mb-2 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] md:hidden"><ArrowLeft size={12} />{language === 'zh' ? '返回结构' : 'Back to structure'}</button>
                <WorkspaceFilePane
                  activity={activity}
                  editor={state.editor}
                  language={language}
                  onCreateFile={beginCreateFile}
                  onCreateFolder={beginCreateFolder}
                  onEditorChange={content => dispatch({ type: 'editor-changed', content })}
                  onKeepEditing={() => dispatch({ type: 'dismiss-conflict' })}
                  onOpenEntry={handleOpenEntry}
                  onRefresh={refreshSelection}
                  onReloadLatest={() => handleOpenFile(selectedEntry, { ignoreDirty: true })}
                  onSave={saveFile}
                  selectedChildren={selectedChildren}
                  selectedEntry={selectedEntry}
                />
              </main>
            </div>
          </>
        )}

        <WorkspaceActionDialog
          dialog={dialog}
          error={dialogError}
          language={language}
          loading={dialogLoading}
          onCancel={() => setDialog(null)}
          onSubmit={submitDialog}
          onValueChange={value => setDialog(current => ({ ...current, value }))}
        />
    </section>
  );
}
