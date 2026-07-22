import { ChevronRight, LoaderCircle, Pencil, Trash2 } from 'lucide-react';
import WorkspaceFileMark from './WorkspaceFileMark.jsx';

function TreeRow({
  arrivalIndex = 0,
  depth,
  entry,
  state,
  onDelete,
  onOpenFile,
  onRename,
  onSelect,
  onToggle,
}) {
  const directory = entry.type === 'directory';
  const symlink = entry.type === 'symlink';
  const expanded = directory && state.expandedPaths.includes(entry.path);
  const loading = state.loadingPaths.includes(entry.path);
  const selected = state.selectedPath === entry.path;
  const childPaths = state.childPathsByDirectory[entry.path] || [];
  const isRoot = entry.path === '.';
  const activate = () => {
    onSelect(entry);
    if (!directory && !symlink) onOpenFile(entry);
  };
  const toggle = () => {
    if (directory) onToggle(entry);
  };
  const onKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      directory ? toggle() : activate();
    }
    if (event.key === 'ArrowRight' && directory && !expanded) {
      event.preventDefault();
      toggle();
    }
    if (event.key === 'ArrowLeft' && directory && expanded) {
      event.preventDefault();
      toggle();
    }
  };

  return (
    <li role="none" className="workspace-tree-branch workspace-tree-entry-arrive" style={{ '--workspace-entry-index': Math.min(arrivalIndex, 5) }}>
      <div
        role="treeitem"
        aria-expanded={directory ? expanded : undefined}
        aria-selected={selected}
        tabIndex={selected ? 0 : -1}
        data-testid={`workspace-tree-entry-${entry.path}`}
        className={`workspace-tree-row group ${selected ? 'is-selected' : ''} ${isRoot ? 'is-root' : ''} ${symlink ? 'is-disabled' : ''}`}
        style={{ '--workspace-tree-depth': depth }}
        onClick={activate}
        onDoubleClick={toggle}
        onKeyDown={onKeyDown}
      >
        <button
          data-no-localize=""
          type="button"
          className={`workspace-tree-chevron ${directory ? '' : 'is-placeholder'}`}
          onClick={(event) => { event.stopPropagation(); toggle(); }}
          tabIndex={-1}
          aria-label={expanded ? `Collapse ${entry.name}` : `Expand ${entry.name}`}
        >
          {loading ? <LoaderCircle size={13} className="animate-spin" /> : <ChevronRight size={14} />}
        </button>
        <WorkspaceFileMark entry={entry} open={expanded} />
        <span data-no-localize="" className="workspace-tree-name" title={entry.name}>{entry.name}</span>
        {!isRoot && !symlink && (
          <span className="workspace-tree-actions">
            <button data-no-localize="" type="button" onClick={(event) => { event.stopPropagation(); onRename(entry); }} aria-label={`Rename ${entry.name}`}><Pencil size={12} /></button>
            <button data-no-localize="" type="button" onClick={(event) => { event.stopPropagation(); onDelete(entry); }} aria-label={`Delete ${entry.name}`}><Trash2 size={12} /></button>
          </span>
        )}
      </div>
      {directory && expanded && (
        <ul role="group" className="workspace-tree-children">
          {childPaths.map((path, index) => {
            const child = state.entriesByPath[path];
            return child ? (
              <TreeRow
                key={path}
                arrivalIndex={index}
                depth={depth + 1}
                entry={child}
                state={state}
                onDelete={onDelete}
                onOpenFile={onOpenFile}
                onRename={onRename}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            ) : null;
          })}
          {!loading && Object.prototype.hasOwnProperty.call(state.childPathsByDirectory, entry.path) && childPaths.length === 0 && (
            <li className="workspace-tree-empty" style={{ '--workspace-tree-depth': depth + 1 }}>空文件夹</li>
          )}
        </ul>
      )}
    </li>
  );
}

export default function WorkspaceTree({ state, onDelete, onOpenFile, onRename, onSelect, onToggle }) {
  if (!state.root) return null;
  return (
    <ul role="tree" aria-label="Project workspace files" className="workspace-tree">
      <TreeRow
        depth={0}
        entry={state.root}
        state={state}
        onDelete={onDelete}
        onOpenFile={onOpenFile}
        onRename={onRename}
        onSelect={onSelect}
        onToggle={onToggle}
      />
    </ul>
  );
}
