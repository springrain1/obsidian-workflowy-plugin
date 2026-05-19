# Changelog

All notable changes to this project will be documented in this file.

---

## v2.6

### ✨ New Features

#### Mobile Dual-Mode Toolbar
- Edit toolbar shown when keyboard is up (horizontally scrollable), auto-switches to function toolbar when keyboard is down
- Edit toolbar additions: undo/redo, insert internal link `[[]]`, embed content `![[]]`, add tag `#`, insert attachment (opens system file picker), insert link `[]()`
- Function toolbar: toggle render mode, expand all, collapse all, expand to level (1/2/3)
- Swipe protection: finger movement over 8px threshold treated as scroll, not button tap
- Keyboard dismiss button pinned to the right side of edit toolbar

#### Mobile IME Flicker Fix (MobileDOMPatcher)
- New `MobileDOMPatcher` for precise local DOM updates, avoiding full re-render keyboard flicker
- Toolbar indent/outdent, new block, toggle todo all use local update path
- Physical keyboard Enter/Backspace on mobile use local DOM update path
- Live Preview blur deferred to prevent IME collapse during toolbar operations
- Editing textarea always reused on mobile to prevent detach-induced keyboard flicker

#### Mobile UI Improvements
- Content line changed to top alignment (`flex-start`), bullet/checkbox aligns with first line
- Bullet and checkbox `margin-top: 2px` for precise alignment
- New ordered list number top-alignment styles
- Collapse indicator and checkbox `pointerdown` prevents focus loss
- Mobile focus uses `scrollIntoView({ block: 'center' })` for centered display

### 🐛 Bug Fixes
- Fixed Live Preview Backspace at cursor start not responding
- Fixed mobile checkbox/collapse indicator click causing focus transfer and IME flicker
- Fixed `enterEditMode` re-entry causing duplicate execution
- Fixed `focus()` not properly activating edit mode in Live Preview
- Fixed mobile indent/undo syncing issues that could cause content loss in nodes above
- Fixed cursor jumping during high-frequency edits and memory leaks from orphaned DOM nodes

### 🔧 Improvements

#### Undo/Redo Architecture Refactor
- Refactored to a Transaction-based undo history system, supporting atomic undo/redo of multi-step and batch operations (e.g., drag & drop, multi-indent)
- Introduced a 3-tier DOM sync strategy (Content-only fast-path → Mobile incremental patch → Full render fallback) to maximize performance while minimizing keyboard flicker on mobile

#### File Saving & Concurrency Control
- Introduced `saveQueue` and debounced task IDs to enforce linear write ordering, preventing race conditions and file corruption during rapid keystrokes or batch alterations
- Upgraded `saveAllEditingContent` strategy to synchronize directly with `OutlineItem` instances rather than relying on DOM queries, enhancing robustness during cross-view deletions and updates

#### MobileDOMPatcher Improvements
- `MobileDOMPatcher` now properly synchronizes Ordered List indices immediately when inserting new nodes, preventing sequence mismatch
- Utilizes strict structural tree matching to prevent context loss during complex edge cases (e.g. outdenting the last node, merging across levels)

## v2.4

### ✨ New Features

#### UI & Interaction Enhancements
- Added new settings options (font size, line height, bullet alignment, font family, etc.)
- Support `Ctrl+Scroll` to quickly adjust font size (10-30px)
- Bullet size automatically adjusts with font size
- Bullet vertical center always aligns with the first line of text
- Font size changes in Live Preview mode keep the render layer consistent with the edit layer
- Collapse indicator changed to SVG implementation

#### Thino Compatibility Mode
- Added Thino/Memos plugin compatibility mode
- **When Thino mode is enabled**:
  - Level 1 list items preserve original continuation line indentation (Tab or Space)
  - Level 2+ list items maintain standard two-space format
  - Original indentation preserved when switching between Markdown ↔ Outline view
  - Optional auto-timestamp for new blocks (`HH:mm` or `HH:mm:ss` format)
  - New command: `Workflowy: Toggle auto-timestamp for new blocks`
- **When Thino mode is disabled**:
  - Tab automatically converted to spaces, continuation lines use two-space format

### 🐛 Bug Fixes
- Fixed ordered/unordered list rendering in Live Preview mode for single-node continuation content
- Fixed whitespace trimming at both ends of continuation content
- Fixed Thino compatibility toggle not taking effect
- Fixed regex incorrectly identifying lines starting with numbers as list items

### 🔧 Improvements

#### Plugin Compatibility
- Optimized compatibility with Thino and TickTickSync plugins
- Improved continuation line indentation detection and restoration

#### Memory Management
- Added component destruction mechanism to prevent memory leaks
- Added `destroy()` method to `ZoomManager`, `ThemeManager`, `FileDropHandler`
- Enhanced resource cleanup for `TagSuggestMenu`, `SlashCommandMenu`
- Added `OutlineItem.cleanupStaticResources()` static method for drag-related cleanup

#### Lifecycle Management
- Enhanced `WorkflowyView.onClose()` for cascading child component destruction
- Added `isClosing` flag to prevent async operations after view close
- Added `wheelHandler` event tracking for proper event listener removal

#### Defensive Programming
- Added `isDestroyed` checks to `VerticalLinesManager`, `MultiSelectionManager`
- Check component state after async operations to avoid updating destroyed views
- Enhanced plugin `onunload()` to clean up static resources

---

## v2.3

### ✨ New Features
- `/` opens slash command menu with obsidian-tasks style editing (TickTickSync compatible)

| Command Type | Function |
|--------------|----------|
| **Time** | Set task time `[HH:MM]`, supports time ranges |
| **Priority** | 🔺Highest / ⏫High / 🔼Medium / 🔽Low / ⏬Lowest |
| **Date** | 📅Due / ⏳Scheduled / 🛫Start / ➕Created / ✅Done |
| **Status** | ☐Todo / ◐In Progress / ☑Done / ⊘Cancelled / •Normal |

- Added time picker and date picker
- Grouped commands display with section headers
- Chinese tooltips for slash command menu (using title attribute)
- Auto-replace instead of append for repeated commands
- `#` opens tag suggestion menu with real-time filtering
- Keyboard navigation support: ↑/↓ navigate, Enter select, Escape close

### 🐛 Bug Fixes
- Fixed cursor position issues with `/` command
- Fixed keyboard navigation not working
- Fixed `TypeError: Cannot read properties of null` when executing status commands
- Fixed empty lines lost when switching from Outline to Markdown view
- Fixed Live Preview rendering for block elements (headings, code blocks, quotes, lists)
- Fixed slash command and tag menu not following cursor position

---

## v2.2

### 🔧 Improvements
- Ordered list auto-sorting
- Bi-directional sync for ordered lists between Outline and Markdown views

### 🐛 Bug Fixes
- Fixed ordered lists being converted to unordered lists
- Fixed excessive spacing between ordered list numbers and content
- Fixed ordered list sequence loss with Ctrl+Z and cross-document drag

---

## v2.1

### ✨ New Features
- Added mobile toolbar buttons: Todo, Bold, Italic, Strikethrough, Highlight, Code, Outdent, Indent, Enter, Hide Keyboard
- Redesigned mobile collapse indicator (moved to right side with ▼/◀ icons)

### 🐛 Bug Fixes
- Fixed desktop bullet styles too large for mobile (now using `::after` pseudo-element)
- Fixed rectangular box appearing in collapsed node bullets on mobile
- Fixed vertical lines not aligning with bullet center on mobile
- Fixed collapse indicator visual misalignment with vertical lines

---

## v2.0

### ✨ New Features
- Logseq-style shortcuts: Shift+click, Ctrl+hover, Alt+create block reference
- Cross-document single/multi-select drag via bullet point
- Alt+drag to auto-create block references
- `!` prefixed heading/block references with navigation and highlighting

### 🐛 Bug Fixes
- Fixed cursor position after deleting block with `Ctrl+Shift+Backspace`

---

## v1.9

### ✨ New Features
- Paste images from clipboard or drag from file explorer
- Drag files to generate links (`.md` → `[[]]`, others → `![[]]`)
- Cursor indicator when dragging files in Live Preview and Source mode
- Heading/block reference navigation with highlight effect

### 🐛 Bug Fixes
- Built-in shortcuts for: Delete block, Move block up/down
- Added shortcut: Clear block content (`Ctrl+Backspace`)

---

## v1.8

### ✨ New Features
- Save node collapse/expand state using HTML comments (`<!--c-->`)
- Hide block reference IDs in Live Preview edit layer

### 🐛 Bug Fixes
- Fixed block reference ID and collapse marker conflict
- Fixed Live Preview block reference link format (missing `#`)
- Fixed collapse marker parsing for multi-line nodes (Shift+Enter)

---

## v1.7

### ✨ New Features
- Added "click to add node" prompt for empty Workflowy views
- Bi-directional real-time sync for split-screen editing (compatible with Mindmap NextGen)
- Added command to toggle render mode (Source/Live Preview)

### 🐛 Bug Fixes
- Fixed arrow key navigation in Live Preview edit mode
- Removed redundant shortcut commands to avoid conflicts

---

## v1.6

### 🔧 Improvements
- Reuse DOM elements for unchanged async embeds (images, Dataview, Excalidraw, etc.)
- Added jump button for Excalidraw images with double-click support
- Added `AbstractInputSuggest` for `[[]]` link suggestions with `#` and `^` support
- Optimized drag handling: distinguish text selection vs block drag

### 🐛 Bug Fixes
- Fixed vertical line rendering after embedded content
- Fixed code block indentation loss
- Fixed vertical line re-render on window resize/sidebar toggle

---

## v1.5

### 🐛 Bug Fixes
- Fixed tag click search, image and `![[]]` embed rendering
- Fixed embedded content click navigation with jump button
- Embedded content now adapts to various themes

---

## v1.4

### 🐛 Bug Fixes
- Fixed child nodes not following parent on Tab/Shift+Tab
- Fixed multi-select indentation logic
- Fixed Tab key indentation logic errors
- Fixed Enter key flicker in Source and Live Preview modes
- Limited drag selection to display layer to prevent full selection
- Fixed viewport/scroll jumping when editing
- Fixed console errors during node operations
- Improved undo baseline to prevent empty state

---

## v1.3

### 🐛 Bug Fixes
- Fixed Backspace unable to delete entire node in Live Preview mode
- Fixed vertical line rendering after drag in both modes
- Fixed memory leaks and improved performance

---

## v1.2

### ✨ New Features
- Live Preview mode (similar to Logseq)
- Configurable render mode: Source mode or Live Preview mode

---

## v1.1

### ✨ New Features
- Read-only Markdown rendering for non-`- ` content using Obsidian API
- Bi-directional link panel navigation with forward/back buttons

---

## v1.0

### 🎉 Initial Release

**Outline View Features:**
- Top navigation bar with node navigation and search (12 built-in themes)
- 4-space indentation, `- ` prefix format (similar to Logseq)

**Click Operations:**
- Click vertical lines to collapse/expand nodes
- Click bullet to enter zoom/focus mode
- Drag up/down to multi-select nodes, Ctrl+click for non-contiguous selection

**Keyboard Shortcuts:**
- `Enter` - Create new node
- `Tab` / `Shift+Tab` - Indent/Outdent
- `Ctrl+Enter` - Toggle todo (press again to complete, grays out children)
- `Ctrl+Shift+↑/↓` - Move node up/down
- `Alt+↑/↓` - Zoom navigation
- `Shift+Enter` - Line break within node
- `Ctrl+Backspace` - Clear node content
- `Ctrl+Shift+Backspace` - Delete current node
