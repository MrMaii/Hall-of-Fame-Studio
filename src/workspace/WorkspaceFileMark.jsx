import {
  Archive,
  Braces,
  Code2,
  File,
  FileBadge,
  FileText,
  Film,
  Folder,
  FolderOpen,
  Image,
  Link2,
  Music2,
  Presentation,
  SlidersHorizontal,
  Table2,
} from 'lucide-react';
import { resolveWorkspaceFileVisual } from './workspaceFileVisuals.js';

const ICONS = {
  archive: Archive,
  audio: Music2,
  code: Code2,
  config: SlidersHorizontal,
  data: Braces,
  document: FileBadge,
  file: File,
  folder: Folder,
  image: Image,
  link: Link2,
  presentation: Presentation,
  table: Table2,
  text: FileText,
  video: Film,
};

export default function WorkspaceFileMark({ entry, open = false, large = false }) {
  const visual = resolveWorkspaceFileVisual(entry);
  const Icon = visual.family === 'folder' && open ? FolderOpen : ICONS[visual.icon] || File;
  return (
    <span
      className={`workspace-file-mark workspace-file-mark--${visual.family} ${large ? 'workspace-file-mark--large' : ''}`}
      data-family={visual.family}
      aria-hidden="true"
    >
      <Icon className="workspace-file-mark__icon" size={large ? 22 : 15} strokeWidth={1.8} />
    </span>
  );
}
