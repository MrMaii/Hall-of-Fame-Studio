import {
  AlertTriangle,
  Check,
  FilePlus2,
  FolderPlus,
  RefreshCw,
  Save,
} from 'lucide-react';
import WorkspaceFileMark from './WorkspaceFileMark.jsx';
import { isWorkspaceTextFile } from './workspaceFileVisuals.js';

const formatBytes = (value = 0) => {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatUpdatedAt = (value, language) => {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return language === 'zh' ? '更新时间未知' : 'Update time unknown';
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(time));
};

export default function WorkspaceFilePane({
  activity,
  editor,
  language = 'zh',
  onCreateFile,
  onCreateFolder,
  onEditorChange,
  onKeepEditing,
  onOpenEntry,
  onRefresh,
  onReloadLatest,
  onSave,
  selectedEntry,
  selectedChildren = [],
}) {
  if (!selectedEntry) {
    return <div className="workspace-pane-empty">{language === 'zh' ? '从左侧选择文件或文件夹' : 'Select a file or folder from the tree'}</div>;
  }
  const directory = selectedEntry.type === 'directory';
  const editable = isWorkspaceTextFile(selectedEntry);
  const editorReady = editable && editor.path === selectedEntry.path;

  return (
    <section className="workspace-file-pane" aria-label={language === 'zh' ? 'Workspace 内容' : 'Workspace content'}>
      <header className="workspace-file-pane__header">
        <div className="flex min-w-0 items-center gap-3">
          <WorkspaceFileMark entry={selectedEntry} open={directory} large />
          <div className="min-w-0">
            <h3 data-no-localize="" className="truncate font-serif text-xl text-[#251b13]">{selectedEntry.name}</h3>
            <div data-no-localize="" className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.12em] text-[#7d6a49]">{selectedEntry.path}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {directory && (
            <>
              <button type="button" onClick={onCreateFile} className="workspace-tool-button"><FilePlus2 size={13} />{language === 'zh' ? '文件' : 'File'}</button>
              <button type="button" onClick={onCreateFolder} className="workspace-tool-button"><FolderPlus size={13} />{language === 'zh' ? '文件夹' : 'Folder'}</button>
            </>
          )}
          <button type="button" onClick={onRefresh} className="workspace-tool-button" aria-label={language === 'zh' ? '刷新' : 'Refresh'}><RefreshCw size={13} /></button>
        </div>
      </header>

      {editor.conflict && editor.path === selectedEntry.path && (
        <div className="workspace-conflict" role="alert">
          <AlertTriangle size={16} />
          <div className="min-w-0 flex-1">
            <div className="font-serif text-base">{language === 'zh' ? '文件已被 Agent 更新' : 'An Agent updated this file'}</div>
            <div className="mt-1 font-mono text-[10px] leading-relaxed opacity-80">{language === 'zh' ? '当前编辑没有被覆盖。读取最新版后再决定如何继续。' : 'Your edit was not overwritten. Load the latest version before deciding what to keep.'}</div>
          </div>
          <button type="button" onClick={onReloadLatest}>{language === 'zh' ? '读取最新版' : 'Load latest'}</button>
          <button type="button" onClick={onKeepEditing}>{language === 'zh' ? '继续查看当前编辑' : 'Keep current edit'}</button>
        </div>
      )}

      {directory ? (
        <div className="workspace-directory-list" data-testid="workspace-directory-contents">
          {selectedChildren.length ? selectedChildren.map((entry, index) => (
            <button
              type="button"
              key={entry.path}
              onClick={() => onOpenEntry(entry)}
              className="workspace-directory-row workspace-tree-entry-arrive"
              style={{ '--workspace-entry-index': Math.min(index, 5) }}
            >
              <WorkspaceFileMark entry={entry} />
              <span data-no-localize="" className="min-w-0 flex-1 truncate text-left font-serif text-[15px] text-[#30271d]">{entry.name}</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#8a7a5d]">{entry.type === 'directory' ? 'Folder' : formatBytes(entry.size)}</span>
            </button>
          )) : (
            <div className="workspace-pane-empty">{language === 'zh' ? '这个文件夹还是空的。可以从上方创建第一个文件。' : 'This folder is empty. Create its first file above.'}</div>
          )}
        </div>
      ) : editable ? (
        editorReady ? (
          <div className="workspace-editor-shell">
            <textarea
              data-testid="workspace-file-editor"
              value={editor.content}
              onChange={event => onEditorChange(event.currentTarget.value)}
              spellCheck={false}
              aria-label={`${selectedEntry.name} editor`}
              className="workspace-file-editor"
            />
            <div className="workspace-editor-status">
              <span>{formatBytes(selectedEntry.size)} · {formatUpdatedAt(editor.updatedAt || selectedEntry.updatedAt, language)}</span>
              <span role="status" aria-live="polite" aria-atomic="true" className={`workspace-save-state is-${activity?.tone || (editor.dirty ? 'dirty' : 'idle')}`}>
                {activity?.tone === 'saved' && <Check size={12} />}
                {activity?.message || (editor.dirty ? (language === 'zh' ? '有未保存修改' : 'Unsaved changes') : (language === 'zh' ? '已同步本地文件' : 'Local file in sync'))}
              </span>
              <button type="button" onClick={onSave} disabled={!editor.dirty || activity?.tone === 'saving'} className="workspace-save-button">
                <Save size={13} /> {language === 'zh' ? '保存' : 'Save'}
              </button>
            </div>
          </div>
        ) : <div data-testid="workspace-file-loading" role="status" className="workspace-pane-empty">{language === 'zh' ? '正在读取文件…' : 'Reading file…'}</div>
      ) : (
        <div className="workspace-unsupported" data-testid="unsupported-preview">
          <WorkspaceFileMark entry={selectedEntry} large />
          <h4>{language === 'zh' ? '这个文件保留在本地，但不在这里编辑' : 'This file stays local and is not edited here'}</h4>
          <p>{selectedEntry.type === 'symlink'
            ? (language === 'zh' ? '符号链接不会被展开，以确保 Workspace 不能越过选定根目录。' : 'Symbolic links are not followed so the Workspace cannot escape its selected root.')
            : (language === 'zh' ? '当前工作台只读取 UTF-8 文本文件。二进制文件仍会显示在结构中。' : 'The workbench reads UTF-8 text files only. Binary files remain visible in the structure.')}</p>
          <div>{formatBytes(selectedEntry.size)} · {formatUpdatedAt(selectedEntry.updatedAt, language)}</div>
        </div>
      )}
    </section>
  );
}
