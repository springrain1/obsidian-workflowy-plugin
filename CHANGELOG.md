# Changelog

All notable changes to this project will be documented in this file.

---

## v3.1

### ✨ New Features

#### Extreme Performance & Architecture (Performance & Architecture)
- **Global Virtual Scrolling Engine**: Completely rebuilt the rendering foundation for ultra-large documents. Introduced the new `Virtual Outline Window` to handle on-demand mounting and unmounting of DOM nodes. Say goodbye to stuttering in notes with thousands of blocks—experience true buttery-smooth scrolling.
- **Global Render Scheduler**: Introduced a brand new `Render Scheduler` to unify scattered reflows and DOM updates into coordinated animation frames. This completely eliminates read-write conflicts and dropped frames during high-frequency editing and fast scrolling.
- **DOM Pooling Technology**: Vertical indentation lines are now intelligently pooled and reused. We only keep a minimal set of DOM elements to support infinitely long lists, drastically reducing memory consumption.

#### Native Live Preview Evolution (Live Preview Evolution)
- **Embracing CodeMirror 6**: Dropped the old hijack-based approach and completely rewrote the Live Preview engine. Every block is now powered by a native CodeMirror Widget, parsing Markdown syntax and applying text decorations just like Obsidian's core editor, delivering a perfectly native rendering experience.
- **Precision Floating Menus**: All popup menus—including `/` slash commands, `#` tag suggestions, and link suggestions—now utilize a newly rebuilt floating position system. They perfectly adapt to virtual list offsets, ensuring pixel-perfect tracking with your cursor during rapid typing or scrolling, without any flickering or jittering.
- **Seamless Link Interactions**: Massively upgraded the link operation experience in Live Preview. Introduced debounce protection for `[[` link suggestions, which not only boosts popup responsiveness but also permanently fixes the bug where suggestions couldn't be reliably clicked with a mouse.

#### Mobile & Interaction Refinements (Mobile & Interaction)
- **Virtual Cross-Screen Drag Multi-Select**: Broke the natural barrier between virtualized lists and mouse dragging! Now, even if you drag across hundreds of unmounted blocks off-screen, the system accurately calculates the virtual range for multi-selection, seamlessly clearing the selection state upon successful drag-and-drop.
- **Enhanced Mobile Incremental Updates**: Greatly strengthened the `MobileDOMPatcher` mechanism to gracefully handle cross-level block insertions, deletions, and state synchronization, eliminating virtual list mismatch issues on mobile from the root.

### 🐛 Bug Fixes
- **Accurate View Height Measurement**: Fixed an issue in the Daily Notes aggregated view where inaccurate virtual height calculations caused unexpected layout jumping. Also fixed the failure to correctly reload state upon external file modifications.
- **Eliminated Zero-Change Rendering**: Intercepted invalid state updates that were triggered even when text content hadn't actually changed, squeezing out every last drop of performance.

---

## v3.0

### ✨ New Features

#### UI & Experience
- **Native Readable Line Width**: Fully supports Obsidian's core "Readable Line Length" setting. In both the Outline and Daily Notes views, editor content automatically centers and limits its width while keeping backgrounds full-width, providing optimal reading comfort.
- **Breadcrumb Markdown Tooltips**: Hovering over breadcrumb navigation paths now displays a fully rendered Markdown tooltip of that node's complete content.
- **Context Menu "Insert Double Link"**: Added a quick "Insert double link" action in Live Preview. Wraps selected text in `[[]]` with the cursor at the end, or inserts `[[]]` with the cursor inside if no text is selected.

#### Interaction Enhancements
- **Precision Cursor Restoration for Keyboard Zoom**: Introduced a cursor history stack for keyboard zooming. When zooming out of a child node, your cursor will **restore precisely to its previous character position** instead of falling back to the end of the node.
- **Live Preview Multi-Select Revolution**: Completely resolved the conflict between text selection and block selection. You can now normally select text inside a block; only when dragging **outside the block's boundaries**, or while holding `Alt`, does it seamlessly upgrade to block multi-selection. Added an invisible "selection rail" for easier bulk selection.
- **Smart Arrow Key Navigation**: Refactored Up/Down arrow key navigation to rely on the actual rendered DOM tree. It now perfectly skips filtered, hidden, or collapsed nodes, eliminating unexpected cursor jumps.

### 🐛 Bug Fixes
- **Live Preview Memory Leak Fix**: Refactored the event lifecycle management of the editor component, fixing a memory leak and performance degradation caused by stacking event listeners during frequent focus or view switches.

---

## v2.9

### ✨ New Features

#### Folder Outline View
- **One-Click Folder Aggregation**: Right-click any folder in the file explorer and select "Open as Folder Outline" to seamlessly merge all Markdown notes within into a unified, continuous Workflowy-style outline.
- **Smart Tab Management**: Automatically recognizes and reuses already opened folder views, avoiding duplicate tabs and keeping your workspace consistently tidy.
- **Dynamic Title Sync**: The tab name intelligently tracks your selected folder, updating automatically in real-time.

#### Seamless Bi-directional Cursor Sync
- **Two-Way Cursor Memory**: Powered by a new core SourceMap engine. Whether editing in the Outline View or the Markdown Source View, a single click to switch will **keep your cursor precisely at the character you were editing**! No more painfully searching for your edit point in long documents.
- **Buttery-Smooth Transitions**: Leveraged Obsidian's native `eState` (ephemeral state) engine to bypass easily race-conditioned timers, achieving a "zero-delay", instant seamless switching experience.

### 🚀 Experience & Performance Boosts

#### ⚡ Leap in Switching Performance
- **Goodbye Switching Lag**: Refactored view-switching state management. We eradicated the invalid background disk-write actions to `workspace.json` that occurred during high-frequency view toggles. This not only drastically reduces device energy consumption but also noticeably enhances Obsidian's overall responsiveness.

#### 🏗 Large Document Loading Optimization (Phase 1)
- **Massive Performance Foundation Upgrade**: Completed deep performance profiling and architectural design for ultra-large documents (e.g., notes containing thousands of nodes). Thoroughly refactored the underlying rendering skeleton to pave the way for upcoming "Lightning Open" and "Instant Fold" features.

---

## v2.8.2

### 🔧 Refactors & Optimizations
- **Comprehensive Internationalization (i18n)**: Fully replaced hardcoded strings with the `t()` translation function across all components, including the Daily Notes Section, achieving full multi-language support.
- **Fixed Theme Translation Failure**: Removed premature static export of the `THEMES` constant, switching to dynamic `getThemes()` calls. This permanently fixes the bug where fallback languages were loaded before i18n initialization, backed by new Vitest test cases.
- **Rendering & Scroll Positioning**: Introduced a dual-layer `requestAnimationFrame` mechanism during Daily Notes Section mounting to ensure pixel-perfect scroll positioning and eliminate viewport jitter after complex DOM operations.
- **Data Robustness Enhancements**: Improved the rigor of daily note date processing, searching, and creation. Upgraded YAML Frontmatter parsing security filters to seamlessly handle files with BOM characters and leading empty lines.

---

## v2.8.1

### 🐛 Bug Fixes
- **YAML Frontmatter Protection**: Implemented strict bypassing logic in the parser to protect the YAML frontmatter (`---`) block at the top of notes. This permanently fixes the issue where enabling Thino compatibility mode accidentally converted spaces inside YAML to tabs, which caused parsing errors.
- **View Switching Experience**: Fixed an issue where switching from Outline View to Markdown View in a single document would unnecessarily open a new tab. It now seamlessly transforms the current tab in-place, keeping the new-tab behavior exclusive to the Daily Notes aggregated view.

---

## v2.8

### ✨ New Features

#### Daily Notes Plus Aggregated Outline View
- **Brand new Daily Notes aggregated view**: Display and edit multiple Daily Notes in a single unified view
- **Three note source modes**:
  - Daily Notes mode: Automatically reads Obsidian core Daily Notes plugin configuration
  - Folder mode: Select any folder to aggregate notes
  - Tag mode: Filter notes by tags
- **Flexible filtering and sorting**:
  - Sorting: date (ascending/descending), creation time, modification time, file name
  - Time ranges: this week/month/year, last week/month/year, this/last quarter, custom range
  - Presets: save and quickly switch between common configurations
- **Efficient editing experience**:
  - Each Daily Note as independent section with collapse/expand
  - Click title to open as standalone outline view
  - Zoom navigation: click bullet to focus on child content with breadcrumb navigation
  - Full outline editing features: indent, move, collapse, delete, multi-select, etc.
  - Cross-section block dragging (normal drag to move, Alt+drag for block references)
  - All editor shortcuts supported (Tab/Enter/Ctrl+Z, etc.)
- **Performance optimization**:
  - On-demand loading: configurable initial batch size, dynamic mount/unmount on scroll
  - Delayed unloading: prevent frequent re-renders when scrolling quickly
- **Convenient features**:
  - Auto-create today's note: toolbar button + optional startup creation
  - Date picker: quickly jump to specific date's Daily Note
  - Fallback configuration: plugin-level settings when core plugin unavailable (folder, date format, template)
  - Theme switching: supports all built-in themes, consistent with standalone view
  - Responsive design: perfect for desktop and mobile

#### Enhanced Link Navigation
- Unified Workflowy link navigation system:
  - Internal links `[[note]]`: open in current view or split pane
  - Heading links `[[note#heading]]`: scroll and highlight target heading
  - Block references `[[note#^blockid]]`: precise navigation to target block
  - Embed link jump button: click to open source file
- Ctrl+Alt+click or Shift+click to open in split pane
- Link navigation in Daily Notes aggregated view:
  - File in aggregation scope: auto-expand corresponding section and navigate
  - File outside scope: open standalone view in new tab
- Jump highlight effect: target content flashes yellow background for 2 seconds, fading out

#### Cross-Document Drag Optimizations
- Alt+drag block reference creation workflow optimized:
  - Same-document source mode: fast path avoiding file events
  - Cross-document or Live Preview: async source block ID update, wait for metadata
  - Auto-generates Obsidian-compliant block IDs (^block-id format)
  - Updates target position block reference after completion
- Cross-section multi-select drag support:
  - Detects multi-select drag data format (`workflowy-multi-blocks`)
  - Supports batch block movement across Daily Notes sections
  - Preserves original drop zone logic (before/after/child)

### 🐛 Bug Fixes
- Fixed multi-select drag compatibility in cross-section scenarios
- Fixed potential data loss risk when saving before file fully loaded
- Fixed editor container loss in certain scenarios
- Fixed subpath navigation event payload parsing compatibility

### 🔧 Improvements
- Deep settings merge: compatible with missing nested config fields from old versions
- Editor container caching: avoid repeated DOM queries, improve rendering performance
- Cross-document event optimization: explicit event payload structure, supports targetLeaf specification
- Debug logging system: enable detailed logs via `settings.isolation.debugMode`
- Unified commands: Daily Notes view and standalone view share editing commands (indent, move, collapse, etc.)

### 📝 License System
- Daily Notes Plus features require license (7-day trial)
- License management UI: enter license key, view status, appreciation/WeChat QR codes
- Trial period displays remaining days
- Expiration prompt for license renewal

---

## v2.7

### ✨ New Features

#### Table Rendering Enhancements
- Full Markdown table support in Live Preview mode:
  - Table borders, header background, zebra striping
  - Text alignment within tables (left/center/right)
  - Row hover highlighting
- Table styles for all themes (14 built-in themes)
- Table line break logic optimized: table rows connected with single newline to prevent parsing errors

---
### ✨ New Features
- Support for table rendering in nodes

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
