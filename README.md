# Obsidian Workflowy Plugin

A powerful Obsidian plugin that transforms your Markdown notes into a Workflowy-style outline editor with seamless block-level editing capabilities.

[中文文档](README-zh_cn.md)

## ✨ Features

### 🎯 Core Features
- **Dual-Mode Editing**: Seamlessly switch between traditional Markdown editing and Workflowy-style outline editing
- **Block-Level Operations**: Workflowy-like hierarchical structure with intuitive block manipulation
- **Real-Time Sync**: Maintains native Obsidian Markdown format while providing enhanced editing experience
- **Zero Interference**: Complete functional isolation ensures no impact on native Obsidian Markdown experience

### ⌨️ Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Enter` | Create new block |
| `Backspace` | Delete empty block / Merge blocks |
| `Delete` | Delete character / Merge with next block |
| `Tab` / `Shift+Tab` | Indent / Outdent |
| `Ctrl+Shift+↑/↓` | Move block up/down |
| `Alt+Enter` | Toggle collapse/expand |
| `Shift+Enter` | Line break within block |
| `Ctrl+Enter` | Toggle todo status |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+Backspace` | Clear block content |
| `Ctrl+Shift+Backspace` | Delete current block |
| `Alt+↑/↓` | Zoom out / Zoom in |
| `↑/↓` | Navigate between blocks |
| `/` | Open slash command menu |
| `#` | Open tag suggestion menu |
| `Ctrl+Scroll` | Adjust font size (10-30px) |
| `Escape` | Cancel multi-selection / Close menu |
| `Ctrl+A` | Select all blocks (in multi-selection mode) |

### 🎨 UI Features
- **Workflowy-Style Interface**: Clean bullet points with hierarchical indentation lines
- **Collapse/Expand**: Hide/show child blocks (click triangle, vertical line, or press `Alt+Enter`)
- **Zoom Focus**: Click bullet to zoom into a specific block for focused editing
- **Real-Time Search**: Quick search with highlighting (highlight or filter mode)
- **Drag & Drop**: Intuitive block reordering via drag and drop
- **Multi-Selection**: Select multiple blocks for batch operations (via left-click drag or Ctrl+click)
- **Theme Support**: Multiple built-in themes with light/dark mode support
- **Responsive Design**: Works perfectly on desktop and mobile devices

### 📝 Editing Modes
- **Source Mode**: Direct text editing with Markdown syntax
- **Live Preview Mode**: Real-time Markdown rendering with WYSIWYG editing
  - Full Markdown formatting support (bold, italic, links, headings, etc.)
  - Internal link preview and navigation
  - Embed support (images, notes, blocks)
  - Code syntax highlighting

### ⚡ Slash Command Menu (New)
Type `/` to trigger the slash command menu for quick insertion:

| Command Type | Function |
|--------------|----------|
| **Time** | Set task time `[HH:MM]`, supports time ranges (TickTickSync compatible) |
| **Priority** | 🔺Highest / ⏫High / 🔼Medium / 🔽Low / ⏬Lowest (obsidian-tasks compatible) |
| **Date** | 📅Due / ⏳Scheduled / 🛫Start / ➕Created / ✅Done |
| **Status** | ☐Todo / ◐In Progress / ☑Done / ⊘Cancelled / •Normal |

### 🏷️ Tag Suggestions (New)
Type `#` to trigger the tag suggestion menu:
- Automatically reads all tags from your Vault
- Real-time filtering of matching tags
- Keyboard navigation for selection
- Quick tag insertion

### ✅ Multi-Status Todo Support (New)
Supports four todo states, compatible with obsidian-tasks plugin:
- `[ ]` Todo
- `[/]` In Progress
- `[x]` Done
- `[-]` Cancelled

### 🔗 Link Support
- Internal links (`[[note]]`) with click navigation
- Heading links (`[[note#heading]]`) with scroll and highlight
- Block references (`[[note#^blockid]]`) with precise navigation
- Embed links (`![[note]]`) with click-to-navigate
- Ctrl+hover for preview popup
- Ctrl+Alt+click or Shift+click for split view

### 📎 Link Suggestions
Type `[[` or `![[` to trigger link suggestions:
- Auto-search files in your Vault
- Type `#` to select headings
- Type `^` to select block references
- Fuzzy search and keyboard navigation support

### 🔀 Cross-Document Drag & Drop
- **Normal drag**: Move blocks between documents
- **Alt+drag**: Create block references (`![[file#^blockid]]`)
- Auto-generates Obsidian-compliant block IDs
- Supports multi-select batch dragging

### 📝 Thino Compatibility (New)
Compatible with Thino/Memos plugin format:
- **Tab Indentation Support**: First-level list items support Tab-indented continuation lines
- **Auto Timestamp**: Automatically add timestamps when creating new blocks
- **Timestamp Format**: Choose between `HH:mm` or `HH:mm:ss` format
- **Seamless Switching**: Preserves Tab indentation when switching between Markdown and Outline views

### ✍️ Live Preview Editor Enhancements
Markdown shortcuts in Live Preview mode:
| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+K` | Insert link |
| `Ctrl+Shift+H` | Highlight |
| Right-click | More formatting options |

### 📱 Mobile Toolbar
Fixed bottom toolbar on mobile with quick actions:
| Button | Action |
|--------|--------|
| ≡← | Outdent |
| →≡ | Indent |
| + | New block |
| ☑ | Toggle todo |
| **B** | Bold |
| *I* | Italic |
| ⌨ | Hide keyboard |

### 📁 File Drag & Paste
- **Drag files**: Drag files into editor to auto-insert links
- **Paste images**: Paste clipboard images, auto-save and insert
- **Drag images**: Drag image files to auto-upload and insert links
- Supports custom attachment save path

## 📖 Usage

### Switching Views
**Switch to Workflowy View:**
1. Open any Markdown file
2. Use Command Palette (`Ctrl/Cmd+P`) and search "Toggle Outline/Markdown View"
3. Or right-click the file and select "Open as Outline Note"

**Switch back to Markdown View:**
1. In Workflowy view, use Command Palette and search "Toggle Outline/Markdown View"
2. Or right-click and select "Open as Markdown"

### Basic Operations
- **Create Block**: Press `Enter` to create a new block after current one
- **Indent Management**: Use `Tab` and `Shift+Tab` to adjust hierarchy
- **Move Blocks**: Use `Ctrl+Shift+↑/↓` or drag and drop
- **Collapse/Expand**: Click the triangle icon, the vertical indentation line, or press `Alt+Enter`
- **Zoom Focus**: Click the bullet point to zoom into that block
- **Multi-Select**: Drag up/down with left mouse button, or hold `Ctrl` and click multiple blocks for batch operations

### Search
- Click the search icon or use the search bar at the top
- **Highlight Mode**: Highlights matching content while showing all blocks
- **Filter Mode**: Shows only blocks containing the search term
- Case-sensitive search option available

## 📦 Installation

### From Obsidian Community Plugins (Recommended)
1. Open Obsidian Settings
2. Go to "Community Plugins"
3. Disable "Safe Mode"
4. Click "Browse" and search for "Workflowy Outline"
5. Click "Install" and enable the plugin

### Manual Installation
1. Download the latest release from [Releases](https://github.com/user/obsidian-workflowy-plugin/releases)
2. Extract to your Obsidian plugins folder: `{vault}/.obsidian/plugins/obsidian-workflowy-plugin/`
3. Enable the plugin in Obsidian settings

### Using BRAT

[BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tester) allows you to install and automatically update plugins directly from GitHub.

1. Install the BRAT plugin from Obsidian Community Plugins
2. Enable BRAT in Settings → Community plugins
3. Open BRAT settings and click "Add Beta plugin"
4. Enter the repository URL: `https://github.com/springrain1/obsidian-workflowy-plugin`
5. Click "Add Plugin" and BRAT will install obsidian-workflowy-plugin automatically
6. Enable obsidian-workflowy-plugin in Settings → Community plugins

> **Tip**: BRAT will automatically check for updates and notify you when a new version is available.

## ⚙️ Settings

### UI Settings
- **Indent Size**: Customize indentation distance (default: 30px)
- **Theme**: Choose from multiple built-in themes
- **Show Bullets**: Toggle bullet point visibility
- **Show Collapse Indicators**: Toggle collapse arrow visibility
- **Show Vertical Lines**: Toggle vertical indentation lines
- **Animations**: Enable/disable UI animations
- **Font Size**: Customize editor font size (or use Ctrl+Scroll)
- **Line Height**: Customize line height multiplier
- **Bullet Alignment**: Choose bullet alignment (top/center/bottom)
- **Font Family**: Choose font source (theme/system/custom)

### Editor Settings
- **Render Mode**: Choose between Source mode and Live Preview mode
- **Auto Save**: Enable automatic saving with configurable delay
- **Placeholder Text**: Customize empty block placeholder
- **Attachment Path**: Configure where file attachments are saved

### Feature Toggles
- **Slash Command**: Enable/disable slash command menu (`/`)
- **Tag Suggestions**: Enable/disable tag suggestions (`#`)
- **Link Suggestions**: Enable/disable link suggestions (`[[`)
- **Cross-Document Drag**: Enable/disable dragging blocks between documents
- **Auto Block ID**: Auto-generate block IDs when Alt+dragging
- **Mobile Toolbar**: Enable/disable bottom toolbar on mobile

### Search Settings
- **Search Mode**: Highlight or Filter mode
- **Case Sensitive**: Toggle case-sensitive search
- **Auto Expand Matches**: Automatically expand collapsed blocks containing matches

### Drag & Drop Settings
- **Enable Drag & Drop**: Toggle drag and drop functionality
- **Show Drop Indicators**: Visual feedback during drag operations
- **Allow Nested Drop**: Allow dropping blocks as children

### Collapse State Memory
- **Enable**: Remember collapse states in the document
- **Marker**: Custom marker for collapse state (stored as HTML comments)

### Thino Compatibility
- **Enable Thino Mode**: Support Tab-indented continuation lines for first-level list items
- **Auto Timestamp**: Automatically add timestamps when creating new blocks
- **Timestamp Format**: Choose between `HH:mm` or `HH:mm:ss` format

## 🔧 Compatibility

- **Obsidian Version**: 0.15.0+
- **Platform Support**:
  - ✅ Windows / macOS / Linux Desktop
  - ✅ iOS / Android Mobile
  - ✅ Tablets (iPad / Android Tablet)
- **Theme Compatibility**: Works with all Obsidian themes, auto-adapts to light/dark mode

### 📱 Mobile Optimization
- **Touch Interaction**: All interactive elements meet 44px minimum touch target
- **Responsive Layout**: Automatically adapts to different screen sizes
- **Optimized Font Size**: 16px font on mobile to prevent auto-zoom
- **Reduced Indentation**: Smaller indent spacing on mobile to save screen space
- **Touch Drag & Drop**: Full support for touch-based reordering
- **Platform Detection**: Automatic device detection with appropriate optimizations

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Thanks to [Obsidian](https://obsidian.md/) for the powerful plugin API
- Inspired by [Workflowy](https://workflowy.com/)'s excellent design
- Referenced [Obsidian Outliner](https://github.com/vslinko/obsidian-outliner) for some implementations
- Thanks to the community for feedback and contributions

## 💬 Feedback & Support

- **Bug Reports**: [GitHub Issues](https://github.com/user/obsidian-workflowy-plugin/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/user/obsidian-workflowy-plugin/discussions)
- **Author**: SpringRain | 公众号: 及时春雨
