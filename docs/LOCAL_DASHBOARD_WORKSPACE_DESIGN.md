# Local Dashboard Workspace Design

## Product role

Workspace is not another Dashboard report. It is the place where the user can inspect and manage the concrete files behind the work summarized by the Dashboard. The Dashboard answers what the project is doing; Workspace lets the user touch the underlying material without leaving that context.

The selected local folder is the only user-visible project file root. The drawer never browses the parent directory, another drive, or Hall of Fame's private runtime data.

## Visual tone

The visual metaphor is a living project archive: a warm paper surface, ink-dark hierarchy, muted brass dividers, and restrained red for attention. It inherits the current Dashboard instead of introducing an IDE-like dark theme or generic SaaS cards.

- The drawer is a work surface, not a modal card. It enters from the right edge and uses most of the available height.
- The tree reads like an archive index: one continuous surface, light row separators, visible indentation, and a stronger root label.
- The file pane reads like a document laid beside the index. Text editing uses a calm neutral surface and generous line height.
- Borders separate major regions only. Individual rows use spacing and selection ink rather than boxed cards.
- Red means conflict, danger, or unsaved attention. Green means a completed save. Blue, violet, ochre, and teal distinguish file families without carrying status meaning.

## File marks

File marks are UI symbols, not generated artwork. Each mark combines four cues so it remains understandable in grayscale and for users with color-vision differences:

1. silhouette: folder tab or folded-corner page;
2. Lucide pictogram: code, text, image, data, media, archive, or settings;
3. short extension label such as `JS`, `MD`, `PDF`, or `IMG`;
4. a restrained family color.

Families:

| Family | Extensions | Mark | Color role |
| --- | --- | --- | --- |
| Folder | directories | folder tab | warm ochre |
| Code | js, jsx, ts, tsx, py, java, go, rs, html, css | code brackets | muted blue |
| Text | md, txt, rtf | document lines | ink gray |
| Document | pdf, doc, docx | document seal | brick red |
| Data | json, yaml, yml, csv, xml, sql | braces/database | teal |
| Spreadsheet | xls, xlsx, ods | table grid | green |
| Presentation | ppt, pptx, key | presentation frame | amber |
| Image | png, jpg, jpeg, gif, webp, svg | landscape | violet |
| Audio | mp3, wav, m4a, flac | waveform | rose |
| Video | mp4, mov, webm, avi | film frame | indigo |
| Archive | zip, 7z, rar, tar, gz | archive box | brown |
| Configuration | env, ini, toml, lock | sliders | slate |
| Unknown | every other file | folded page | neutral ink |

Marks appear with the row, not before it. Newly loaded children use a 140 ms stagger capped at six rows; longer folders do not create long animation queues. Selection raises the mark by one pixel and darkens its outline. Opening a file enlarges the same mark in the file-pane heading, preserving object continuity.

## Motion language

Motion explains spatial and state changes:

- Drawer open/close: 190 ms horizontal movement, establishing that Workspace belongs to the current Dashboard rather than replacing it.
- Folder expand/collapse: 160 ms chevron rotation and clipped child reveal.
- Entry arrival: 140 ms opacity/vertical settle, staggered only for the first six children.
- Save: a quiet 500 ms confirmation wash in the status line, with no celebratory animation.
- Conflict: the status area holds steady and changes color; it does not shake because the user did nothing wrong.
- Delete: the row fades only after backend confirmation, never optimistically.
- `prefers-reduced-motion` disables translation, stagger, and rotation while preserving state changes.

## User logic and psychology

### Recognition over recall

The persistent root, file-family marks, breadcrumb, and relative path let users recognize location without memorizing it. Absolute paths appear only as local context in the drawer heading; actions always operate on relative paths.

### Progressive disclosure

The tree starts with the root and its direct children. Deeper structure and row actions appear only when requested. This keeps a large codebase legible and prevents the interface from becoming a permanent wall of controls.

### Spatial continuity

The Dashboard stays mounted behind the drawer. Users retain the project's current focus and team context while inspecting its files, reducing the mental cost of switching into a separate tool.

### Direct manipulation

Actions are attached to the selected file or folder. Rename happens in context, refresh targets the current directory, and creation targets the currently selected folder. This keeps the action-object relationship visible.

### Error prevention and agency

The root cannot be moved or deleted. Destructive actions name the exact path and wait for backend success. Stale saves stop instead of overwriting Agent work. The conflict state offers reload or continued inspection, never a casual force overwrite.

### Calm feedback

Loading is shown at the folder being loaded, not as a full-screen blocker. Saving, saved, and conflict states stay near the document title. This answers “what is happening?” without turning normal file work into alerts.

## Core interaction sequence

1. User opens a project Dashboard and sees Workspace as a peer action to Meeting, Chat, and Timeline.
2. Workspace slides in; the selected local root and direct children appear.
3. User expands folders as needed. Each expansion reads only that relative directory.
4. Selecting a folder shows its immediate contents and creation actions.
5. Selecting a supported text file opens the document surface; `Ctrl+S` or the Save action writes it.
6. If an Agent changed the file since it was opened, saving stops and offers to load the latest content.
7. Closing Workspace returns to the unchanged Dashboard position and context.
