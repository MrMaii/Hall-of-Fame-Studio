const unique = values => [...new Set(values)];

const isWithin = (candidate, root) => candidate === root || candidate.startsWith(`${root}/`);

const parentPath = (path) => {
  if (!path || path === '.') return null;
  const parts = path.split('/');
  parts.pop();
  return parts.join('/') || '.';
};

const rewritePath = (path, fromPath, toPath) => {
  if (!path || !isWithin(path, fromPath)) return path;
  return path === fromPath ? toPath : `${toPath}${path.slice(fromPath.length)}`;
};

function withoutSubtree(state, path) {
  const entriesByPath = Object.fromEntries(
    Object.entries(state.entriesByPath).filter(([entryPath]) => !isWithin(entryPath, path)),
  );
  const childPathsByDirectory = Object.fromEntries(
    Object.entries(state.childPathsByDirectory)
      .filter(([directoryPath]) => !isWithin(directoryPath, path))
      .map(([directoryPath, childPaths]) => [directoryPath, childPaths.filter(childPath => !isWithin(childPath, path))]),
  );
  const selectedPath = isWithin(state.selectedPath, path) ? '.' : state.selectedPath;
  const editor = state.editor.path && isWithin(state.editor.path, path)
    ? { path: null, content: '', updatedAt: null, dirty: false, conflict: null }
    : state.editor;
  return {
    ...state,
    entriesByPath,
    childPathsByDirectory,
    expandedPaths: state.expandedPaths.filter(entryPath => !isWithin(entryPath, path)),
    loadingPaths: state.loadingPaths.filter(entryPath => !isWithin(entryPath, path)),
    selectedPath,
    editor,
  };
}

export function createWorkspaceTreeState(root = null) {
  return {
    root,
    entriesByPath: root ? { [root.path]: root } : {},
    childPathsByDirectory: {},
    expandedPaths: root ? [root.path] : [],
    loadingPaths: [],
    selectedPath: root?.path || '.',
    editor: { path: null, content: '', updatedAt: null, dirty: false, conflict: null },
    error: null,
    errorPath: null,
  };
}

export function workspaceTreeReducer(state, action = {}) {
  switch (action.type) {
    case 'reset':
      return createWorkspaceTreeState(action.root || null);
    case 'root-relocated': {
      const root = { ...state.root, name: action.name || state.root?.name, updatedAt: action.updatedAt || state.root?.updatedAt };
      return {
        ...state,
        root,
        entriesByPath: { ...state.entriesByPath, '.': root },
      };
    }
    case 'directory-loading':
      return {
        ...state,
        loadingPaths: unique([...state.loadingPaths, action.path]),
        error: state.errorPath && state.errorPath !== action.path ? state.error : null,
        errorPath: state.errorPath && state.errorPath !== action.path ? state.errorPath : null,
      };
    case 'directory-loaded': {
      const nextPaths = (action.entries || []).map(entry => entry.path);
      const previousPaths = state.childPathsByDirectory[action.path] || [];
      let nextState = state;
      for (const stalePath of previousPaths.filter(path => !nextPaths.includes(path))) {
        nextState = withoutSubtree(nextState, stalePath);
      }
      return {
        ...nextState,
        entriesByPath: {
          ...nextState.entriesByPath,
          ...(action.entries || []).reduce((records, entry) => ({ ...records, [entry.path]: entry }), {}),
        },
        childPathsByDirectory: {
          ...nextState.childPathsByDirectory,
          [action.path]: nextPaths,
        },
        loadingPaths: nextState.loadingPaths.filter(path => path !== action.path),
        error: nextState.errorPath && nextState.errorPath !== action.path ? nextState.error : null,
        errorPath: nextState.errorPath && nextState.errorPath !== action.path ? nextState.errorPath : null,
      };
    }
    case 'toggle-directory':
      return {
        ...state,
        expandedPaths: state.expandedPaths.includes(action.path)
          ? state.expandedPaths.filter(path => path !== action.path)
          : [...state.expandedPaths, action.path],
      };
    case 'select-entry':
      return { ...state, selectedPath: action.path };
    case 'file-opened':
      return {
        ...state,
        selectedPath: action.file.path,
        entriesByPath: { ...state.entriesByPath, [action.file.path]: action.file },
        editor: {
          path: action.file.path,
          content: action.content,
          updatedAt: action.file.updatedAt || null,
          dirty: false,
          conflict: null,
        },
        error: null,
        errorPath: null,
      };
    case 'editor-changed':
      return { ...state, editor: { ...state.editor, content: action.content, dirty: true, conflict: null } };
    case 'save-conflict':
      return {
        ...state,
        editor: { ...state.editor, conflict: { currentUpdatedAt: action.currentUpdatedAt || null } },
      };
    case 'dismiss-conflict':
      return { ...state, editor: { ...state.editor, conflict: null } };
    case 'save-succeeded':
      return {
        ...state,
        entriesByPath: { ...state.entriesByPath, [action.file.path]: action.file },
        editor: {
          ...state.editor,
          updatedAt: action.file.updatedAt || state.editor.updatedAt,
          dirty: false,
          conflict: null,
        },
      };
    case 'entry-removed':
      return withoutSubtree(state, action.path);
    case 'entry-moved': {
      const fromPath = action.fromPath;
      const toPath = action.entry.path;
      const entriesByPath = {};
      for (const [path, entry] of Object.entries(state.entriesByPath)) {
        const nextPath = rewritePath(path, fromPath, toPath);
        entriesByPath[nextPath] = nextPath === toPath
          ? action.entry
          : nextPath === path ? entry : { ...entry, path: nextPath };
      }
      const childPathsByDirectory = {};
      for (const [path, childPaths] of Object.entries(state.childPathsByDirectory)) {
        childPathsByDirectory[rewritePath(path, fromPath, toPath)] = childPaths.map(childPath => rewritePath(childPath, fromPath, toPath));
      }
      const fromParent = parentPath(fromPath);
      const toParent = parentPath(toPath);
      if (fromParent && childPathsByDirectory[fromParent]) {
        childPathsByDirectory[fromParent] = childPathsByDirectory[fromParent]
          .filter(path => path !== fromPath)
          .map(path => path === fromPath ? toPath : path);
      }
      if (toParent) {
        childPathsByDirectory[toParent] = unique([...(childPathsByDirectory[toParent] || []), toPath]);
      }
      return {
        ...state,
        entriesByPath,
        childPathsByDirectory,
        expandedPaths: state.expandedPaths.map(path => rewritePath(path, fromPath, toPath)),
        loadingPaths: state.loadingPaths.map(path => rewritePath(path, fromPath, toPath)),
        selectedPath: rewritePath(state.selectedPath, fromPath, toPath),
        editor: {
          ...state.editor,
          path: rewritePath(state.editor.path, fromPath, toPath),
        },
      };
    }
    case 'error':
      return {
        ...state,
        loadingPaths: action.path ? state.loadingPaths.filter(path => path !== action.path) : state.loadingPaths,
        error: action.error || null,
        errorPath: action.path || null,
      };
    default:
      return state;
  }
}

export { parentPath as workspaceParentPath };
